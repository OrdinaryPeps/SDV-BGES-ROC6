import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import TicketsPage from "./pages/TicketsPage";
import TicketDetailPage from "./pages/TicketDetailPage";
import AgentPerformancePage from "./pages/AgentPerformancePage";
import UserManagementPage from "./pages/UserManagementPage";
import AccountPage from "./pages/AccountPage";
import Layout from "./components/Layout";
import { Toaster } from "./components/ui/sonner";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://roc-6-sdv-bges.site";
export const API = `${BACKEND_URL}/api`;

// Axios interceptor for auth
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              user ? <Navigate to="/dashboard" /> : <LoginPage onLogin={handleLogin} />
            }
          />
          <Route
            path="/"
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <Navigate to="/dashboard" />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/dashboard"
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <DashboardPage user={user} />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/tickets"
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <TicketsPage user={user} />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/tickets/:ticketId"
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <TicketDetailPage user={user} />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/performance"
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <AgentPerformancePage user={user} />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/users"
            element={
              user && user.role === "admin" ? (
                <Layout user={user} onLogout={handleLogout}>
                  <UserManagementPage user={user} />
                </Layout>
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />
          <Route
            path="/account"
            element={
              user ? (
                <Layout user={user} onLogout={handleLogout}>
                  <AccountPage user={user} />
                </Layout>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
