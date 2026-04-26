import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import AlertBell from './components/AlertBell';
import LoginPage from './pages/LoginPage';
import ProjectListPage from './pages/ProjectListPage';
import ProjectCreatePage from './pages/ProjectCreatePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ModulePage from './pages/ModulePage';
import UserManagePage from './pages/admin/UserManagePage';
import IntakePage from './pages/admin/IntakePage';
import AuditTrailPage from './pages/admin/AuditTrailPage';
import PortfolioFinancePage from './pages/admin/PortfolioFinancePage';
import CostRatesPage from './pages/admin/CostRatesPage';
import IntegrationHealthPage from './pages/admin/IntegrationHealthPage';
import GovernanceDashboard from './pages/admin/GovernanceDashboard';
import ChangeRequestPage from './pages/admin/ChangeRequestPage';
import PMDashboard from './pages/dashboards/PMDashboard';
import DHDashboard from './pages/dashboards/DHDashboard';
import PMODashboard from './pages/dashboards/PMODashboard';
import ExecDashboard from './pages/dashboards/ExecDashboard';
import ReportBuilderPage from './pages/reports/ReportBuilderPage';
import PortfolioDrilldownPage from './pages/reports/PortfolioDrilldownPage';
import LeaderboardPage from './pages/reports/LeaderboardPage';
import MemberDashboard from './pages/member/MemberDashboard';
import ClientDashboard from './pages/client/ClientDashboard';
import HomeHubPage from './pages/execution/HomeHubPage';
import AllTasksPage from './pages/execution/AllTasksPage';
import ReportsHubPage from './pages/execution/ReportsHubPage';
import ResourcePlanningPage from './pages/execution/ResourcePlanningPage';
import ProjectTemplatesPage from './pages/execution/ProjectTemplatesPage';
import NotificationSettingsPage from './pages/execution/NotificationSettingsPage';
import LoadingScreen from './components/LoadingScreen';

const STAFF_ROLES = ['admin', 'pmo', 'dh', 'pm', 'exec', 'member'];
const RESOURCE_ROLES = ['admin', 'pmo', 'dh', 'exec', 'pm'];

// Protected route component
const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen title="Loading your workspace" subtitle="Checking access and preparing your dashboard..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

// Main app content with sidebar
const AppLayout = ({ children }) => {
  const { user, behaveAs, exitBehaveAs } = useAuth();

  // Don't show sidebar on login page
  if (!user) {
    return <>{children}</>;
  }

  if (user.role === 'client') {
    return (
      <div className="h-screen overflow-hidden bg-paper">
        <main className="h-full overflow-y-auto min-h-0">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              {behaveAs?.active && (
          <div className="shrink-0 bg-caution-100 border-b border-caution-300 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm text-caution-950">
            <span>
              You are viewing as <strong>{user?.name}</strong> — Read-only mode (changes blocked). Original:{' '}
              {behaveAs.originalName || 'Admin'}.
            </span>
            <button
              type="button"
              onClick={() => {
                exitBehaveAs();
                window.location.reload();
              }}
              className="font-semibold text-caution-900 underline hover:no-underline"
            >
              Exit
            </button>
          </div>
        )}
        {user && STAFF_ROLES.includes(user.role) && (
          <header className="shrink-0 h-12 border-b border-ink-200 bg-paper flex items-center justify-end px-3">
            <AlertBell />
          </header>
        )}
        <main className="flex-1 overflow-y-auto min-h-0">{children}</main>
      </div>
    </div>
  );
};

// Unauthorized page
const UnauthorizedPage = () => (
  <div className="min-h-screen bg-ink-50 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-ink-800 mb-4">Access Denied</h1>
      <p className="text-ink-600 mb-6">You don't have permission to access this page.</p>
      <a href="/" className="text-focus-600 hover:text-focus-800 font-semibold">
        Go back home
      </a>
    </div>
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppLayout>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route
              path="/home"
              element={
                <ProtectedRoute allowedRoles={STAFF_ROLES}>
                  <HomeHubPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/execution/all-tasks"
              element={
                <ProtectedRoute allowedRoles={STAFF_ROLES}>
                  <AllTasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/hub"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo', 'dh', 'pm', 'exec', 'member']}>
                  <ReportsHubPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/execution/resource-planning"
              element={
                <ProtectedRoute allowedRoles={RESOURCE_ROLES}>
                  <ResourcePlanningPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/execution/templates"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo', 'dh', 'pm', 'exec']}>
                  <ProjectTemplatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/notifications"
              element={
                <ProtectedRoute allowedRoles={STAFF_ROLES}>
                  <NotificationSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/projects"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo', 'dh', 'pm', 'exec', 'member']}>
                  <ProjectListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/create"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ProjectCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo', 'dh', 'pm', 'exec', 'member']}>
                  <ProjectDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectId/modules/:moduleId"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo', 'dh', 'pm', 'exec', 'member']}>
                  <ModulePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/intake"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <IntakePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UserManagePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AuditTrailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/portfolio-finance"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo', 'dh']}>
                  <PortfolioFinancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cost-rates"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <CostRatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/integration-health"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <IntegrationHealthPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/governance"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo', 'dh']}>
                  <GovernanceDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/governance/change-requests/:projectId"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo', 'dh', 'pm', 'exec', 'member']}>
                  <ChangeRequestPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard/pm"
              element={
                <ProtectedRoute allowedRoles={['pm']}>
                  <PMDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/dh"
              element={
                <ProtectedRoute allowedRoles={['dh']}>
                  <DHDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/pmo"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo']}>
                  <PMODashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/exec"
              element={
                <ProtectedRoute allowedRoles={['exec']}>
                  <ExecDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports/builder"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo', 'dh', 'pm', 'exec', 'member']}>
                  <ReportBuilderPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/portfolio-drilldown"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo', 'dh', 'pm', 'exec']}>
                  <PortfolioDrilldownPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports/leaderboard"
              element={
                <ProtectedRoute allowedRoles={['admin', 'pmo', 'dh', 'pm']}>
                  <LeaderboardPage />
                </ProtectedRoute>
              }
            />

            {/* Member Routes */}
            <Route
              path="/member/dashboard"
              element={
                <ProtectedRoute allowedRoles={['member']}>
                  <MemberDashboard />
                </ProtectedRoute>
              }
            />

            {/* Client Routes */}
            <Route
              path="/client/dashboard"
              element={
                <ProtectedRoute allowedRoles={['client']}>
                  <ClientDashboard />
                </ProtectedRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </AuthProvider>
  );
}
