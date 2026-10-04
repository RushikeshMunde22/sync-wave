import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useSocketStore } from './stores/socketStore';

import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import HomePage from './pages/HomePage';
import DiscoverPage from './pages/DiscoverPage';
import RoomPage from './pages/RoomPage';
import GroupSettingsPage from './pages/GroupSettingsPage';
import ProfilePage from './pages/ProfilePage';
import Layout from './components/Layout';

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminGroups from './pages/admin/AdminGroups';
import AdminModeration from './pages/admin/AdminModeration';
import AdminSecurity from './pages/admin/AdminSecurity';
import AdminSystem from './pages/admin/AdminSystem';
import AdminFeedback from './pages/admin/AdminFeedback';
import JoinGroupPage from './pages/JoinGroupPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-white">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { fetchUser, isAuthenticated } = useAuthStore();
  const { connect, disconnect } = useSocketStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }
  }, [isAuthenticated, connect, disconnect]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="feedback" element={<AdminFeedback />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="groups" element={<AdminGroups />} />
          <Route path="moderation" element={<AdminModeration />} />
          <Route path="security" element={<AdminSecurity />} />
          <Route path="system" element={<AdminSystem />} />
        </Route>

        <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="/discover" element={<ProtectedRoute><DiscoverPage /></ProtectedRoute>} />
        <Route path="/room/:id" element={<ProtectedRoute><RoomPage /></ProtectedRoute>} />
        <Route path="/room/:id/settings" element={<ProtectedRoute><GroupSettingsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/join/:code" element={<ProtectedRoute><JoinGroupPage /></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
