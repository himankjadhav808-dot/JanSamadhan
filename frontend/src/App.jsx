import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Auth/Login';
import ResetPassword from './pages/Auth/ResetPassword';
import CitizenDashboard from './pages/Citizen/Dashboard';
import CitizenAnalyticsDashboard from './pages/Citizen/CitizenAnalyticsDashboard';
import ReportIssue from './pages/Citizen/ReportIssue';
import SubAdminDashboard from './pages/Authority/SubAdminDashboard';
import SuperAdminDashboard from './pages/Authority/SuperAdminDashboard';
import ResolveIssue from './pages/Authority/ResolveIssue';
import UserProfile from './pages/Profile/UserProfile';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Rewards from './pages/Rewards';
import MyReports from './pages/MyReports';
import IssueDetail from './pages/IssueDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/" element={<MainLayout />}>
          <Route index element={<CitizenDashboard />} />
          <Route path="profile/:id" element={<UserProfile />} />
          <Route path="issues/:id" element={<IssueDetail />} />
          <Route element={<ProtectedRoute />}>
            <Route path="report" element={<ReportIssue />} />
            <Route path="settings" element={<Settings />} />
            <Route path="dashboard" element={<CitizenAnalyticsDashboard />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="rewards" element={<Rewards />} />
            <Route path="my-reports" element={<MyReports />} />
          </Route>
          <Route element={<ProtectedRoute roles={['sub-admin', 'super-admin']} />}>
            <Route path="authority/dashboard" element={<SubAdminDashboard />} />
            <Route path="authority/resolve/:id" element={<ResolveIssue />} />
          </Route>
          <Route element={<ProtectedRoute roles={['super-admin']} />}>
            <Route path="admin/dashboard" element={<SuperAdminDashboard />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
