import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Copy, FileSpreadsheet, Link2, RefreshCw, Unplug, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Field, Modal, Segmented } from './ui';
import { useConfig } from '../store/config';
import { fallbackTs, useTelemetry } from '../store/telemetry';
import { useUi, type ConnectTab } from '../store/ui';
import { parseFile, resolveSheetUrl } from '../lib/sheets';
import { syncNow } from '../lib/queryClient';
import { APPS_SCRIPT, ESP32_SNIPPET } from '../lib/guide';
import { formatClock } from '../lib/format';

const INTERVALS = [
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '60s' },
  { value: 0, label: 'Manual' },
];

/* ------------------------------ Sheets tab -------------------------------- */
function SheetTab({ onDone }: { onDone: () => void }) {
  const mode = useConfig((s) => s.mode);
  const savedUrl = useConfig((s) => s.sheetUrl);
  const savedInterval = useConfig((s) => s.intervalMs);
  const offlineAfter = useConfig((s) => s.offlineAfterMin);
  const connectSheet = useConfig((s) => s.connectSheet);
  const setIntervalMs = useConfig((s) => s.setInterval);
  const setOfflineAfter = useConfig((s) => s.setOfflineAfter);
  const disconnect = useConfig((s) => s.disconnect);

  const syncing = useTelemetry((s) => s.syncing);
  const error = useTelemetry((s) => s.error);
  const lastSyncAt = useTelemetry((s) => s.lastSyncAt);
  const latencyMs = useTelemetry((s) => s.latencyMs);
  const total = useTelemetry((s) => s.total);
  const valid = useTelemetry((s) => s.valid);

  const [url, setUrl] = useState(savedUrl);
  const [interval, setLocalInterval] = useState(savedInterval);
  const [awaitingSince, setAwaitingSince] = useState<number | null>(null);

  const resolved = resolveSheetUrl(url);
  const connected = mode === 'sheet';
  const dirty = connected && url.trim() !== savedUrl.trim();

  useEffect(() => {
    if (awaitingSince !== null && lastSyncAt && lastSyncAt >= awaitingSince && !error) {
      setAwaitingSince(null);
      toast.success('Spreadsheet connected', { description: `${valid} valid of ${total} rows` });
      onDone();
    }
  }, [awaitingSince, lastSyncAt, error, valid, total, onDone]);

  const connect = () => {
    if (!resolved) return;
    useTelemetry.getState().reset();
    setAwaitingSince(Date.now());
    connectSheet(url.trim(), interval);
  };

  return (
    <div className="space-y-4">
      <Field label="Google Sheets URL" hint="Share link, published CSV (/pub?output=csv), or Apps Script Web App (/exec).">
        <div className="relative">
          <Link2 size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className="field !pl-8"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…/edit"
            spellCheck={false}
            autoFocus
          />
        </div>
      </Field>

      {url.trim() !== '' && (
        <div className={`rounded-ctl border px-3 py-2 text-[12px] ${resolved ? 'border-forest/25 bg-forest-tint' : 'border-amber/40 bg-amber-tint'}`}>
          {resolved ? (
            <>
              <div className="font-semibold text-forest">{resolved.label}</div>
              <div className="num mt-0.5 break-all text-[11px] text-ink-2">{resolved.url}</div>
            </>
          ) : (
            <span className="font-semibold text-amber-ink">Not a valid Google Sheets / endpoint URL.</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] items-end gap-4">
        <Field label="Polling interval">
          <Segmented
            value={interval}
            options={INTERVALS}
            onChange={(v) => {
              setLocalInterval(v);
              if (connected) setIntervalMs(v);
            }}
            ariaLabel="Polling interval"
          />
        </Field>
        <Field label="Offline after (min)">
          <input
            className="field num !w-[110px]"
            type="number"
            min={1}
            max={240}
            value={offlineAfter}
            onChange={(e) => setOfflineAfter(Number(e.target.value) || 1)}
          />
        </Field>
      </div>

      {connected && (
        <div className="rounded-ctl border border-line bg-canvas px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="label">Connection</span>
            <span className={`text-[12px] font-semibold ${error ? 'text-amber' : syncing ? 'text-amber' : 'text-forest'}`}>
              {syncing ? 'Syncing…' : error ? 'Error — retrying' : 'Live'}
            </span>
          </div>
          <div className="num mt-1.5 grid grid-cols-3 gap-2 text-[12px]">
            <div>
              <div className="label !normal-case !tracking-normal">Last sync</div>
              {lastSyncAt ? formatClock(lastSyncAt) : '—'}
            </div>
            <div>
              <div className="label !normal-case !tracking-normal">Latency</div>
              {latencyMs !== undefined ? `${(latencyMs / 1000).toFixed(2)} s` : '—'}
            </div>
            <div>
              <div className="label !normal-case !tracking-normal">Valid / Total</div>
              {valid} / {total}
            </div>
          </div>
          {error && <p className="mt-2 text-[12px] leading-relaxed text-amber-ink">{error}</p>}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {(!connected || dirty) && (
          <button className="btn btn-primary" onClick={connect} disabled={!resolved}>
            <FileSpreadsheet size={14} />
            {dirty ? 'Reconnect' : 'Connect & Sync'}
          </button>
        )}
        {connected && !dirty && (
          <button className="btn btn-primary" onClick={() => void syncNow()} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            Sync Now
          </button>
        )}
        {connected && (
          <button
            className="btn ml-auto text-ink-2"
            onClick={() => {
              disconnect();
              toast('Spreadsheet disconnected');
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

/* ------------------------------ Upload tab -------------------------------- */
function UploadTab({ onDone }: { onDone: () => void }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mode = useConfig((s) => s.mode);
  const fileName = useTelemetry((s) => s.fileName);

  const handle = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setErr(null);
      setBusy(true);
      try {
        useTelemetry.getState().reset();
        const result = await parseFile(file, fallbackTs);
        useConfig.getState().setFileMode();
        useTelemetry.getState().ingest(result, { fileName: file.name });
        if (result.total === 0) {
          setErr('The file contains no data rows.');
        } else {
          toast.success(`${file.name} loaded`, {
            description: `${result.valid} valid · ${result.sos} SOS · ${result.corrupt} quarantined of ${result.total} rows`,
          });
          onDone();
        }
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [onDone],
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handle(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-panel border-2 border-dashed px-6 py-12 text-center transition-colors ${
          drag ? 'border-forest bg-forest-tint' : 'border-line-strong bg-canvas/60 hover:border-forest/60 hover:bg-forest-tint/50'
        }`}
      >
        <Upload size={22} className={drag ? 'text-forest' : 'text-ink-muted'} />
        <p className="mt-3 text-[13.5px] font-semibold">{busy ? 'Parsing…' : 'Drop a spreadsheet here, or click to browse'}</p>
        <p className="mt-1 text-[12px] text-ink-2">
          <span className="num">.xlsx</span> · <span className="num">.xls</span> · <span className="num">.csv</span> — parsed locally, nothing is uploaded.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {err && <p className="rounded-ctl border border-amber/40 bg-amber-tint px-3 py-2 text-[12.5px] font-medium text-amber-ink">{err}</p>}
      {mode === 'file' && (
        <div className="flex items-center justify-between rounded-ctl border border-line bg-canvas px-3 py-2">
          <span className="text-[12.5px] text-ink-2">
            Loaded: <span className="num font-semibold text-ink">{fileName}</span>
          </span>
          <button
            className="btn h-7 text-[12px]"
            onClick={() => {
              useConfig.getState().disconnect();
              useTelemetry.getState().reset();
              toast('Loaded file cleared');
            }}
          >
            Clear data
          </button>
        </div>
      )}
      <p className="text-[11.5px] leading-relaxed text-ink-muted">
        Headers are matched automatically (ID/Device/Pendaki, Lat/Lintang, Lon/Bujur, MDPL/Elevasi, Suhu/Temp, Status/Kondisi, RSSI, SNR, Timestamp/Waktu). Raw
        pipe-delimited LoRa payloads in a single column are detected too. Rows that fail validation are quarantined in System Log.
      </p>
    </div>
  );
}

/* ------------------------------- Guide tab -------------------------------- */
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
      <pre className="scroll-thin num max-h-[220px] overflow-auto bg-surface p-3 text-[11px] leading-[1.55] text-ink">{code}</pre>
    </div>
  );
}

function GuideTab() {
  const steps = [
    'Create a Google Sheet. Open Extensions › Apps Script and paste the script below (replace the default code).',
    'Deploy › New deployment › Web app. Execute as “Me”, access “Anyone”. Copy the /exec URL.',
    'Flash the ESP32 receiver to HTTP-POST each received LoRa string to that URL (snippet below).',
    'Paste the same /exec URL into the Google Sheets tab here. The dashboard polls it as JSON.',
  ];
  return (
    <div className="space-y-4">
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-ink-2">
            <span className="num mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-forest/30 bg-forest-tint text-[10.5px] font-bold text-forest">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <CodeBlock title="Google Apps Script" lang="Code.gs" code={APPS_SCRIPT} />
      <CodeBlock title="ESP32 HTTP POST" lang="Arduino C++" code={ESP32_SNIPPET} />
      <p className="text-[11.5px] leading-relaxed text-ink-muted">
        Post the raw LoRa string unmodified — corrupt packets are kept in the sheet and quarantined by the dashboard, which is how the Packet Success Rate is computed.
      </p>
    </div>
  );
}

/* --------------------------------- Modal ---------------------------------- */
export function ConnectModal() {
  const open = useUi((s) => s.connectOpen);
  const tab = useUi((s) => s.connectTab);
  const close = useUi((s) => s.closeConnect);
  const openConnect = useUi((s) => s.openConnect);

  return (
    <Modal
      open={open}
      onClose={close}
      width={660}
      title="Spreadsheet Connection"
      subtitle="RAKSA reads telemetry from the spreadsheet your Basecamp ESP32 writes to."
    >
      <Segmented<ConnectTab>
        value={tab}
        onChange={(t) => openConnect(t)}
        ariaLabel="Connection method"
        className="mb-4"
        options={[
          { value: 'sheet', label: 'Google Sheets Live Sync' },
          { value: 'upload', label: 'Upload Spreadsheet' },
          { value: 'guide', label: 'ESP32 Setup Guide' },
        ]}
      />
      {open && tab === 'sheet' && <SheetTab onDone={close} />}
      {open && tab === 'upload' && <UploadTab onDone={close} />}
      {open && tab === 'guide' && <GuideTab />}
    </Modal>
  );
}
