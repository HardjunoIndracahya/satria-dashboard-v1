import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Marker, NavigationControl, ScaleControl, AttributionControl, type MapLayerMouseEvent, type MapRef } from 'react-map-gl/maplibre';
import { NodeMarker } from './markers';
import { Segmented } from '../ui';
import { BASEMAP_ORDER, BASEMAPS, buildStyle, getCamera } from '../../lib/mapStyle';
import { boundsOf } from '../../lib/geo';
import type { BasemapId, RelayNode } from '../../types';

export interface MapFocus {
  lat: number;
  lon: number;
  n: number;
}

export function NodesMap({
  nodes,
  picking,
  onPick,
  draft,
  focus,
  onNodeClick,
}: {
  nodes: RelayNode[];
  picking: boolean;
  onPick: (lat: number, lon: number) => void;
  draft: { lat: number; lon: number } | null;
  focus: MapFocus | null;
  onNodeClick: (n: RelayNode) => void;
}) {
  const mapRef = useRef<MapRef>(null);
  const [basemap, setBasemap] = useState<BasemapId>('topo');
  const style = useMemo(() => buildStyle(basemap), [basemap]);
  const [initial] = useState(() => {
    const b = boundsOf(nodes);
    if (b) return { bounds: b, fitBoundsOptions: { padding: 90, maxZoom: 14 } } as const;
    return getCamera();
  });

  useEffect(() => {
    if (focus) mapRef.current?.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(mapRef.current.getZoom(), 13), duration: 1000, essential: true });
  }, [focus]);

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        mapLib={import('maplibre-gl')}
        mapStyle={style}
        initialViewState={initial}
        attributionControl={false}
        cursor={picking ? 'crosshair' : undefined}
        onClick={(e: MapLayerMouseEvent) => {
          if (picking) onPick(e.lngLat.lat, e.lngLat.lng);
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <AttributionControl compact position="bottom-right" />
        <ScaleControl unit="metric" position="bottom-left" maxWidth={110} />
        {nodes.map((n) => (
          <NodeMarker key={n.id} node={n} onClick={() => onNodeClick(n)} />
        ))}
        {draft && (
          <Marker longitude={draft.lon} latitude={draft.lat} anchor="center" style={{ pointerEvents: 'none', zIndex: 20 }}>
            <span className="block h-5 w-5 rounded-full border-2 border-dashed border-forest bg-forest-tint/70" />
          </Marker>
        )}
      </Map>
      <div className="absolute left-3 top-3 z-10">
        <Segmented
          size="sm"
          value={basemap}
          onChange={setBasemap}
          options={BASEMAP_ORDER.map((id) => ({ value: id, label: BASEMAPS[id].label }))}
          className="bg-surface shadow-float"
          ariaLabel="Basemap"
        />
      </div>
      {picking && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 z-10 -translate-x-1/2 rounded-panel border border-forest bg-surface px-3.5 py-2 text-[12.5px] font-semibold text-forest shadow-float">
          Click the map to set node coordinates
        </div>
      )}
    </div>
  );
}
