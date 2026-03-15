import boto3
import json
import os
from datetime import datetime
from pathlib import Path
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from auth import router as auth_router, get_current_user, require_doctor, require_patient

app = FastAPI()

app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

bedrock = boto3.client("bedrock-runtime", region_name="us-east-1")

REPORTS_FILE = Path("reports_store.json")


def load_reports():
    if REPORTS_FILE.exists():
        with open(REPORTS_FILE, "r") as f:
            return json.load(f)
    return {}


def save_reports(reports_dict):
    with open(REPORTS_FILE, "w") as f:
        json.dump(reports_dict, f, indent=2)


# In-memory store for transcripts and reports
transcripts = {}
reports = load_reports()

class TranscriptRequest(BaseModel):
    session_id: str
    transcript: str

@app.post("/generate-report")
async def generate_report(req: TranscriptRequest, current_user: dict = Depends(get_current_user)):
    transcripts[req.session_id] = req.transcript
    
    prompt = f"""You are a clinical assistant. Extract structured medical intake data from this patient conversation transcript.

Return ONLY a valid JSON object with exactly these fields:
{{
  "patientName": "extracted name or Unknown",
  "appointmentTime": "Today's Appointment",
  "chiefComplaint": "main reason for visit in one sentence",
  "symptoms": ["symptom 1", "symptom 2"],
  "duration": "how long symptoms have lasted",
  "medications": ["med 1", "med 2"],
  "allergies": ["allergy 1"],
  "painScale": 5,
  "urgencyScore": 3,
  "redFlags": ["any concerning symptoms"],
  "summary": "2-3 sentence clinical summary paragraph"
}}

urgencyScore rules: 1=routine, 2=low, 3=moderate, 4=high, 5=urgent
painScale: number 1-10 extracted from conversation, default 5 if not mentioned

TRANSCRIPT:
{req.transcript}

Return ONLY the JSON. No explanation, no markdown, no backticks."""

    response = bedrock.invoke_model(
        modelId="amazon.nova-lite-v1:0",
        body=json.dumps({
            "messages": [{"role": "user", "content": [{"text": prompt}]}],
            "inferenceConfig": {"maxTokens": 1024, "temperature": 0.3}
        })
    )
    
    result = json.loads(response["body"].read())
    text = result["output"]["message"]["content"][0]["text"]
    
    # Clean and parse JSON
    text = text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    
    report_data = json.loads(text.strip())
    reports[req.session_id] = {
        **report_data,
        "session_id": req.session_id,
        "patient_email": current_user["email"],
        "patient_name": current_user["name"],
        "created_at": datetime.now().isoformat(),
    }
    save_reports(reports)
    
    return report_data

@app.get("/report/{session_id}")
async def get_report(session_id: str, current_user: dict = Depends(require_doctor)):
    if session_id in reports:
        return reports[session_id]
    # Return demo data if no real report
    return {
        "patientName": "Demo Patient",
        "appointmentTime": "Today's Appointment", 
        "chiefComplaint": "Persistent headache with nausea",
        "symptoms": ["Severe headache", "Nausea", "Light sensitivity"],
        "duration": "3 days",
        "medications": ["Metformin 500mg"],
        "allergies": ["Penicillin"],
        "painScale": 7,
        "urgencyScore": 3,
        "redFlags": ["Headache increasing over 3 days"],
        "summary": "Patient presents with 3-day headache rated 7/10 with nausea and light sensitivity. Currently on Metformin. Allergic to Penicillin. Recommend BP check on arrival."
    }

@app.get("/sessions")
async def get_sessions(current_user: dict = Depends(require_doctor)):
    session_list = []
    for session_id, report in reports.items():
        session_list.append({
            "session_id": session_id,
            "patient_name": report.get("patient_name", "Unknown"),
            "patient_email": report.get("patient_email", ""),
            "chief_complaint": report.get("chiefComplaint", ""),
            "urgency_score": report.get("urgencyScore", 1),
            "pain_scale": report.get("painScale", 0),
            "created_at": report.get("created_at", ""),
        })
    # Sort by created_at newest first
    session_list.sort(key=lambda x: x["created_at"], reverse=True)
    return session_list

@app.get("/health")
async def health():
    return {"status": "ok"}