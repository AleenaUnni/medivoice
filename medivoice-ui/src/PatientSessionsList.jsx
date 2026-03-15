import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function urgencyMeta(score) {
  const s = Number(score || 1);
  if (s >= 5) return { label: "URGENT", cls: "bg-red-50 text-red-800 border-red-200" };
  if (s === 4) return { label: "High", cls: "bg-orange-50 text-orange-800 border-orange-200" };
  if (s === 3) return { label: "Moderate", cls: "bg-amber-50 text-amber-800 border-amber-200" };
  if (s === 2) return { label: "Low", cls: "bg-sky-50 text-sky-800 border-sky-200" };
  return { label: "Routine", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" };
}

function initials(name) {
  const n = (name || "U").trim();
  return n ? n[0].toUpperCase() : "U";
}

function timeAgo(iso) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;
  if (diffMs < 10_000) return "Just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minutes ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hours ago`;
  const days = Math.floor(hr / 24);
  return `${days} days ago`;
}

export default function PatientSessionsList() {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [tick, setTick] = useState(0);

  const lastUpdatedSeconds = useMemo(() => {
    if (!lastUpdatedAt) return null;
    return Math.max(0, Math.floor((Date.now() - lastUpdatedAt) / 1000));
  }, [lastUpdatedAt, tick]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/sessions", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const json = await res.json();
      setSessions(Array.isArray(json) ? json : []);
      setLastUpdatedAt(Date.now());
    } catch {
      setSessions([]);
      setLastUpdatedAt(Date.now());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const poll = window.setInterval(() => fetchSessions(), 60_000);
    return () => window.clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="print-hidden bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 grid grid-cols-3 items-center">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-teal-600 flex items-center justify-center">
              <span className="text-white font-bold">M</span>
            </div>
            <div className="font-semibold">MediVoice</div>
          </div>
          <div className="text-center text-sm font-semibold text-slate-700">Patient Sessions</div>
          <div className="flex items-center justify-end gap-3">
            <div className="text-sm text-slate-700">
              Dr. <span className="font-semibold">{user?.name || "Doctor"}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold">Today&apos;s Patients</div>
            <div className="text-sm text-slate-600 mt-1">{today}</div>
          </div>
          <button
            type="button"
            onClick={fetchSessions}
            className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-16 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="mt-10 bg-slate-100 rounded-xl p-12 text-center border border-slate-200">
            <div className="h-20 mx-auto mb-4 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-3xl">
              🗂️
            </div>
            <div className="text-xl font-semibold">No patient sessions yet</div>
            <div className="text-slate-600 mt-2">
              Sessions will appear here when patients complete their check-in
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {sessions.map((session) => {
              const u = urgencyMeta(session.urgency_score);
              const pain = Number(session.pain_scale || 0);
              const painDot =
                pain >= 7 ? "bg-red-500" : pain >= 4 ? "bg-amber-500" : pain > 0 ? "bg-emerald-500" : "bg-slate-300";
              return (
                <div
                  key={session.session_id}
                  onClick={() => navigate(`/doctor?session=${session.session_id}`)}
                  style={{ cursor: 'pointer' }}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 hover:shadow-md hover:border-slate-300 transition-shadow p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="h-12 w-12 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-semibold">
                        {initials(session.patient_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-lg font-semibold truncate">{session.patient_name}</div>
                        <div className="text-xs text-slate-500 truncate">{session.patient_email}</div>
                        <div className="text-sm text-slate-700 mt-1 truncate">
                          <span className="font-semibold">Chief Complaint:</span> {session.chief_complaint || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${u.cls}`}>
                        {u.label}
                      </div>
                      <div className="text-xs text-slate-700 flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${painDot}`} />
                        Pain: {pain}/10
                      </div>
                      <div className="text-xs text-slate-500 w-28 text-right">{timeAgo(session.created_at)}</div>
                      <div className="hidden sm:block">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/doctor?session=${session.session_id}`);
                          }}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700"
                        >
                          View Brief →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {lastUpdatedSeconds !== null && (
          <div className="mt-6 text-xs text-slate-500 text-center">
            Last updated: {lastUpdatedSeconds} seconds ago
          </div>
        )}
      </div>
    </div>
  );
}

