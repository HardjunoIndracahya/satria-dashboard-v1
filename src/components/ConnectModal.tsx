import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Database, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Field, Modal, Segmented } from './ui';
import { useConfig } from '../store/config';
import { useTelemetry } from '../store/telemetry';
import { useUi, type ConnectTab } from '../store/ui';
import { getEnvironmentFirebaseConfig, type FirebaseWebConfig } from '../lib/firebase';
import { FIREBASE_ESP32_SNIPPET } from '../lib/guide';
import { formatClock } from '../lib/format';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readFirebaseConfig(input: string): { config?: FirebaseWebConfig; error?: string } {
  const value = input.trim();
  if (!value) return { error: 'Enter a Realtime Database URL or Firebase Web Config JSON.' };

  if (value.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!isRecord(parsed) || typeof parsed.databaseURL !== 'string') {
        return { error: 'The Web Config JSON must include a databaseURL string.' };
      }
      const config: FirebaseWebConfig = { databaseURL: parsed.databaseURL };
      for (const key of ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'] as const) {
        const field = parsed[key];
        if (typeof field === 'string') config[key] = field;
      }
      return validDatabaseUrl(config);
    } catch (error) {
      return { error: `Invalid JSON: ${error instanceof Error ? error.message : 'unable to parse'}` };
    }
  }

  return validDatabaseUrl({ databaseURL: value });
}

function validDatabaseUrl(config: FirebaseWebConfig): { config?: FirebaseWebConfig; error?: string } {
  try {
    const url = new URL(config.databaseURL);
    if (url.protocol !== 'https:') return { error: 'Use the HTTPS Realtime Database URL from Firebase Console.' };
    return { config: { ...config, databaseURL: url.toString().replace(/\/$/, '') } };
  } catch {
    return { error: 'Enter a valid Realtime Database URL.' };
  }
}

function FirebaseTab({ onDone }: { onDone: () => void }) {
  const savedConfig = useConfig((state) => state.firebaseConfig);
  const databaseRoot = useConfig((state) => state.databaseRoot);
  const offlineAfterMin = useConfig((state) => state.offlineAfterMin);
  const setOfflineAfter = useConfig((state) => state.setOfflineAfter);
  const connectionDisabled = useConfig((state) => state.connectionDisabled);
  const connectFirebase = useConfig((state) => state.connectFirebase);
  const disconnect = useConfig((state) => state.disconnect);
  const connectionState = useTelemetry((state) => state.connectionState);
  const error = useTelemetry((state) => state.error);
  const lastSyncAt = useTelemetry((state) => state.lastSyncAt);
  const total = useTelemetry((state) => state.total);
  const valid = useTelemetry((state) => state.valid);
  const [input, setInput] = useState(() => (useConfig.getState().firebaseConfig ?? getEnvironmentFirebaseConfig())?.databaseURL ?? '');
  const [root, setRoot] = useState(databaseRoot);
  const parsed = useMemo(() => readFirebaseConfig(input), [input]);
  const configured = !connectionDisabled && Boolean(savedConfig || getEnvironmentFirebaseConfig());

  useEffect(() => {
    if (savedConfig) setInput(JSON.stringify(savedConfig, null, 2));
  }, [savedConfig]);

  const statusText: Record<typeof connectionState, string> = {
    disconnected: configured ? 'Disconnected' : 'Not configured',
    connecting: 'Connecting…',
    connected: 'Connected',
    error: 'Connection error',
  };

  return (
    <div className="space-y-4">
      <Field
        label="Firebase RTDB URL or Web Config JSON"
        hint="Paste the databaseURL alone, or the complete Firebase Web App config object."
        error={parsed.error}
      >
        <textarea
          className="field min-h-[76px] resize-y font-mono text-[11.5px]"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={'https://<project>-default-rtdb.asia-southeast1.firebasedatabase.app\n\nor paste the Firebase Web Config JSON'}
          spellCheck={false}
          autoFocus
        />
      </Field>
      <Field label="Database root path" hint="Hiker snapshots are read from <root>/hikers/{deviceId}.">
        <input className="field num" value={root} onChange={(event) => setRoot(event.target.value)} placeholder="/" />
      </Field>
      <Field label="Mark hikers offline after (min)">
        <input
          className="field num !w-[130px]"
          type="number"
          min={1}
          max={240}
          value={offlineAfterMin}
          onChange={(event) => setOfflineAfter(Number(event.target.value) || 1)}
        />
      </Field>

      {configured && (
        <div className="rounded-ctl border border-line bg-canvas px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="label">Realtime connection (.info/connected)</span>
            <span className={`text-[12px] font-semibold ${connectionState === 'connected' ? 'text-forest' : connectionState === 'error' ? 'text-amber' : 'text-ink-2'}`}>
              {statusText[connectionState]}
            </span>
          </div>
          <div className="num mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
            <span>Last packet: {lastSyncAt ? formatClock(lastSyncAt) : '—'}</span>
            <span>Valid / total: {valid} / {total}</span>
          </div>
          {error && <p className="mt-2 text-[12px] leading-relaxed text-amber-ink">{error}</p>}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          className="btn btn-primary"
          disabled={!parsed.config}
          onClick={() => {
            if (!parsed.config) return;
            connectFirebase(parsed.config, root.trim() || '/');
            toast.success('Firebase listener starting');
            onDone();
          }}
        >
          <Database size={14} />
          Connect to Firebase
        </button>
        {configured && (
          <button
            className="btn ml-auto text-ink-2"
            onClick={() => {
              disconnect();
              toast('Firebase disconnected');
            }}
          >
            <Unplug size={14} />
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ title, code, lang }: { title: string; code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-ctl border border-line">
      <div className="flex items-center justify-between border-b border-line bg-canvas px-3 py-1.5">
        <span className="text-[12px] font-semibold">
          {title} <span className="num ml-1 text-[11px] font-normal text-ink-muted">{lang}</span>
        </span>
        <button
          className="btn h-7 px-2 text-[12px]"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(
              () => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
                toast.success(`${title} copied`);
              },
              () => toast.error('Clipboard unavailable'),
            );
          }}
        >
          {copied ? <Check size={13} className="text-forest" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="scroll-thin num max-h-[250px] overflow-auto bg-surface p-3 text-[11px] leading-[1.55] text-ink">{code}</pre>
    </div>
  );
}

function GuideTab() {
  const steps = [
    'Create a Firebase project and a Realtime Database. Copy its database URL from the database page.',
    'Create a Firebase Web App and copy its config JSON. Paste the URL or config in the Firebase tab, or set the VITE_FIREBASE_* build variables.',
    'Write each Basecamp fix to /hikers/{deviceId}. Updates stream into RAKSA immediately; set the Database root path if your data is nested.',
    'Configure RTDB Security Rules for your deployment. Do not allow unauthenticated writes; public read access exposes live hiker locations.',
  ];
  return (
    <div className="space-y-4">
      <ol className="space-y-1.5">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-2.5 text-[12.5px] leading-relaxed text-ink-2">
            <span className="num mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-forest/30 bg-forest-tint text-[10.5px] font-bold text-forest">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="rounded-ctl border border-line bg-canvas p-3">
        <div className="label mb-2">Recommended RTDB record</div>
        <pre className="num whitespace-pre-wrap text-[11px] leading-[1.55] text-ink">{`/hikers/RAKSA_01
{
  "id": "RAKSA_01",
  "lat": -7.482529,
  "lon": 110.214327,
  "mdpl": 370.8,
  "suhu": 26.4,
  "status": "SOS",
  "rssi": -108,
  "snr": 6.5,
  "battery": 84,
  "timestamp": 1764241200000
}`}</pre>
      </div>
      <CodeBlock title="ESP32 HTTPS PUT" lang="Arduino C++" code={FIREBASE_ESP32_SNIPPET} />
      <p className="text-[11.5px] leading-relaxed text-ink-muted">
        Structured JSON and pipe-delimited LoRa payload strings are both parsed. The listener watches child additions and updates under <span className="num">/hikers</span>; timestamps should be Unix epoch milliseconds.
      </p>
      <div className="rounded-ctl border border-amber/30 bg-amber-tint px-3 py-2 text-[11.5px] leading-relaxed text-amber-ink">
        Firebase Web config values are public identifiers, not access controls. Production rules should authenticate writers and limit read access; public reads reveal location data.
      </div>
    </div>
  );
}

export function ConnectModal() {
  const open = useUi((state) => state.connectOpen);
  const tab = useUi((state) => state.connectTab);
  const close = useUi((state) => state.closeConnect);
  const openConnect = useUi((state) => state.openConnect);

  return (
    <Modal open={open} onClose={close} width={660} title="Firebase Connection" subtitle="RAKSA streams Basecamp telemetry directly from Firebase Realtime Database.">
      <Segmented<ConnectTab>
        value={tab}
        onChange={(nextTab) => openConnect(nextTab)}
        ariaLabel="Connection method"
        className="mb-4"
        options={[
          { value: 'firebase', label: 'Firebase RTDB' },
          { value: 'guide', label: 'ESP32 Setup Guide' },
        ]}
      />
      {open && tab === 'firebase' && <FirebaseTab onDone={close} />}
      {open && tab === 'guide' && <GuideTab />}
    </Modal>
  );
}
