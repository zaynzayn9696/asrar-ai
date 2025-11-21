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

import { AuthProvider, useAuth } from "./hooks/useAuth"; // <-- make sure path is correct
import "./Global.css";
import "./App.css";

// Wrapper that protects routes
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    // You can replace this with a nice spinner
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (!user) {
    // Not logged in -> send to login page
    return <Navigate to="/login" replace />;
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
          <Route path="/login" element={<LoginPage />} />
          <Route path="/create-account" element={<CreateAccountPage />} />

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

          {/* Optional: catch-all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
