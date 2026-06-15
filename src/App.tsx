import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { TooltipProvider } from './components/Tooltip';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Board from './pages/Board';
import Graph from './pages/Graph';
import Teams from './pages/Teams';
import Projects from './pages/Projects';
import Profile from './pages/Profile';
import CalendarView from './pages/CalendarView';
import Login from './pages/Login';
import Register from './pages/Register';
import UsersAdmin from './pages/UsersAdmin';
import Documents from './pages/Documents';
import Planning from './pages/Planning';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  
  if (loading) {
    return <div className="h-full w-full flex items-center justify-center bg-page-bg text-subtle">Loading...</div>;
  }
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="projects" element={<Projects />} />
                  <Route path="board" element={<Board />} />
                  <Route path="graph" element={<Graph />} />
                  <Route path="calendar" element={<CalendarView />} />
                  <Route path="teams" element={<Teams />} />
                  <Route path="documents" element={<Documents />} />
                  <Route path="planning" element={<Planning />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="admin/users" element={<UsersAdmin />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
