// src/App.jsx
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import HomePage from "./HomePage";
import LoginPage from "./LoginPage";
import CreateAccountPage from "./CreateAccountPage";
import Dashboard from "./Dashboard";
import ChatPage from "./ChatPage";
import Settings from "./Settings";
import Billing from "./Billing";
import ChatHistory from "./ChatHistory";
import GoogleAuthComplete from "./GoogleAuthComplete";
import AdminDashboard from "./AdminDashboard";


import { AuthProvider, useAuth } from "./hooks/useAuth"; // <-- make sure path is correct
import "./Global.css";
import "./App.css";

const DEFAULT_ADMIN_EMAIL = "zaynzayn9696@gmail.com";
const RAW_ADMIN_EMAILS =
  import.meta.env.VITE_ADMIN_EMAILS ||
  import.meta.env.VITE_ADMIN_EMAIL ||
  DEFAULT_ADMIN_EMAIL;

const ADMIN_EMAILS = RAW_ADMIN_EMAILS.split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

// Wrapper that protects routes
function ProtectedRoute({ children }) {
  const { user, isAuthLoading } = useAuth();

  const isDev = import.meta.env.DEV;
  const isLocalhost = ["localhost", "127.0.0.1"].includes(
    window.location.hostname
  );
  const devBypass =
    isDev &&
    isLocalhost &&
    import.meta.env.VITE_ASRAR_DEV_BYPASS_AUTH === "true";

  if (isAuthLoading) {
    // Show loading spinner while checking auth
    return (
      <div className="asrar-fullpage-loading">
        <div className="asrar-loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (devBypass) {
      console.info("[DEV AUTH] ProtectedRoute bypassed in dev mode.");
      return children;
    }
    // Not logged in -> send to login page
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Admin-only wrapper for routes
function AdminRoute({ children }) {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="asrar-fullpage-loading">
        <div className="asrar-loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const email = (user.email || "").toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Wrapper that keeps guests only; redirects logged-in users to dashboard
function GuestOnlyRoute({ children }) {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div className="asrar-fullpage-loading">
        <div className="asrar-loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public pages */}
          <Route path="/" element={<HomePage />} />
          <Route
            path="/login"
            element={
              <GuestOnlyRoute>
                <LoginPage />
              </GuestOnlyRoute>
            }
          />
          <Route
            path="/create-account"
            element={
              <GuestOnlyRoute>
                <CreateAccountPage />
              </GuestOnlyRoute>
            }
          />
          <Route path="/google-auth-complete" element={<GoogleAuthComplete />} />

          {/* Protected pages */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <ChatHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <Billing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          {/* Optional: catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
