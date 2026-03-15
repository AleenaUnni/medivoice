import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';

const demoData = {
  chiefComplaint: 'Persistent headache',
  symptoms: ['Severe headache', 'Nausea', 'Light sensitivity'],
  duration: '3 days',
  medications: ['Metformin 500mg'],
  allergies: ['Penicillin'],
  painScale: 7,
  urgencyScore: 3,
  redFlags: ['Headache increasing over 3 days'],
  summary:
    'Patient presents with a 3-day history of worsening headache rated 7/10, associated with nausea and light sensitivity. No red flag neurologic symptoms reported, but progression and impact on function warrant timely evaluation.',
};

function getUrgency(urgencyScore) {
  if (urgencyScore >= 5) {
    return {
      label: 'Urgent',
      color: 'bg-red-50 text-red-700 border-red-200',
    };
  }
  if (urgencyScore >= 3) {
    return {
      label: 'Moderate',
      color: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  }
  return {
    label: 'Routine',
    color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  };
}

function PainScaleBar({ value }) {
  const segments = Array.from({ length: 10 }).map((_, index) => {
    const segmentNumber = index + 1;
    let baseColor = 'bg-slate-700';
    if (segmentNumber <= value) {
      if (segmentNumber <= 3) baseColor = 'bg-emerald-400';
      else if (segmentNumber <= 6) baseColor = 'bg-amber-400';
      else baseColor = 'bg-red-500';
    }
    return baseColor;
  });

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs text-slate-400">
        <span>Pain scale</span>
        <span className="font-semibold text-slate-200">
          {value}/10
        </span>
      </div>
      <div className="flex gap-1">
        {segments.map((color, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className={`flex-1 h-3 rounded-full ${color}`} />
        ))}
      </div>
      <div className="w-full flex justify-between gap-6 text-[10px] text-slate-500 uppercase tracking-wide">
        <span>MILD</span>
        <span>MODERATE</span>
        <span>SEVERE</span>
      </div>
    </div>
  );
}

function DoctorDashboard() {
  const { token, user, logout } = useAuth();
  const [data, setData] = useState(demoData);
  const [loading, setLoading] = useState(false);

  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!sessionId) return;
      setLoading(true);
      try {
        const res = await fetch(`http://localhost:8000/report/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setData(json);
        }
      } catch {
        // keep demo data on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, token]);

  const urgency = useMemo(() => getUrgency(data.urgencyScore), [data.urgencyScore]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin" />
          <div className="text-sm text-slate-600">Loading report…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="print-hidden bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-teal-600 flex items-center justify-center">
              <span className="text-white font-bold">M</span>
            </div>
            <div className="font-semibold">MediVoice</div>
          </div>
          <div className="text-center text-sm font-semibold text-slate-700">Clinical Intake Brief</div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => { window.location.href = '/doctor'; }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 hover:border-teal-200 transition-colors"
            >
              ← Patients
            </button>
            <div className="h-4 w-px bg-slate-200" />
            <div className="flex items-center gap-1.5">
              <div className="h-7 w-7 rounded-full bg-teal-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {(user?.name || 'D')[0]}
                </span>
              </div>
              <span className="text-sm text-slate-700 font-medium">
                {user?.name || 'Doctor'}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 border border-slate-200 transition-colors"
            >
              <span>🖨️</span>
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-start justify-between gap-6">
          <div>
            <div className="text-xs tracking-wide text-slate-500 font-semibold">PATIENT</div>
            <div className="text-2xl font-semibold mt-1">{data.patientName || 'Unknown'}</div>
            <div className="text-sm text-slate-600 mt-1">{data.appointmentTime || "Today's Appointment"}</div>
          </div>
          <div className={`px-4 py-2 rounded-full border text-sm font-semibold ${urgency.color}`}>
            {urgency.label}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="border-l-4 border-teal-600 pl-4">
            <div className="text-xs tracking-wide text-slate-500 font-semibold">CHIEF COMPLAINT</div>
            <div className="text-lg font-semibold mt-1">{data.chiefComplaint}</div>
            <div className="text-sm text-slate-600 mt-2">
              Duration: <span className="font-medium text-slate-900">{data.duration}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="text-xs tracking-wide text-slate-500 font-semibold mb-3">SYMPTOMS</div>
              <ul className="space-y-2">
                {(data.symptoms || []).map((symptom) => (
                  <li key={symptom} className="flex items-start gap-2 text-sm text-slate-800">
                    <span className="mt-1 h-2 w-2 rounded-full bg-teal-500" />
                    <span>{symptom}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="text-xs tracking-wide text-slate-500 font-semibold mb-3">MEDICATIONS</div>
              <div className="flex flex-wrap gap-2">
                {(data.medications || []).map((med) => (
                  <span
                    key={med}
                    className="inline-flex items-center px-3 py-1 rounded-full bg-sky-50 text-sky-800 text-xs border border-sky-200"
                  >
                    {med}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="text-xs tracking-wide text-slate-500 font-semibold mb-3">ALLERGIES</div>
              <div className="flex flex-wrap gap-2">
                {(data.allergies || []).map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center px-3 py-1 rounded-full bg-red-50 text-red-800 text-xs border border-red-200"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="text-xs tracking-wide text-slate-500 font-semibold mb-3">PAIN SCALE</div>
              <div className="text-sm text-slate-700 mb-4">
                Reported pain: <span className="font-semibold text-slate-900">{data.painScale}/10</span>
              </div>
              <div className="space-y-2">
                <div className="flex gap-1">
                  {Array.from({ length: 10 }).map((_, idx) => {
                    const n = idx + 1;
                    const filled = n <= (data.painScale || 0);
                    const color =
                      !filled ? 'bg-slate-200' : n <= 3 ? 'bg-emerald-500' : n <= 6 ? 'bg-amber-500' : 'bg-red-500';
                    return <div key={n} className={`flex-1 h-3 rounded-full ${color}`} />;
                  })}
                </div>
                <div className="w-full flex justify-between gap-6 text-[10px] text-slate-500 uppercase tracking-wide">
                  <span>MILD</span>
                  <span>MODERATE</span>
                  <span>SEVERE</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="text-xs tracking-wide text-slate-500 font-semibold mb-3">URGENCY SCORE</div>
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-700">
                  Score: <span className="font-semibold text-slate-900">{data.urgencyScore}/5</span>
                </div>
                <div className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const n = idx + 1;
                    const filled = n <= (data.urgencyScore || 0);
                    const dot =
                      !filled
                        ? 'bg-slate-200'
                        : n <= 2
                          ? 'bg-emerald-500'
                          : n <= 3
                            ? 'bg-amber-500'
                            : 'bg-red-500';
                    return <div key={n} className={`h-3 w-3 rounded-full ${dot}`} />;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {(data.redFlags || []).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6">
            <div className="text-xs tracking-wide text-red-700 font-semibold mb-2">RED FLAGS</div>
            <ul className="space-y-1 text-sm text-red-900">
              {data.redFlags.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-red-500" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="text-xs tracking-wide text-slate-500 font-semibold mb-2">AI SUMMARY</div>
          <div className="text-sm text-slate-800 leading-relaxed">{data.summary}</div>
          <div className="mt-4 text-xs text-slate-500">
            Generated by Nova Lite • For clinical prep only
          </div>
        </div>
      </div>
    </div>
  );
}

export default DoctorDashboard;

