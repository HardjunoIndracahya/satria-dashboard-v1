import { useEffect, useRef } from 'react';
import { distanceM } from '../lib/geo';
import {
  clearWeatherServiceCache,
  fetchOpenMeteoWeather,
  reverseGeocodeLocation,
  SIGNIFICANT_MOVE_METRES,
  WEATHER_REFRESH_INTERVAL_MS,
} from '../lib/weatherService';
import { useWeather, type GeolocationStatus } from '../store/weather';

const MANUAL_REFRESH_COOLDOWN_MS = 15_000;

function mapGeolocationError(err: GeolocationPositionError): { status: GeolocationStatus; message: string } {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return {
        status: 'denied',
        message: 'Location access was denied. Enable browser location permission for this site to view your local weather.',
      };
    case err.POSITION_UNAVAILABLE:
      return {
        status: 'unavailable',
        message: 'Your device could not determine a location fix right now. Check OS location services or network connectivity.',
      };
    case err.TIMEOUT:
      return {
        status: 'timeout',
        message: 'Location acquisition timed out before a fix was returned. You can retry when ready.',
      };
    default:
      return {
        status: 'unavailable',
        message: err.message || 'Unable to acquire device location.',
      };
  }
}

/**
 * Personal browser-location weather lifecycle hook.
 * MUST only be mounted when the user is authenticated and authorized (`ProtectedDashboard`).
 * Never uses hiker GPS telemetry, monitored device coordinates, or hardcoded default cities.
 */
export function usePersonalWeather(enabled: boolean) {
  const refreshNonce = useWeather((s) => s.refreshNonce);
  const relocateNonce = useWeather((s) => s.relocateNonce);

  const abortRef = useRef<AbortController | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastManualRefreshAtRef = useRef<number>(0);
  const lastRelocateNonceRef = useRef<number>(relocateNonce);
  const lastRefreshNonceRef = useRef<number>(refreshNonce);

  const loadWeatherForCoords = useRef(
    async (lat: number, lon: number, opts?: { force?: boolean; resolvePlace?: boolean }) => {
      const store = useWeather.getState();
      const isInitial = !store.weather;
      store.startWeatherFetch(isInitial);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const shouldResolvePlace = opts?.resolvePlace ?? (!store.locationName || opts?.force === true);

      const weatherPromise = fetchOpenMeteoWeather(lat, lon, {
        force: opts?.force ?? false,
        signal: controller.signal,
      });

      const geocodePromise = shouldResolvePlace ? reverseGeocodeLocation(lat, lon) : Promise.resolve(undefined);

      const [weatherResult, geocodeResult] = await Promise.allSettled([weatherPromise, geocodePromise]);

      if (controller.signal.aborted) return;

      if (geocodeResult.status === 'fulfilled' && geocodeResult.value !== undefined) {
        if (geocodeResult.value) {
          useWeather.getState().setLocation(geocodeResult.value.name, geocodeResult.value.region);
        }
      }

      if (weatherResult.status === 'fulfilled') {
        useWeather.getState().setWeatherSuccess(weatherResult.value, { lat, lon });
      } else {
        const reason = weatherResult.reason;
        const msg = reason instanceof Error ? reason.message : 'Unable to reach Open-Meteo weather service.';
        useWeather.getState().setWeatherFailure(msg);
      }
    },
  );

  const clearGeoWatch = () => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const startSignificantMovementWatch = useRef(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    if (watchIdRef.current !== null) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const nextLat = pos.coords.latitude;
        const nextLon = pos.coords.longitude;
        if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon)) return;

        const state = useWeather.getState();
        state.setCoords({
          lat: nextLat,
          lon: nextLon,
          accuracy: pos.coords.accuracy,
          acquiredAt: pos.timestamp || Date.now(),
        });

        // Only re-fetch weather & reverse-geocode when the user moves significantly (>= 1.5 km)
        const prev = state.lastFetchedCoords;
        if (!prev) {
          void loadWeatherForCoords.current(nextLat, nextLon, { force: false, resolvePlace: true });
          return;
        }
        const moved = distanceM(prev, { lat: nextLat, lon: nextLon });
        if (moved >= SIGNIFICANT_MOVE_METRES) {
          void loadWeatherForCoords.current(nextLat, nextLon, { force: true, resolvePlace: true });
        }
      },
      (err) => {
        // Keep existing good weather if watch hits a transient timeout/unavailable error.
        // Only escalate if permission was explicitly revoked.
        if (err.code === err.PERMISSION_DENIED) {
          clearGeoWatch();
          const mapped = mapGeolocationError(err);
          useWeather.getState().setGeoStatus(mapped.status, mapped.message);
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 25_000,
        maximumAge: 180_000,
      },
    );
  });

  const acquireInitialPosition = useRef((fresh = false) => {
    const store = useWeather.getState();

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      store.setGeoStatus(
        'unsupported',
        'This browser does not support the Geolocation API. Personal location weather is unavailable.',
      );
      return;
    }

    store.setGeoStatus('acquiring', null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          useWeather.getState().setGeoStatus('unavailable', 'Browser returned invalid coordinates.');
          return;
        }

        useWeather.getState().setCoords({
          lat,
          lon,
          accuracy: pos.coords.accuracy,
          acquiredAt: pos.timestamp || Date.now(),
        });

        void loadWeatherForCoords.current(lat, lon, { force: fresh, resolvePlace: true });
        startSignificantMovementWatch.current();
      },
      (err) => {
        const mapped = mapGeolocationError(err);
        useWeather.getState().setGeoStatus(mapped.status, mapped.message);
      },
      {
        enableHighAccuracy: false,
        timeout: 15_000,
        maximumAge: fresh ? 0 : 180_000,
      },
    );
  });

  // Main authenticated lifecycle: geolocation init, periodic refresh, visibility catch-up, permission listener
  useEffect(() => {
    if (!enabled) {
      clearGeoWatch();
      abortRef.current?.abort();
      clearWeatherServiceCache();
      useWeather.getState().reset();
      return;
    }

    acquireInitialPosition.current(false);

    // Periodic refresh every 12 minutes (only when coordinates exist & tab is visible)
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      const { coords } = useWeather.getState();
      if (!coords) return;
      void loadWeatherForCoords.current(coords.lat, coords.lon, { force: true, resolvePlace: false });
    }, WEATHER_REFRESH_INTERVAL_MS);

    // Refresh when returning to tab if weather is older than 12 minutes
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const { coords, lastUpdatedAt, stale } = useWeather.getState();
      if (!coords) return;
      const age = lastUpdatedAt ? Date.now() - lastUpdatedAt : Infinity;
      if (stale || age >= WEATHER_REFRESH_INTERVAL_MS) {
        void loadWeatherForCoords.current(coords.lat, coords.lon, { force: true, resolvePlace: false });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Watch browser geolocation permission changes (e.g., if user switches Denied -> Granted in browser settings)
    let permissionStatus: PermissionStatus | null = null;
    const onPermissionChange = () => {
      if (!permissionStatus) return;
      if (permissionStatus.state === 'granted') {
        const cur = useWeather.getState().geoStatus;
        if (cur === 'denied' || cur === 'timeout' || cur === 'unavailable' || cur === 'idle') {
          acquireInitialPosition.current(true);
        }
      } else if (permissionStatus.state === 'denied') {
        clearGeoWatch();
        useWeather.getState().setGeoStatus(
          'denied',
          'Location access was denied. Enable browser location permission for this site to view your local weather.',
        );
      }
    };

    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          permissionStatus = status;
          status.addEventListener('change', onPermissionChange);
        })
        .catch(() => {
          /* Permissions API unavailable or restricted */
        });
    }

    return () => {
      clearGeoWatch();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      permissionStatus?.removeEventListener('change', onPermissionChange);
      abortRef.current?.abort();
      clearWeatherServiceCache();
      useWeather.getState().reset();
    };
  }, [enabled]);

  // Manual weather refresh triggered from expandable panel
  useEffect(() => {
    if (!enabled) return;
    if (refreshNonce === lastRefreshNonceRef.current) return;
    lastRefreshNonceRef.current = refreshNonce;

    const state = useWeather.getState();
    if (!state.coords) {
      acquireInitialPosition.current(true);
      return;
    }

    const now = Date.now();
    if (!state.stale && !state.weatherError && now - lastManualRefreshAtRef.current < MANUAL_REFRESH_COOLDOWN_MS) {
      return;
    }
    lastManualRefreshAtRef.current = now;
    void loadWeatherForCoords.current(state.coords.lat, state.coords.lon, {
      force: true,
      resolvePlace: !state.locationName,
    });
  }, [enabled, refreshNonce]);

  // Manual GPS re-acquisition triggered from footer or panel
  useEffect(() => {
    if (!enabled) return;
    if (relocateNonce === lastRelocateNonceRef.current) return;
    lastRelocateNonceRef.current = relocateNonce;

    clearGeoWatch();
    acquireInitialPosition.current(true);
  }, [enabled, relocateNonce]);
}
