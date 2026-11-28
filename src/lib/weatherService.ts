import { distanceM } from './geo';
import { describeWeatherCode, type WeatherCodeInfo } from './weatherCodes';

export const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const BIGDATACLOUD_REVERSE_ENDPOINT = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

/** Cache validity for identical/nearby browser coordinates (10 minutes). */
export const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
/** Minimum distance (metres) before treating a coordinate change as a new weather location. */
export const SIGNIFICANT_MOVE_METRES = 1500;
/** Periodic auto-refresh interval (12 minutes). */
export const WEATHER_REFRESH_INTERVAL_MS = 12 * 60 * 1000;
/** Request timeout for weather and geocoding calls. */
const FETCH_TIMEOUT_MS = 12_000;

export interface CurrentWeatherData {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  rain: number;
  precipitationProbability: number | null;
  weatherCode: number;
  condition: WeatherCodeInfo;
  cloudCover: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  isDay: boolean;
  observationTime: string;
}

export interface HourlyForecastItem {
  time: string;
  temperature: number;
  weatherCode: number;
  condition: WeatherCodeInfo;
  precipitationProbability: number;
  precipitation: number;
  windSpeed: number;
  isDay: boolean;
}

export interface DailyForecastItem {
  date: string;
  weatherCode: number;
  condition: WeatherCodeInfo;
  tempMin: number;
  tempMax: number;
  precipitationProbabilityMax: number;
  precipitationSum: number;
  windSpeedMax: number;
}

export interface WeatherForecastPayload {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone: string;
  timezoneAbbreviation: string;
  current: CurrentWeatherData;
  hourly: HourlyForecastItem[];
  daily: DailyForecastItem[];
  fetchedAt: number;
}

export interface ReverseGeocodeResult {
  name: string;
  region: string | null;
}

interface OpenMeteoRawResponse {
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone?: string;
  timezone_abbreviation?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    is_day?: number;
    precipitation?: number;
    rain?: number;
    weather_code?: number;
    cloud_cover?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wind_gusts_10m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation_probability?: number[];
    precipitation?: number[];
    weather_code?: number[];
    wind_speed_10m?: number[];
    is_day?: number[];
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    precipitation_probability_max?: number[];
    wind_speed_10m_max?: number[];
  };
  error?: boolean;
  reason?: string;
}

interface WeatherCacheEntry {
  lat: number;
  lon: number;
  payload: WeatherForecastPayload;
}

const WEATHER_SESSION_CACHE_KEY = 'raksa.personal_weather.cache.v1';
const GEOCODE_CACHE = new Map<string, ReverseGeocodeResult>();

let memoryWeatherCache: WeatherCacheEntry | null = null;
let inFlightWeatherPromise: { key: string; promise: Promise<WeatherForecastPayload> } | null = null;
let inFlightGeocodePromises = new Map<string, Promise<ReverseGeocodeResult | null>>();

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readSessionCache(): WeatherCacheEntry | null {
  if (memoryWeatherCache) return memoryWeatherCache;
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(WEATHER_SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeatherCacheEntry;
    if (
      parsed &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lon === 'number' &&
      parsed.payload &&
      typeof parsed.payload.fetchedAt === 'number' &&
      parsed.payload.current
    ) {
      memoryWeatherCache = parsed;
      return parsed;
    }
  } catch {
    /* ignore corrupt cache */
  }
  return null;
}

function writeSessionCache(entry: WeatherCacheEntry): void {
  memoryWeatherCache = entry;
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(WEATHER_SESSION_CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* storage quota or private mode */
  }
}

export function clearWeatherServiceCache(): void {
  memoryWeatherCache = null;
  inFlightWeatherPromise = null;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(WEATHER_SESSION_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function getCachedWeatherForCoords(lat: number, lon: number, maxAgeMs = WEATHER_CACHE_TTL_MS): WeatherForecastPayload | null {
  const entry = readSessionCache();
  if (!entry) return null;
  const age = Date.now() - entry.payload.fetchedAt;
  if (age > maxAgeMs) return null;
  const moved = distanceM({ lat: entry.lat, lon: entry.lon }, { lat, lon });
  if (moved >= SIGNIFICANT_MOVE_METRES) return null;
  return entry.payload;
}

function findCurrentHourIndex(hourlyTimes: string[], currentObservationTime?: string): number {
  if (hourlyTimes.length === 0) return 0;
  if (currentObservationTime) {
    // Open-Meteo current.time looks like "2026-11-29T09:15"; match the hour prefix "2026-11-29T09:00"
    const hourPrefix = currentObservationTime.slice(0, 13);
    const exactHourIdx = hourlyTimes.findIndex((t) => t.startsWith(hourPrefix));
    if (exactHourIdx >= 0) return exactHourIdx;
  }
  const nowMs = Date.now();
  const idx = hourlyTimes.findIndex((t) => {
    const ms = Date.parse(t);
    return Number.isFinite(ms) && ms >= nowMs - 30 * 60 * 1000;
  });
  return idx >= 0 ? idx : 0;
}

function parseOpenMeteoResponse(raw: OpenMeteoRawResponse, requestedLat: number, requestedLon: number): WeatherForecastPayload {
  if (raw.error) {
    throw new Error(raw.reason || 'Open-Meteo returned an API error.');
  }
  if (!raw.current) {
    throw new Error('Open-Meteo response did not include current weather data.');
  }

  const hourlyTimes = raw.hourly?.time ?? [];
  const startIdx = findCurrentHourIndex(hourlyTimes, raw.current.time);

  // Build next 24 hours starting at current local hour
  const hourly: HourlyForecastItem[] = [];
  const endIdx = Math.min(hourlyTimes.length, startIdx + 24);
  for (let i = startIdx; i < endIdx; i++) {
    const code = num(raw.hourly?.weather_code?.[i], 0);
    hourly.push({
      time: hourlyTimes[i],
      temperature: num(raw.hourly?.temperature_2m?.[i], NaN),
      weatherCode: code,
      condition: describeWeatherCode(code),
      precipitationProbability: num(raw.hourly?.precipitation_probability?.[i], 0),
      precipitation: num(raw.hourly?.precipitation?.[i], 0),
      windSpeed: num(raw.hourly?.wind_speed_10m?.[i], 0),
      isDay: num(raw.hourly?.is_day?.[i], 1) === 1,
    });
  }

  // Build 5-day daily forecast
  const dailyTimes = raw.daily?.time ?? [];
  const daily: DailyForecastItem[] = [];
  const dayLimit = Math.min(dailyTimes.length, 5);
  for (let i = 0; i < dayLimit; i++) {
    const code = num(raw.daily?.weather_code?.[i], 0);
    daily.push({
      date: dailyTimes[i],
      weatherCode: code,
      condition: describeWeatherCode(code),
      tempMin: num(raw.daily?.temperature_2m_min?.[i], NaN),
      tempMax: num(raw.daily?.temperature_2m_max?.[i], NaN),
      precipitationProbabilityMax: num(raw.daily?.precipitation_probability_max?.[i], 0),
      precipitationSum: num(raw.daily?.precipitation_sum?.[i], 0),
      windSpeedMax: num(raw.daily?.wind_speed_10m_max?.[i], 0),
    });
  }

  const currentCode = num(raw.current.weather_code, 0);
  const currentRainProb =
    hourly.length > 0 && Number.isFinite(hourly[0].precipitationProbability)
      ? hourly[0].precipitationProbability
      : daily.length > 0
        ? daily[0].precipitationProbabilityMax
        : null;

  const current: CurrentWeatherData = {
    temperature: num(raw.current.temperature_2m, NaN),
    apparentTemperature: num(raw.current.apparent_temperature, NaN),
    humidity: num(raw.current.relative_humidity_2m, NaN),
    precipitation: num(raw.current.precipitation, 0),
    rain: num(raw.current.rain, 0),
    precipitationProbability: currentRainProb,
    weatherCode: currentCode,
    condition: describeWeatherCode(currentCode),
    cloudCover: num(raw.current.cloud_cover, 0),
    windSpeed: num(raw.current.wind_speed_10m, 0),
    windDirection: num(raw.current.wind_direction_10m, 0),
    windGusts: num(raw.current.wind_gusts_10m, 0),
    isDay: num(raw.current.is_day, 1) === 1,
    observationTime: raw.current.time ?? new Date().toISOString(),
  };

  return {
    latitude: num(raw.latitude, requestedLat),
    longitude: num(raw.longitude, requestedLon),
    elevation: typeof raw.elevation === 'number' ? raw.elevation : undefined,
    timezone: raw.timezone ?? 'auto',
    timezoneAbbreviation: raw.timezone_abbreviation ?? '',
    current,
    hourly,
    daily,
    fetchedAt: Date.now(),
  };
}

async function fetchJsonWithTimeout<T>(url: string, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort, { once: true });

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} (${res.statusText || 'request failed'})`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Weather service request timed out.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Fetches personalized weather data from Open-Meteo strictly for the provided device coordinates.
 * Supports short-term coordinate-matched caching and in-flight request deduplication.
 */
export async function fetchOpenMeteoWeather(
  lat: number,
  lon: number,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<WeatherForecastPayload> {
  const force = options?.force ?? false;

  if (!force) {
    const cached = getCachedWeatherForCoords(lat, lon);
    if (cached) return cached;
  }

  const dedupeKey = `${lat.toFixed(3)},${lon.toFixed(3)}:${force ? 'force' : 'normal'}`;
  if (inFlightWeatherPromise && inFlightWeatherPromise.key === dedupeKey) {
    return inFlightWeatherPromise.promise;
  }

  const params = new URLSearchParams({
    latitude: lat.toFixed(5),
    longitude: lon.toFixed(5),
    timezone: 'auto',
    forecast_days: '6',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'is_day',
      'precipitation',
      'rain',
      'weather_code',
      'cloud_cover',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    hourly: [
      'temperature_2m',
      'precipitation_probability',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'is_day',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
    ].join(','),
  });

  const url = `${OPEN_METEO_ENDPOINT}?${params.toString()}`;

  const promise = fetchJsonWithTimeout<OpenMeteoRawResponse>(url, options?.signal)
    .then((raw) => {
      const payload = parseOpenMeteoResponse(raw, lat, lon);
      writeSessionCache({ lat, lon, payload });
      return payload;
    })
    .finally(() => {
      if (inFlightWeatherPromise?.key === dedupeKey) {
        inFlightWeatherPromise = null;
      }
    });

  inFlightWeatherPromise = { key: dedupeKey, promise };
  return promise;
}

interface BigDataCloudResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
  localityInfo?: {
    administrative?: Array<{ name?: string; order?: number }>;
  };
}

/**
 * Resolves the authenticated user's nearest recognizable city/area from browser GPS coordinates.
 * Uses BigDataCloud's keyless client-side reverse geocoder with in-memory grid caching.
 * Returns null gracefully on network/CORS errors so weather rendering is never blocked.
 */
export async function reverseGeocodeLocation(lat: number, lon: number): Promise<ReverseGeocodeResult | null> {
  // Grid cache at ~1.1 km precision to avoid duplicate reverse-geocode calls
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = GEOCODE_CACHE.get(cacheKey);
  if (cached) return cached;

  const existing = inFlightGeocodePromises.get(cacheKey);
  if (existing) return existing;

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    localityLanguage: 'en',
  });
  const url = `${BIGDATACLOUD_REVERSE_ENDPOINT}?${params.toString()}`;

  const promise = fetchJsonWithTimeout<BigDataCloudResponse>(url)
    .then((data) => {
      const primary =
        data.city?.trim() ||
        data.locality?.trim() ||
        data.principalSubdivision?.trim() ||
        '';
      if (!primary) return null;

      const regionParts: string[] = [];
      if (data.principalSubdivision?.trim() && data.principalSubdivision.trim().toLowerCase() !== primary.toLowerCase()) {
        regionParts.push(data.principalSubdivision.trim());
      }
      if (data.countryName?.trim() && data.countryName.trim().toLowerCase() !== primary.toLowerCase()) {
        regionParts.push(data.countryName.trim());
      }

      const result: ReverseGeocodeResult = {
        name: primary,
        region: regionParts.length > 0 ? regionParts.join(', ') : null,
      };
      GEOCODE_CACHE.set(cacheKey, result);
      return result;
    })
    .catch(() => null)
    .finally(() => {
      inFlightGeocodePromises.delete(cacheKey);
    });

  inFlightGeocodePromises.set(cacheKey, promise);
  return promise;
}
