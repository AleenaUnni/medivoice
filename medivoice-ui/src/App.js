import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import ProtectedRoute from "./ProtectedRoute";
import PatientPortal from "./PatientPortal";
import DoctorDashboard from "./DoctorDashboard";
import PatientSessionsList from "./PatientSessionsList";

function HomeRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated && user?.role === "patient") return <Navigate to="/patient" replace />;
  if (isAuthenticated && user?.role === "doctor") return <Navigate to="/doctor" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/patient"
            element={
              <ProtectedRoute requiredRole="patient">
                <PatientPortal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor"
            element={
              <ProtectedRoute requiredRole="doctor">
                <DoctorSessionsRouter />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function DoctorSessionsRouter() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  if (sessionId) return <DoctorDashboard />;
  return <PatientSessionsList />;
}

