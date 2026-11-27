import { useMemo, useState } from 'react';
import { Crosshair, Flag, Pencil, Plus, RadioTower, Tent, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Field } from '../components/ui';
import { NodesMap, type MapFocus } from '../components/map/NodesMap';
import { NODE_LABEL } from '../components/map/markers';
import { useConfig } from '../store/config';
import { parseNum } from '../lib/parser';
import type { NodeType, RelayNode } from '../types';

interface Draft {
  id: string | null;
  name: string;
  type: NodeType;
  lat: string;
  lon: string;
  elevation: string;
  gain: string;
  active: boolean;
}

const BLANK: Draft = { id: null, name: '', type: 'basecamp', lat: '', lon: '', elevation: '', gain: '', active: true };

const TYPE_ICON = { basecamp: Tent, pos: Flag, relay: RadioTower } as const;

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={`relative h-[18px] w-8 shrink-0 rounded-full border transition-colors ${on ? 'border-forest bg-forest' : 'border-line-strong bg-slate-200'}`}
    >
      <span className={`absolute top-[1px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${on ? 'left-[15px]' : 'left-[1px]'}`} />
    </button>
  );
}

export function RelayNodesView() {
  const nodes = useConfig((s) => s.nodes);
  const upsert = useConfig((s) => s.upsertNode);
  const remove = useConfig((s) => s.removeNode);
  const toggle = useConfig((s) => s.toggleNode);

  const [draft, setDraft] = useState<Draft>(BLANK);
  const [picking, setPicking] = useState(false);
  const [touched, setTouched] = useState(false);
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const lat = parseNum(draft.lat);
  const lon = parseNum(draft.lon);
  const ele = draft.elevation.trim() === '' ? undefined : parseNum(draft.elevation);
  const gain = draft.gain.trim() === '' ? undefined : parseNum(draft.gain);
  const errors = {
    name: draft.name.trim() === '' ? 'Required' : undefined,
    lat: lat === null || lat < -90 || lat > 90 ? 'Latitude −90…90' : undefined,
    lon: lon === null || lon < -180 || lon > 180 ? 'Longitude −180…180' : undefined,
    ele: ele === null ? 'Numeric MDPL' : undefined,
    gain: gain === null ? 'Numeric dBi' : undefined,
  };
  const valid = !errors.name && !errors.lat && !errors.lon && !errors.ele && !errors.gain;
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);

  const draftPoint = useMemo(
    () => (lat !== null && lon !== null && !errors.lat && !errors.lon ? { lat, lon } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lon],
  );

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const reset = () => {
    setDraft(BLANK);
    setTouched(false);
    setPicking(false);
  };

  const submit = () => {
    setTouched(true);
    if (!valid || lat === null || lon === null) return;
    const node: RelayNode = {
      id: draft.id ?? crypto.randomUUID(),
      name: draft.name.trim(),
      type: draft.type,
      lat,
      lon,
      elevation: ele === null ? undefined : ele,
      gain: gain === null ? undefined : gain,
      active: draft.active,
    };
    upsert(node);
    toast.success(draft.id ? 'Node updated' : 'Node added', { description: `${NODE_LABEL[node.type]} — ${node.name}` });
    setFocus({ lat, lon, n: Date.now() });
    reset();
  };

  const edit = (n: RelayNode) => {
    setDraft({
      id: n.id,
      name: n.name,
      type: n.type,
      lat: String(n.lat),
      lon: String(n.lon),
      elevation: n.elevation !== undefined ? String(n.elevation) : '',
      gain: n.gain !== undefined ? String(n.gain) : '',
      active: n.active,
    });
    setTouched(false);
    setFocus({ lat: n.lat, lon: n.lon, n: Date.now() });
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[400px_minmax(0,1fr)] gap-3 p-3">
      <div className="panel scroll-thin min-h-0 overflow-y-auto">
        {/* editor */}
        <form
          className="space-y-3 border-b border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-bold">{draft.id ? 'Edit node' : 'Add node'}</h2>
            {draft.id && (
              <button type="button" className="text-[12px] font-semibold text-ink-2 hover:text-ink" onClick={reset}>
                Cancel edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Name" error={show('name')}>
                <input className={`field ${show('name') ? '!border-amber' : ''}`} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Basecamp Selo" />
              </Field>
            </div>
            <div className="col-span-2">
              <span className="label mb-1 block">Type</span>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(NODE_LABEL) as NodeType[]).map((t) => {
                  const Icon = TYPE_ICON[t];
                  const on = draft.type === t;
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => set('type', t)}
                      aria-pressed={on}
                      className={`flex h-9 items-center justify-center gap-1.5 rounded-ctl border text-[12px] font-semibold transition-colors ${on ? 'border-forest bg-forest-tint text-forest' : 'border-line text-ink-2 hover:border-line-strong'}`}
                    >
                      <Icon size={14} />
                      {NODE_LABEL[t]}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Latitude" error={show('lat')}>
              <input className={`field num ${show('lat') ? '!border-amber' : ''}`} value={draft.lat} onChange={(e) => set('lat', e.target.value)} inputMode="decimal" placeholder="-7.000000" />
            </Field>
            <Field label="Longitude" error={show('lon')}>
              <input className={`field num ${show('lon') ? '!border-amber' : ''}`} value={draft.lon} onChange={(e) => set('lon', e.target.value)} inputMode="decimal" placeholder="110.000000" />
            </Field>
            <Field label="Elevation (MDPL)" error={show('ele')}>
              <input className={`field num ${show('ele') ? '!border-amber' : ''}`} value={draft.elevation} onChange={(e) => set('elevation', e.target.value)} inputMode="decimal" placeholder="optional" />
            </Field>
            <Field label="Antenna gain (dBi)" error={show('gain')}>
              <input className={`field num ${show('gain') ? '!border-amber' : ''}`} value={draft.gain} onChange={(e) => set('gain', e.target.value)} inputMode="decimal" placeholder="optional" />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button type="button" className={`btn ${picking ? 'border-forest bg-forest-tint text-forest' : ''}`} onClick={() => setPicking((p) => !p)} aria-pressed={picking}>
              <Crosshair size={14} />
              Pick on Map
            </button>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-2">
                Active
                <Switch on={draft.active} onChange={() => set('active', !draft.active)} label="Node active" />
              </label>
              <button type="submit" className="btn btn-primary">
                {draft.id ? 'Save' : <><Plus size={14} /> Add node</>}
              </button>
            </div>
          </div>
        </form>

        {/* list */}
        <div className="p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="label">Nodes</span>
            <span className="num text-[11px] text-ink-muted">{nodes.length}</span>
          </div>
          {nodes.length === 0 ? (
            <div className="rounded-ctl border border-dashed border-line-strong px-4 py-8 text-center">
              <p className="text-[13px] font-semibold">No nodes defined</p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-2">
                Add a Basecamp to enable geodesic rescue vectors. Pos Pendakian and LoRa relays are drawn on the map for coverage planning.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {nodes.map((n) => {
                const Icon = TYPE_ICON[n.type];
                return (
                  <li
                    key={n.id}
                    onClick={() => setFocus({ lat: n.lat, lon: n.lon, n: Date.now() })}
                    className={`group cursor-pointer rounded-ctl border p-2.5 transition-colors hover:border-line-strong ${draft.id === n.id ? 'border-forest bg-forest-tint' : 'border-line'} ${n.active ? '' : 'bg-canvas/70'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-ctl ${n.active ? 'bg-forest text-white' : 'bg-slate-300 text-white'}`}>
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{n.name}</div>
                        <div className="text-[11.5px] text-ink-muted">{NODE_LABEL[n.type]}</div>
                      </div>
                      <Switch on={n.active} onChange={() => toggle(n.id)} label={`${n.name} active`} />
                      <button
                        className="btn btn-ghost h-7 w-7 !px-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          edit(n);
                        }}
                        aria-label={`Edit ${n.name}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className={`btn h-7 !px-1.5 text-[11.5px] ${confirmId === n.id ? 'border-crimson bg-crimson text-white hover:bg-crimson-hover' : 'btn-ghost !w-7 text-ink-2'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirmId === n.id) {
                            remove(n.id);
                            if (draft.id === n.id) reset();
                            setConfirmId(null);
                            toast('Node deleted');
                          } else {
                            setConfirmId(n.id);
                            setTimeout(() => setConfirmId((c) => (c === n.id ? null : c)), 3000);
                          }
                        }}
                        aria-label={confirmId === n.id ? `Confirm delete ${n.name}` : `Delete ${n.name}`}
                      >
                        {confirmId === n.id ? 'Delete?' : <Trash2 size={14} />}
                      </button>
                    </div>
                    <div className="num mt-2 grid grid-cols-[1.6fr_1fr_1fr] gap-2 border-t border-line/70 pt-2 text-[11px] text-ink-2">
                      <span>
                        {n.lat.toFixed(5)}, {n.lon.toFixed(5)}
                      </span>
                      <span>{n.elevation !== undefined ? `${n.elevation} MDPL` : '— MDPL'}</span>
                      <span>{n.gain !== undefined ? `${n.gain} dBi` : '— dBi'}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="panel min-h-0 overflow-hidden">
        <NodesMap
          nodes={nodes}
          picking={picking}
          draft={draftPoint}
          focus={focus}
          onNodeClick={edit}
          onPick={(la, lo) => {
            setDraft((d) => ({ ...d, lat: la.toFixed(6), lon: lo.toFixed(6) }));
            setPicking(false);
            toast('Coordinates picked', { description: `${la.toFixed(6)}, ${lo.toFixed(6)}` });
          }}
        />
      </div>
    </div>
  );
}
