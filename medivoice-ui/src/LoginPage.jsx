import React, { useMemo, useState } from "react";
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

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const demoAccounts = useMemo(
    () => [
      { label: "Patient", email: "patient@medivoice.com", password: "patient123" },
      { label: "Doctor", email: "doctor@medivoice.com", password: "doctor123" },
    ],
    [],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(email, password);
      if (data.role === "patient") navigate("/patient", { replace: true });
      else navigate("/doctor", { replace: true });
    } catch (err) {
      setError(err?.message || "Invalid email or password");
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
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back</h1>
          <p className="text-slate-600 mt-1">Sign in to your account</p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 pr-12 outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="••••••••"
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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-teal-600 hover:bg-teal-700 text-white py-3 font-semibold disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              Sign In
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px bg-slate-200 flex-1" />
              <div className="text-xs text-slate-500">or</div>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            <div className="text-sm text-slate-600 text-center">
              <Link to="/register" className="text-teal-700 font-medium hover:underline">
                Create an account
              </Link>
            </div>
          </form>
        </div>

        {/* <div className="mt-5 bg-slate-100 rounded-2xl border border-slate-200 p-4"> */}
          {/* <div className="text-sm font-semibold text-slate-800 mb-2">Demo Accounts:</div>
          <div className="space-y-2 text-sm text-slate-700">
            {demoAccounts.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(a.password);
                }}
                className="w-full text-left rounded-xl bg-white border border-slate-200 px-3 py-2 hover:border-teal-300 hover:bg-teal-50 transition-colors"
              >
                <div className="font-medium">{a.label}</div>
                <div className="text-xs text-slate-600">
                  {a.email} / {a.password}
                </div>
              </button>
            ))}
          </div> */}
        </div>
      </div>
    // </div>
  );
}

