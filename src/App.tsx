/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import {
  HallOfFamePage,
  LandingPage,
  LoginPage,
  RegisterAuthorityPage,
  RegisterPage,
  TrackReportPage,
} from './pages/PublicPages';
import {
  CitizenDashboardPage,
  MyReportsPage,
  ReportNewPage,
} from './pages/CitizenCorePages';
import {
  AccidentAssistancePage,
  MedicalAssistancePage,
  NearbyServicesPage,
  NotificationsPage,
  ProfilePage,
  RewardsAndLeaderboardPage,
  SafetyHeatmapPage,
  SevaShieldPage,
} from './pages/CitizenSafetyAndExplorePages';
import {
  AuthorityAnalyticsPage,
  AuthorityApprovalsPage,
  AuthorityAwardsPage,
  AuthorityDepartmentsPage,
  AuthorityEmergencyPage,
  AuthorityOverviewPage,
  AuthorityPrivacyPage,
  AuthorityReportsPage,
} from './pages/AuthorityPages';

function RequireAuth({
  children,
  requireAuthority = false,
}: {
  children: React.ReactNode;
  requireAuthority?: boolean;
}) {
  const { user, loading, isAuthority } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAuthority && !isAuthority) {
    return <Navigate to="/citizen" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/register/authority" element={<RegisterAuthorityPage />} />
            <Route path="/track" element={<TrackReportPage />} />
            <Route path="/track/:token" element={<TrackReportPage />} />
            <Route path="/hall-of-fame" element={<HallOfFamePage />} />

            {/* Citizen Routes */}
            <Route path="/citizen" element={<RequireAuth><CitizenDashboardPage /></RequireAuth>} />
            <Route path="/citizen/report/new" element={<RequireAuth><ReportNewPage /></RequireAuth>} />
            <Route path="/citizen/reports" element={<RequireAuth><MyReportsPage /></RequireAuth>} />
            <Route path="/citizen/reports/:reportId" element={<RequireAuth><MyReportsPage /></RequireAuth>} />
            <Route path="/citizen/shield" element={<RequireAuth><SevaShieldPage /></RequireAuth>} />
            <Route path="/citizen/medical" element={<RequireAuth><MedicalAssistancePage /></RequireAuth>} />
            <Route path="/citizen/accident" element={<RequireAuth><AccidentAssistancePage /></RequireAuth>} />
            <Route path="/citizen/nearby" element={<RequireAuth><NearbyServicesPage /></RequireAuth>} />
            <Route path="/citizen/heatmap" element={<RequireAuth><SafetyHeatmapPage /></RequireAuth>} />
            <Route path="/citizen/rewards" element={<RequireAuth><RewardsAndLeaderboardPage initialTab="rewards" /></RequireAuth>} />
            <Route path="/citizen/leaderboard" element={<RequireAuth><RewardsAndLeaderboardPage initialTab="leaderboard" /></RequireAuth>} />
            <Route path="/citizen/awards" element={<RequireAuth><RewardsAndLeaderboardPage initialTab="awards" /></RequireAuth>} />
            <Route path="/citizen/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
            <Route path="/citizen/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />

            {/* Authority Routes */}
            <Route path="/authority" element={<RequireAuth requireAuthority><AuthorityOverviewPage /></RequireAuth>} />
            <Route path="/authority/reports" element={<RequireAuth requireAuthority><AuthorityReportsPage /></RequireAuth>} />
            <Route path="/authority/emergency" element={<RequireAuth requireAuthority><AuthorityEmergencyPage /></RequireAuth>} />
            <Route path="/authority/analytics" element={<RequireAuth requireAuthority><AuthorityAnalyticsPage /></RequireAuth>} />
            <Route path="/authority/departments" element={<RequireAuth requireAuthority><AuthorityDepartmentsPage /></RequireAuth>} />
            <Route path="/authority/authorities" element={<RequireAuth requireAuthority><AuthorityApprovalsPage /></RequireAuth>} />
            <Route path="/authority/awards" element={<RequireAuth requireAuthority><AuthorityAwardsPage /></RequireAuth>} />
            <Route path="/authority/privacy" element={<RequireAuth requireAuthority><AuthorityPrivacyPage /></RequireAuth>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
