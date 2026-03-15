import React, { useEffect, useMemo, useRef, useState } from 'react';
import AudioStreamer from './AudioStreamer';
import { useAuth } from './AuthContext';

const WAVE_BAR_COUNT = 28;

function createSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function Waveform({ active }) {
  return (
    <div className="flex items-end justify-center gap-1 h-24">
      {Array.from({ length: WAVE_BAR_COUNT }).map((_, index) => {
        const heightClass = ['h-6', 'h-10', 'h-16', 'h-8', 'h-14'][index % 5];
        const delayClass = ['delay-0', 'delay-75', 'delay-150', 'delay-200'][index % 4];
        return (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className={`w-1 rounded-full bg-teal-400 ${heightClass} ${
              active ? `animate-pulse ${delayClass}` : 'opacity-40'
            }`}
          />
        );
      })}
    </div>
  );
}

function TranscriptBubble({ role, text }) {
  const isAssistant = role === 'ASSISTANT';
  const label = isAssistant ? 'MediVoice' : 'You';
  const labelColor = isAssistant ? 'text-teal-700' : 'text-slate-500';

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className="max-w-[36rem] w-full sm:w-auto">
        <div className={`text-xs font-semibold mb-1 ${labelColor}`}>{label}</div>
        {isAssistant ? (
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
            <div className="border-l-4 border-teal-500 pl-3 text-slate-900 leading-relaxed">{text}</div>
          </div>
        ) : (
          <div className="bg-teal-600 text-white rounded-2xl px-4 py-3 shadow-sm text-right leading-relaxed">
            {text}
          </div>
        )}
      </div>
    </div>
  );
}

function PatientPortal() {
  const { token, user, logout } = useAuth();

  const [stage, setStage] = useState('landing'); // landing | active | generating | complete
  const [transcripts, setTranscripts] = useState([]);
  const [status, setStatus] = useState('Idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const streamerRef = useRef(null);
  const sessionIdRef = useRef(null);

  const greetingName = useMemo(() => user?.name || 'there', [user?.name]);

  useEffect(() => {
    return () => {
      if (streamerRef.current) {
        streamerRef.current.stop();
      }
    };
  }, []);

  const handleStart = async () => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = createSessionId();
    }
    if (!streamerRef.current) {
      streamerRef.current = new AudioStreamer(
        "ws://localhost:8081",
        (role, text) => {
          setTranscripts((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, role, text }]);
        },
        (speaking) => {
          setIsSpeaking(speaking);
        },
        (message) => {
          setStatus(message);
        }
      );
    }

    setStage('active');
    try {
      await streamerRef.current.start();
    } catch {
      setStage('landing');
    }
  };

  const handleEnd = async () => {
    if (isEnding) return;
    setIsEnding(true);

    if (streamerRef.current) {
      await streamerRef.current.stop();
    }

    const formattedTranscript = transcripts
      .map((t) => {
        const speaker = t.role === 'ASSISTANT' ? 'MediVoice' : 'Patient';
        return `${speaker}: ${t.text}`;
      })
      .join('\n');

    const sessionId = sessionIdRef.current || createSessionId();
    sessionIdRef.current = sessionId;

    try {
      setStage('generating');
      setStatus('Generating report...');
      const res = await fetch('http://localhost:8000/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: sessionId, transcript: formattedTranscript }),
      });

      if (!res.ok) {
        throw new Error(`Report generation failed: ${res.status}`);
      }

      setStage('complete');
    } catch {
      setStatus('Failed to generate report');
      setStage('complete');
    } finally {
      setIsEnding(false);
    }
  };

  const HeaderBar = () => (
    <div className="print-hidden bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl bg-teal-600 flex items-center justify-center">
            <span className="text-white font-bold">M</span>
          </div>
          <div className="font-semibold text-slate-900">MediVoice</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-700">
            Hello, <span className="font-semibold">{greetingName}</span>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );

  const renderLanding = () => (
    <div className="min-h-screen bg-slate-50">
      <HeaderBar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="h-16 w-16 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
              <span className="text-2xl">🎙️</span>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 text-center">
            Hello, {greetingName}! Let&apos;s prepare for your visit.
          </h1>
          <p className="text-slate-600 text-center mt-2">
            MediVoice will ask one question at a time and create a brief for your care team.
          </p>

          <div className="mt-8 space-y-4">
            {[
              { n: 1, title: 'Reason for visit', desc: 'What brings you in today' },
              { n: 2, title: 'Symptoms & duration', desc: 'What you’re feeling and for how long' },
              { n: 3, title: 'Safety & meds', desc: 'Pain level, medications, and allergies' },
            ].map((s) => (
              <div key={s.n} className="flex gap-3">
                <div className="h-8 w-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-semibold">
                  {s.n}
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{s.title}</div>
                  <div className="text-sm text-slate-600">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleStart}
            className="mt-8 w-full rounded-lg bg-teal-600 hover:bg-teal-700 text-white py-3 font-semibold"
          >
            Start Voice Check-In 🎙️
          </button>
        </div>
      </div>
    </div>
  );

  const renderActive = () => (
    <div className="min-h-screen bg-slate-50">
      <HeaderBar />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col min-h-[32rem]">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Conversation</div>
                <div className="text-lg font-semibold text-slate-900">Tell MediVoice what brings you in today</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800">
                  {status}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {transcripts.length === 0 && (
                <div className="mt-8 text-sm text-slate-600">
                  <span className="font-semibold text-teal-700">MediVoice</span>: I&apos;m here with you. When
                  you&apos;re ready, tell me what&apos;s brought you in today.
                </div>
              )}
              {transcripts.map((t) => (
                <TranscriptBubble key={t.id} role={t.role} text={t.text} />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Microphone</div>
                <div className="text-base font-semibold text-slate-900">Listening</div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${isSpeaking ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
                />
                <span className="text-xs text-slate-600">{isSpeaking ? 'Responding' : 'Ready'}</span>
              </div>
            </div>

            <div className="mt-5">
              <Waveform active />
            </div>

            <button
              type="button"
              onClick={handleEnd}
              disabled={isEnding}
              className="mt-6 w-full rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 py-3 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isEnding ? 'Ending…' : 'End Check-In'}
            </button>
            <div className="mt-3 text-xs text-slate-500 text-center">Your doctor will receive a clinical brief.</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGenerating = () => (
    <div className="min-h-screen bg-slate-50">
      <HeaderBar />
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="flex justify-center">
            <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          </div>
          <div className="mt-4 text-lg font-semibold text-slate-900">Generating your clinical brief…</div>
          <div className="mt-1 text-sm text-slate-600">This usually takes a few seconds.</div>
        </div>
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className="min-h-screen bg-slate-50">
      <HeaderBar />
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <span className="text-2xl">✅</span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Check-In Complete</h1>
          <p className="mt-2 text-slate-600">
            Your doctor has been notified and can view your brief.
          </p>

          <div className="mt-6 border border-teal-200 bg-teal-50 rounded-xl p-4">
            <div className="text-xs uppercase tracking-wide text-teal-700 font-semibold">Your session ID</div>
            <div className="mt-1 text-lg font-semibold text-teal-900 break-all">
              {sessionIdRef.current}
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              onClick={() => {
                setTranscripts([]);
                setStatus('Idle');
                sessionIdRef.current = null;
                setStage('landing');
              }}
              className="w-full rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 py-3 font-semibold"
            >
              Start Another Check-In
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (stage === 'landing') return renderLanding();
  if (stage === 'active') return renderActive();
  if (stage === 'generating') return renderGenerating();
  return renderComplete();
}

export default PatientPortal;

