from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import json
from pathlib import Path
import hashlib
import hmac

SECRET_KEY = "medivoice-secret-2025-nova-hackathon"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440


def hash_password(password: str) -> str:
    return hmac.new(b"medivoice2025", password.encode(), hashlib.sha256).hexdigest()


def verify_password(plain: str, hashed: str) -> bool:
    return hash_password(plain) == hashed


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)
router = APIRouter(prefix="/auth", tags=["auth"])

USERS_FILE = Path("users_store.json")


def load_users():
    defaults = {
        "patient@medivoice.com": {
            "email": "patient@medivoice.com",
            "name": "Aleena",
            "role": "patient",
            "hashed_password": hash_password("patient123"),
        },
        "doctor@medivoice.com": {
            "email": "doctor@medivoice.com",
            "name": "Dr. Sarah Johnson",
            "role": "doctor",
            "hashed_password": hash_password("doctor123"),
        },
    }
    if USERS_FILE.exists():
        with open(USERS_FILE, "r") as f:
            saved = json.load(f)
            defaults.update(saved)
    return defaults


def save_users():
    with open(USERS_FILE, "w") as f:
        json.dump(USERS_DB, f, indent=2)


USERS_DB = load_users()


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    name: str
    email: str


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        if not email or email not in USERS_DB:
            raise HTTPException(status_code=401, detail="Invalid token")
        return USERS_DB[email]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_doctor(current_user=Depends(get_current_user)):
    if current_user["role"] != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access required")
    return current_user


def require_patient(current_user=Depends(get_current_user)):
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patient access required")
    return current_user


@router.post("/login", response_model=Token)
def login(req: LoginRequest):
    user = USERS_DB.get(req.email)
    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": user["email"], "role": user["role"]})
    return Token(
        access_token=token,
        token_type="bearer",
        role=user["role"],
        name=user["name"],
        email=user["email"],
    )


@router.post("/register", response_model=Token)
def register(req: RegisterRequest):
    if req.email in USERS_DB:
        raise HTTPException(status_code=400, detail="Email already registered")
    if req.role not in ["patient", "doctor"]:
        raise HTTPException(status_code=400, detail="Role must be patient or doctor")
    USERS_DB[req.email] = {
        "email": req.email,
        "name": req.name,
        "role": req.role,
        "hashed_password": hash_password(req.password),
    }
    save_users()
    token = create_access_token({"sub": req.email, "role": req.role})
    return Token(
        access_token=token,
        token_type="bearer",
        role=req.role,
        name=req.name,
        email=req.email,
    )


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return {"email": current_user["email"], "name": current_user["name"], "role": current_user["role"]}


__all__ = ["router", "get_current_user", "require_doctor", "require_patient"]

