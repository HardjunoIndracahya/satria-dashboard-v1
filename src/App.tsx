import { Toaster } from 'sonner';
import { TopBar } from './components/TopBar';
import { EmergencyBanner } from './components/EmergencyBanner';
import { PairingModal } from './components/PairingModal';
import { RescueConfirmModal } from './components/RescueConfirmModal';
import { LoginView } from './views/LoginView';
import { AccessDeniedView } from './views/AccessDeniedView';
import { AuthLoadingView } from './views/AuthLoadingView';
import { OverviewView } from './views/OverviewView';
import { DashboardView } from './views/DashboardView';
import { EmergenciesView } from './views/EmergenciesView';
import { HikersView } from './views/HikersView';
import { AnalyticsView } from './views/AnalyticsView';
import { RelayNodesView } from './views/RelayNodesView';
import { SystemLogView } from './views/SystemLogView';
import { AdminUsersView } from './views/AdminUsersView';
import { useAuth } from './store/auth';
import { useUi } from './store/ui';
import { canManageUsers } from './lib/rbac';
import {
  useActiveSosIncidents,
  useAlarm,
  useAuthSession,
  useFirebaseStream,
  useHikers,
  useHotkeys,
  useRouteGuard,
  useSosNotifications,
  useUnackedSosIncidents,
} from './hooks';

/**
 * Protected dashboard shell — ONLY mounted once Firebase Authentication AND
 * role authorization (`ADMIN`, `OPERATOR`, or `VIEWER`) have succeeded.
 */
function ProtectedDashboard() {
  const user = useAuth((s) => s.user!);
  const view = useUi((s) => s.view);
  const hikers = useHikers();
  const activeIncidents = useActiveSosIncidents();
  const unackedIncidents = useUnackedSosIncidents(activeIncidents);

  useFirebaseStream(true);
  useSosNotifications(activeIncidents, hikers);
  useAlarm(unackedIncidents.length);
  useHotkeys();

  const isAdmin = canManageUsers(user.role);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <TopBar sosAlarmActive={unackedIncidents.length > 0} activeSosCount={activeIncidents.length} />
      <EmergencyBanner incidents={activeIncidents} hikers={hikers} />
      <main className="flex min-h-0 flex-1 flex-col">
        {view === 'overview' && <OverviewView hikers={hikers} incidents={activeIncidents} />}
        {view === 'dashboard' && <DashboardView hikers={hikers} />}
        {view === 'emergencies' && <EmergenciesView incidents={activeIncidents} hikers={hikers} />}
        {view === 'hikers' && <HikersView hikers={hikers} />}
        {view === 'analytics' && <AnalyticsView hikers={hikers} />}
        {view === 'nodes' && <RelayNodesView />}
        {view === 'log' && <SystemLogView />}
        {view === 'users' && isAdmin && <AdminUsersView />}
      </main>
      <PairingModal />
      <RescueConfirmModal hikers={hikers} />
    </div>
  );
}

export default function App() {
  useAuthSession();
  useRouteGuard();

  const status = useAuth((s) => s.status);
  const user = useAuth((s) => s.user);

  return (
    <>
      {status === 'loading' && <AuthLoadingView />}
      {status === 'unauthenticated' && <LoginView />}
      {status === 'unauthorized' && <AccessDeniedView />}
      {status === 'authorized' && user && <ProtectedDashboard />}

      <Toaster
        position="top-center"
        offset={68}
        gap={8}
        toastOptions={{
          style: {
            borderRadius: 8,
            border: '1px solid #DCE2DE',
            background: '#FFFFFF',
            color: '#0F172A',
            fontFamily: '"Plus Jakarta Sans Variable", sans-serif',
            fontSize: 13,
            boxShadow: '0 10px 24px -10px rgba(15,23,42,.22)',
          },
        }}
      />
    </>
  );
}
