import { Toaster } from 'sonner';
import { TopBar } from './components/TopBar';
import { EmergencyBanner } from './components/EmergencyBanner';
import { ConnectModal } from './components/ConnectModal';
import { PairingModal } from './components/PairingModal';
import { DashboardView } from './views/DashboardView';
import { RelayNodesView } from './views/RelayNodesView';
import { SystemLogView } from './views/SystemLogView';
import { useUi } from './store/ui';
import { useAlarm, useHikers, useHotkeys, useSheetSync, useUnackedSos } from './hooks';

export default function App() {
  const view = useUi((s) => s.view);
  const hikers = useHikers();
  const unacked = useUnackedSos(hikers);

  useSheetSync();
  useAlarm(unacked.length);
  useHotkeys();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <TopBar sosActive={unacked.length > 0} />
      <EmergencyBanner unacked={unacked} />
      <main className="flex min-h-0 flex-1 flex-col">
        {view === 'dashboard' && <DashboardView hikers={hikers} />}
        {view === 'nodes' && <RelayNodesView />}
        {view === 'log' && <SystemLogView />}
      </main>
      <ConnectModal />
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
