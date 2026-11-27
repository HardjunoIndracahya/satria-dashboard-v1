import type { StyleSpecification } from 'maplibre-gl';
import type { BasemapId } from '../types';

interface BasemapDef {
  label: string;
  tiles: string[];
  maxzoom: number;
  attribution: string;
}

export const BASEMAPS: Record<BasemapId, BasemapDef> = {
  topo: {
    label: 'Topo',
    tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
    maxzoom: 17,
    attribution: '© <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC-BY-SA) · © OpenStreetMap contributors',
  },
  satellite: {
    label: 'Satellite',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 19,
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  },
  osm: {
    label: 'OSM Standard',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    maxzoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  },
};

export const BASEMAP_ORDER: BasemapId[] = ['topo', 'satellite', 'osm'];
export const DEM_SOURCE = 'terrain-dem';

export function buildStyle(active: BasemapId): StyleSpecification {
  const sources: StyleSpecification['sources'] = {};
  const layers: StyleSpecification['layers'] = [
    { id: 'paper', type: 'background', paint: { 'background-color': '#E9EEEA' } },
  ];
  for (const id of BASEMAP_ORDER) {
    const def = BASEMAPS[id];
    sources[id] = { type: 'raster', tiles: def.tiles, tileSize: 256, maxzoom: def.maxzoom, attribution: def.attribution };
    layers.push({
      id: `base-${id}`,
      type: 'raster',
      source: id,
      layout: { visibility: id === active ? 'visible' : 'none' },
      paint: { 'raster-fade-duration': 200 },
    });
  }
  sources[DEM_SOURCE] = {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 15,
    attribution: 'Terrain © Mapzen, AWS Terrain Tiles',
  };
  return { version: 8, sources, layers };
}

export const DEFAULT_CAMERA = { longitude: 118, latitude: -2.2, zoom: 4.1, pitch: 0, bearing: 0 };

let saved: typeof DEFAULT_CAMERA | null = null;
export const getCamera = () => saved ?? DEFAULT_CAMERA;
export const saveCamera = (c: typeof DEFAULT_CAMERA) => {
  saved = c;
};
