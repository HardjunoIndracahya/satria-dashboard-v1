import { create } from 'zustand';
import type { WeatherUnitSystem } from '../lib/weatherCodes';
import type { WeatherForecastPayload } from '../lib/weatherService';

export type GeolocationStatus =
  | 'idle'
  | 'acquiring'
  | 'granted'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported';

export interface DeviceCoords {
  lat: number;
  lon: number;
  accuracy: number;
  acquiredAt: number;
}

const UNITS_STORAGE_KEY = 'raksa.weather.units.v1';

function readInitialUnits(): WeatherUnitSystem {
  if (typeof localStorage === 'undefined') return 'metric';
  try {
    const saved = localStorage.getItem(UNITS_STORAGE_KEY);
    if (saved === 'imperial' || saved === 'metric') return saved;
  } catch {
    /* ignore storage errors */
  }
  return 'metric';
}

interface WeatherState {
  geoStatus: GeolocationStatus;
  geoError: string | null;
  coords: DeviceCoords | null;
  lastFetchedCoords: { lat: number; lon: number } | null;

  locationName: string | null;
  locationRegion: string | null;

  weather: WeatherForecastPayload | null;
  loadingWeather: boolean;
  refreshing: boolean;
  stale: boolean;
  weatherError: string | null;
  lastUpdatedAt: number | null;

  units: WeatherUnitSystem;
  panelOpen: boolean;

  /** Incrementing triggers consumed by `usePersonalWeather`. */
  refreshNonce: number;
  relocateNonce: number;

  setGeoStatus: (status: GeolocationStatus, error?: string | null) => void;
  setCoords: (coords: DeviceCoords) => void;
  setLocation: (name: string | null, region: string | null) => void;
  startWeatherFetch: (isInitial: boolean) => void;
  setWeatherSuccess: (payload: WeatherForecastPayload, fetchedCoords: { lat: number; lon: number }) => void;
  setWeatherFailure: (errorMessage: string) => void;
  setUnits: (units: WeatherUnitSystem) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  requestRefresh: () => void;
  requestRelocate: () => void;
  /** Clears personal geolocation and weather state on logout or unauthorized transition. */
  reset: () => void;
}

export const useWeather = create<WeatherState>((set) => ({
  geoStatus: 'idle',
  geoError: null,
  coords: null,
  lastFetchedCoords: null,

  locationName: null,
  locationRegion: null,

  weather: null,
  loadingWeather: false,
  refreshing: false,
  stale: false,
  weatherError: null,
  lastUpdatedAt: null,

  units: readInitialUnits(),
  panelOpen: false,

  refreshNonce: 0,
  relocateNonce: 0,

  setGeoStatus: (geoStatus, geoError = null) => set({ geoStatus, geoError }),
  setCoords: (coords) => set({ coords, geoStatus: 'granted', geoError: null }),
  setLocation: (locationName, locationRegion) => set({ locationName, locationRegion }),

  startWeatherFetch: (isInitial) =>
    set((s) => ({
      loadingWeather: isInitial && !s.weather,
      refreshing: !isInitial || Boolean(s.weather),
    })),

  setWeatherSuccess: (weather, lastFetchedCoords) =>
    set({
      weather,
      lastFetchedCoords,
      loadingWeather: false,
      refreshing: false,
      stale: false,
      weatherError: null,
      lastUpdatedAt: weather.fetchedAt,
    }),

  setWeatherFailure: (weatherError) =>
    set((s) => ({
      loadingWeather: false,
      refreshing: false,
      weatherError,
      // Preserve last known good weather and flag it as stale
      stale: Boolean(s.weather),
    })),

  setUnits: (units) => {
    try {
      localStorage.setItem(UNITS_STORAGE_KEY, units);
    } catch {
      /* ignore */
    }
    set({ units });
  },

  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  requestRefresh: () => set((s) => ({ refreshNonce: s.refreshNonce + 1 })),
  requestRelocate: () => set((s) => ({ relocateNonce: s.relocateNonce + 1 })),

  reset: () =>
    set({
      geoStatus: 'idle',
      geoError: null,
      coords: null,
      lastFetchedCoords: null,
      locationName: null,
      locationRegion: null,
      weather: null,
      loadingWeather: false,
      refreshing: false,
      stale: false,
      weatherError: null,
      lastUpdatedAt: null,
      panelOpen: false,
    }),
}));
