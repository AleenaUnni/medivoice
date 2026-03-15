import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function Logo() {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="h-11 w-11 rounded-2xl bg-teal-600 flex items-center justify-center">
        <span className="text-white text-xl font-bold">M</span>
      </div>
      <div className="text-2xl font-semibold text-slate-900">MediVoice</div>
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("patient");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await register(email, password, name, role);
      if (data.role === "patient") navigate("/patient", { replace: true });
      else navigate("/doctor", { replace: true });
    } catch (err) {
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Logo />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h1 className="text-2xl font-semibold text-slate-900">Create your account</h1>
          <p className="text-slate-600 mt-1">Set up MediVoice in under a minute</p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                autoComplete="name"
                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="Your name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 px-3 py-3 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 pr-12 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="Create a password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <div>
              <div className="block text-sm font-medium text-slate-700 mb-2">Role</div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("patient")}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    role === "patient"
                      ? "border-teal-500 bg-teal-50 ring-2 ring-teal-200"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="text-lg">🧑</div>
                  <div className="font-semibold text-slate-900 mt-1">I&apos;m a Patient</div>
                  <div className="text-xs text-slate-600 mt-1">Voice check-in before visits</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole("doctor")}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    role === "doctor"
                      ? "border-sky-500 bg-sky-50 ring-2 ring-sky-200"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="text-lg">👨‍⚕️</div>
                  <div className="font-semibold text-slate-900 mt-1">I&apos;m a Doctor</div>
                  <div className="text-xs text-slate-600 mt-1">Clinical brief and print view</div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-teal-600 hover:bg-teal-700 text-white py-3 font-semibold disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              Create Account
            </button>

            <div className="text-sm text-slate-600 text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-teal-700 font-medium hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

