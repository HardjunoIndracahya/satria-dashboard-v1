import { Toaster } from 'sonner';
import { TopBar } from './components/TopBar';
import { EmergencyBanner } from './components/EmergencyBanner';
import { PairingModal } from './components/PairingModal';
import { OverviewView } from './views/OverviewView';
import { DashboardView } from './views/DashboardView';
import { OverviewView } from './views/OverviewView';
import { HikersView } from './views/HikersView';
import { AnalyticsView } from './views/AnalyticsView';
import { HikersView } from './views/HikersView';
import { AnalyticsView } from './views/AnalyticsView';
import { RelayNodesView } from './views/RelayNodesView';
import { SystemLogView } from './views/SystemLogView';
import { useUi } from './store/ui';
import { useAlarm, useHikers, useHotkeys, useFirebaseStream, useSosNotifications, useUnackedSos } from './hooks';

export default function App() {
  const view = useUi((s) => s.view);
  const hikers = useHikers();
  const unacked = useUnackedSos(hikers);

  useFirebaseStream();
  useSosNotifications(hikers);
  useAlarm(unacked.length);
  useSosNotifications(hikers);
  useHotkeys();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <TopBar sosActive={unacked.length > 0} />
      <EmergencyBanner unacked={unacked} />
      <main className="flex min-h-0 flex-1 flex-col">
        {view === 'overview' && <OverviewView hikers={hikers} />}
        {view === 'overview' && <OverviewView hikers={hikers} />}
        {view === 'dashboard' && <DashboardView hikers={hikers} />}
        {view === 'hikers' && <HikersView hikers={hikers} />}
        {view === 'analytics' && <AnalyticsView hikers={hikers} />}
        {view === 'hikers' && <HikersView hikers={hikers} />}
        {view === 'analytics' && <AnalyticsView hikers={hikers} />}
        {view === 'nodes' && <RelayNodesView />}
        {view === 'log' && <SystemLogView />}
      </main>
      <PairingModal />
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
    </div>
  );
}

