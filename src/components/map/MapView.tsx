import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  AttributionControl,
  Layer,
  ScaleControl,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
  type MapRef,
} from 'react-map-gl/maplibre';
import { animate } from 'framer-motion';
import { X } from 'lucide-react';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { HikerMarker, NodeMarker, PillMarker, ScrubMarker } from './markers';
import { MapToolbar } from './MapToolbar';
import { Inspector } from './Inspector';
import { HikerPopup, MapLegend } from './MapExtras';
import { useConfig } from '../../store/config';
import { useTelemetry } from '../../store/telemetry';
import { useUi } from '../../store/ui';
import { BASEMAP_ORDER, DEM_SOURCE, buildStyle, getCamera, saveCamera } from '../../lib/mapStyle';
import { boundsOf, bearingDeg, distanceM, formatBearing, formatDelta, formatDistance, midpoint } from '../../lib/geo';
import { nearestNode } from '../../lib/format';
import type { Hiker, Packet } from '../../types';

const EXAGGERATION = 1.5;
const PITCH_3D = 55;
const FLY_PITCH_3D = 52;

/* ------------------------------ layer styles ------------------------------ */
const trailCasing: LayerProps = {
  id: 'trail-casing',
  type: 'line',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': '#FFFFFF', 'line-width': 6.5, 'line-opacity': 0.95 },
};
const trailLine: LayerProps = {
  id: 'trail-line',
  type: 'line',
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: { 'line-color': '#166534', 'line-width': 3 },
};
const trailDots: LayerProps = {
  id: 'trail-dots',
  type: 'circle',
  filter: ['all', ['==', ['get', 'dot'], true], ['==', ['get', 'sos'], false]],
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['get', 't'], 0, 2.2, 1, 4],
    'circle-color': '#FFFFFF',
    'circle-stroke-color': '#166534',
    'circle-stroke-width': 1.5,
    'circle-opacity': ['interpolate', ['linear'], ['get', 't'], 0, 0.55, 1, 1],
    'circle-stroke-opacity': ['interpolate', ['linear'], ['get', 't'], 0, 0.55, 1, 1],
  },
};
const trailSos: LayerProps = {
  id: 'trail-sos',
  type: 'circle',
  filter: ['==', ['get', 'sos'], true],
  paint: { 'circle-radius': 4.5, 'circle-color': '#DC2626', 'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5 },
};
const trailHit: LayerProps = {
  id: 'trail-hit',
  type: 'circle',
  paint: { 'circle-radius': 9, 'circle-color': '#000000', 'circle-opacity': 0.01 },
};
const vectorLine: LayerProps = {
  id: 'vector-line',
  type: 'line',
  layout: { 'line-cap': 'butt' },
  paint: { 'line-color': '#0F172A', 'line-width': 2, 'line-dasharray': [2.2, 1.8] },
};
const measureLine: LayerProps = {
  id: 'measure-line',
  type: 'line',
  paint: { 'line-color': '#0F172A', 'line-width': 2, 'line-dasharray': [1, 1.6] },
};

interface MeasurePt {
  lat: number;
  lon: number;
  ele?: number;
}

export function MapView({ hikers }: { hikers: Hiker[] }) {
  const mapRef = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [bearing, setBearing] = useState(0);
  const [hoverTrail, setHoverTrail] = useState(false);
  const [measurePts, setMeasurePts] = useState<MeasurePt[]>([]);
  const [mapStyle] = useState(() => buildStyle(useUi.getState().basemap));
  const [initialView] = useState(() => getCamera());

  const nodes = useConfig((s) => s.nodes);
  const hasEntries = useTelemetry((s) => s.total > 0);
  const connectionState = useTelemetry((s) => s.connectionState);

  const selectedId = useUi((s) => s.selectedId);
  const focusNonce = useUi((s) => s.focusNonce);
  const terrain3d = useUi((s) => s.terrain3d);
  const basemap = useUi((s) => s.basemap);
  const setBasemap = useUi((s) => s.setBasemap);
  const toggle3d = useUi((s) => s.toggle3d);
  const measure = useUi((s) => s.measure);
  const toggleMeasure = useUi((s) => s.toggleMeasure);
  const showVector = useUi((s) => s.showVector);
  const toggleVector = useUi((s) => s.toggleVector);
  const scrubIndex = useUi((s) => s.scrubIndex);
  const setScrub = useUi((s) => s.setScrub);

  const scrubFromMap = useRef(false);
  const exagRef = useRef(0);
  const hikersRef = useRef(hikers);
  hikersRef.current = hikers;
  const terrainRef = useRef(terrain3d);
  terrainRef.current = terrain3d;

  const selected = useMemo(() => hikers.find((h) => h.id === selectedId) ?? null, [hikers, selectedId]);
  const [popupId, setPopupId] = useState<string | null>(null);
  const popupHiker = useMemo(() => hikers.find((h) => h.id === popupId) ?? null, [hikers, popupId]);
  const activeNodes = useMemo(() => nodes.filter((n) => n.active), [nodes]);

  /* ----------------------------- geo json data ----------------------------- */
  const trail = useMemo(() => {
    if (!selected || selected.track.length === 0) return null;
    const track = selected.track;
    const step = Math.max(1, Math.ceil(track.length / 48));
    const line: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: track.map((p) => [p.lon, p.lat]) },
    };
    const pts: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: track.map((p: Packet, i: number) => ({
        type: 'Feature',
        properties: {
          i,
          t: track.length > 1 ? i / (track.length - 1) : 1,
          sos: p.status === 'SOS',
          dot: i % step === 0 || i === track.length - 1,
        },
        geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      })),
    };
    return { line, pts, hasLine: track.length > 1 };
  }, [selected]);

  const base = useMemo(
    () =>
      selected
        ? nearestNode(
            activeNodes.filter((n) => n.type === 'basecamp'),
            selected.latest,
          )
        : null,
    [selected, activeNodes],
  );

  const vector = useMemo(() => {
    if (!selected || !base || !showVector) return null;
    const a = { lat: base.lat, lon: base.lon };
    const b = { lat: selected.latest.lat, lon: selected.latest.lon };
    const mid = midpoint(a, b);
    const dist = distanceM(a, b);
    const delta = base.elevation !== undefined ? selected.latest.alt - base.elevation : null;
    const line: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] },
    };
    return { line, mid, text: delta !== null ? `${formatDistance(dist)} • ${formatDelta(delta)}` : formatDistance(dist) };
  }, [selected, base, showVector]);

  const measureData = useMemo(() => {
    if (measurePts.length < 2) return null;
    const [a, b] = measurePts;
    const line: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] },
    };
    const dist = distanceM(a, b);
    const brg = bearingDeg(a, b);
    const delta = a.ele !== undefined && b.ele !== undefined ? b.ele - a.ele : null;
    return { line, mid: midpoint(a, b), dist, brg, delta };
  }, [measurePts]);

  /* ----------------------------- camera helpers ---------------------------- */
  const fitAll = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const pts = [...hikersRef.current.map((h) => h.latest), ...useConfig.getState().nodes.filter((n) => n.active)];
    const b = boundsOf(pts);
    if (!b) return;
    const pitch = terrainRef.current ? FLY_PITCH_3D : 0;
    if (pts.length === 1 || (b[0][0] === b[1][0] && b[0][1] === b[1][1])) {
      map.flyTo({ center: b[0], zoom: 14, pitch, duration: 1400, essential: true });
    } else {
      map.fitBounds(b, { padding: { top: 90, bottom: 70, left: 90, right: 90 }, maxZoom: 15, pitch, duration: 1400, essential: true });
    }
  }, []);

  // first valid data → fit once
  const didFit = useRef(false);
  useEffect(() => {
    if (hikers.length === 0) {
      didFit.current = false;
      return;
    }
    if (loaded && !didFit.current) {
      didFit.current = true;
      fitAll();
    }
  }, [hikers.length, loaded, fitAll]);

  // cinematic fly-to on hiker focus
  useEffect(() => {
    if (!loaded || focusNonce === 0) return;
    const map = mapRef.current?.getMap();
    const id = useUi.getState().selectedId;
    const h = hikersRef.current.find((x) => x.id === id);
    if (!map || !h) return;
    map.flyTo({
      center: [h.latest.lon, h.latest.lat],
      zoom: Math.max(map.getZoom(), 13.5),
      pitch: terrainRef.current ? FLY_PITCH_3D : 0,
      duration: 1700,
      curve: 1.35,
      essential: true,
    });
  }, [focusNonce, loaded]);

  // basemap visibility
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!loaded || !map) return;
    for (const id of BASEMAP_ORDER) {
      if (map.getLayer(`base-${id}`)) map.setLayoutProperty(`base-${id}`, 'visibility', id === basemap ? 'visible' : 'none');
    }
  }, [basemap, loaded]);

  // 2D ↔ 3D terrain (animated pitch + exaggeration)
  const terrainInit = useRef(true);
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!loaded || !map) return;
    if (terrainInit.current) {
      terrainInit.current = false;
      if (!terrain3d) return;
    }
    map.easeTo({ pitch: terrain3d ? PITCH_3D : 0, duration: terrain3d ? 1300 : 900, essential: true });
    const ctrl = animate(exagRef.current, terrain3d ? EXAGGERATION : 0, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        exagRef.current = v;
        if (terrain3d || v > 0.05) map.setTerrain({ source: DEM_SOURCE, exaggeration: Math.max(v, 0.01) });
      },
      onComplete: () => {
        if (!terrain3d) map.setTerrain(null);
      },
    });
    return () => ctrl.stop();
  }, [terrain3d, loaded]);

  // measure mode housekeeping
  useEffect(() => {
    if (!measure) setMeasurePts([]);
  }, [measure]);

  /* -------------------------------- handlers ------------------------------- */
  const onMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      const f = e.features;
      if (f && f.length > 0) {
        let best = f[0];
        let bestD = Infinity;
        for (const feat of f) {
          const c = (feat.geometry as Point).coordinates;
          const d = (c[0] - e.lngLat.lng) ** 2 + (c[1] - e.lngLat.lat) ** 2;
          if (d < bestD) {
            bestD = d;
            best = feat;
          }
        }
        scrubFromMap.current = true;
        setHoverTrail(true);
        setScrub(Number(best.properties?.i));
      } else if (scrubFromMap.current) {
        scrubFromMap.current = false;
        setHoverTrail(false);
        setScrub(null);
      }
    },
    [setScrub],
  );

  const onMapClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!useUi.getState().measure) return;
      const map = mapRef.current?.getMap();
      let ele: number | undefined;
      try {
        const q = map?.queryTerrainElevation(e.lngLat);
        if (typeof q === 'number' && Number.isFinite(q)) ele = q;
      } catch {
        /* terrain off */
      }
      const pt: MeasurePt = { lat: e.lngLat.lat, lon: e.lngLat.lng, ele };
      setMeasurePts((prev) => (prev.length >= 2 ? [pt] : [...prev, pt]));
    },
    [],
  );

  const showEmptyNotice = connectionState !== 'connected' && !hasEntries && hikers.length === 0;
  const emptyRoot = useTelemetry((s) => s.emptyRoot);
  const errorText = useTelemetry((s) => s.error);

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        mapLib={import('maplibre-gl')}
        mapStyle={mapStyle}
        initialViewState={initialView}
        maxPitch={80}
        minZoom={2}
        attributionControl={false}
        interactiveLayerIds={selected ? ['trail-hit'] : []}
        cursor={measure ? 'crosshair' : hoverTrail ? 'crosshair' : undefined}
        onLoad={() => setLoaded(true)}
        onRotate={(e) => setBearing(e.viewState.bearing)}
        onMoveEnd={(e) => {
          const v = e.viewState;
          saveCamera({ longitude: v.longitude, latitude: v.latitude, zoom: v.zoom, pitch: v.pitch, bearing: v.bearing });
          setBearing(v.bearing);
        }}
        onMouseMove={onMouseMove}
        onClick={onMapClick}
        style={{ width: '100%', height: '100%' }}
      >
        <AttributionControl compact position="bottom-right" />
        <ScaleControl unit="metric" position="bottom-left" maxWidth={110} />

        {/* breadcrumb trail */}
        {trail && (
          <>
            {trail.hasLine && (
              <Source id="trail" type="geojson" data={trail.line}>
                <Layer {...trailCasing} />
                <Layer {...trailLine} />
              </Source>
            )}
            <Source id="trail-pts" type="geojson" data={trail.pts}>
              <Layer {...trailDots} />
              <Layer {...trailSos} />
              <Layer {...trailHit} />
            </Source>
          </>
        )}

        {/* rescue vector */}
        {vector && (
          <>
            <Source id="vector" type="geojson" data={vector.line}>
              <Layer {...vectorLine} />
            </Source>
            <PillMarker lon={vector.mid.lon} lat={vector.mid.lat}>
              {vector.text}
            </PillMarker>
          </>
        )}

        {/* measure tool */}
        {measureData && (
          <Source id="measure" type="geojson" data={measureData.line}>
            <Layer {...measureLine} />
          </Source>
        )}
        {measurePts.map((p, i) => (
          <PillMarker key={`${p.lat}-${p.lon}`} lon={p.lon} lat={p.lat} tone="green">
            {i === 0 ? 'A' : 'B'}
          </PillMarker>
        ))}

        {/* nodes */}
        {nodes.map((n) => (
          <NodeMarker key={n.id} node={n} />
        ))}

        {/* trail start + scrub ring */}
        {selected && selected.track.length > 1 && (
          <PillMarker lon={selected.track[0].lon} lat={selected.track[0].lat} tone="green">
            START
          </PillMarker>
        )}
        {selected && scrubIndex !== null && selected.track[scrubIndex] && (
          <ScrubMarker lon={selected.track[scrubIndex].lon} lat={selected.track[scrubIndex].lat} />
        )}

        {/* hikers */}
        {hikers.map((h) => (
          <HikerMarker
            key={h.id}
            hiker={h}
            selected={h.id === selectedId}
            onSelect={() => {
              useUi.getState().focusHiker(h.id);
              setPopupId(h.id);
            }}
          />
        ))}
        {popupHiker && <HikerPopup hiker={popupHiker} onClose={() => setPopupId(null)} />}
      </Map>

      <MapToolbar
        basemap={basemap}
        onBasemap={setBasemap}
        terrain3d={terrain3d}
        onToggle3d={toggle3d}
        onFit={fitAll}
        onZoom={(d) => (d > 0 ? mapRef.current?.zoomIn({ duration: 250 }) : mapRef.current?.zoomOut({ duration: 250 }))}
        bearing={bearing}
        onResetBearing={() => mapRef.current?.easeTo({ bearing: 0, pitch: terrain3d ? PITCH_3D : 0, duration: 600 })}
        measure={measure}
        onMeasure={toggleMeasure}
        vector={showVector}
        onVector={toggleVector}
      />

      <Inspector hiker={selected} />
      <MapLegend hikers={hikers} onFocus={(id) => { useUi.getState().focusHiker(id); setPopupId(id); }} />

      {measure && (
        <div className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-panel border border-line bg-surface px-3.5 py-2 shadow-float">
          <span className="label">Measure</span>
          {measureData ? (
            <span className="num text-[12.5px] font-semibold">
              {formatDistance(measureData.dist)} <span className="text-ink-muted">•</span> {formatBearing(measureData.brg)}
              {measureData.delta !== null && (
                <>
                  {' '}
                  <span className="text-ink-muted">•</span> {formatDelta(measureData.delta)}
                </>
              )}
            </span>
          ) : (
            <span className="text-[12.5px] text-ink-2">{measurePts.length === 0 ? 'Click the map to place point A' : 'Click to place point B'}</span>
          )}
          <button className="btn btn-ghost h-6 w-6 !px-0" onClick={toggleMeasure} aria-label="Exit measure mode">
            <X size={14} />
          </button>
        </div>
      )}

      {showEmptyNotice && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 max-w-[420px] -translate-x-1/2 rounded-panel border border-line bg-surface/95 px-3.5 py-2 text-center text-[12px] text-ink-2 shadow-float">
          {errorText ?? 'No telemetry source connected — basemap only'}
        </div>
      )}
      {!showEmptyNotice && hikers.length === 0 && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 max-w-[420px] -translate-x-1/2 rounded-panel border border-line bg-surface/95 px-3.5 py-2 text-center text-[12px] text-ink-2 shadow-float">
          {errorText ?? (emptyRoot ? 'Connected — no hiker data under the database node yet' : 'Connected — waiting for hikers with a valid GPS fix')}
        </div>
      )}
    </div>
  );
}
