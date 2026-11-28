export type WeatherUnitSystem = 'metric' | 'imperial';

export type WeatherIconKind =
  | 'clear'
  | 'mainly-clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'freezing-drizzle'
  | 'rain-light'
  | 'rain-heavy'
  | 'freezing-rain'
  | 'snow'
  | 'showers'
  | 'thunderstorm'
  | 'thunderstorm-hail'
  | 'unknown';

export interface WeatherCodeInfo {
  code: number;
  label: string;
  shortLabel: string;
  icon: WeatherIconKind;
  severity: 'normal' | 'caution' | 'adverse';
}

/**
 * WMO Weather interpretation codes (WW) as documented by Open-Meteo.
 * Converts numeric codes into clear human-readable meteorological descriptions.
 */
const WMO_MAP: Record<number, Omit<WeatherCodeInfo, 'code'>> = {
  0: { label: 'Clear Sky', shortLabel: 'Clear', icon: 'clear', severity: 'normal' },
  1: { label: 'Mainly Clear', shortLabel: 'Mainly Clear', icon: 'mainly-clear', severity: 'normal' },
  2: { label: 'Partly Cloudy', shortLabel: 'Partly Cloudy', icon: 'partly-cloudy', severity: 'normal' },
  3: { label: 'Overcast', shortLabel: 'Overcast', icon: 'overcast', severity: 'normal' },
  45: { label: 'Fog', shortLabel: 'Fog', icon: 'fog', severity: 'caution' },
  48: { label: 'Depositing Rime Fog', shortLabel: 'Rime Fog', icon: 'fog', severity: 'caution' },
  51: { label: 'Light Drizzle', shortLabel: 'Light Drizzle', icon: 'drizzle', severity: 'normal' },
  53: { label: 'Moderate Drizzle', shortLabel: 'Drizzle', icon: 'drizzle', severity: 'caution' },
  55: { label: 'Dense Drizzle', shortLabel: 'Dense Drizzle', icon: 'drizzle', severity: 'caution' },
  56: { label: 'Light Freezing Drizzle', shortLabel: 'Freezing Drizzle', icon: 'freezing-drizzle', severity: 'adverse' },
  57: { label: 'Dense Freezing Drizzle', shortLabel: 'Freezing Drizzle', icon: 'freezing-drizzle', severity: 'adverse' },
  61: { label: 'Slight Rain', shortLabel: 'Light Rain', icon: 'rain-light', severity: 'normal' },
  63: { label: 'Moderate Rain', shortLabel: 'Moderate Rain', icon: 'rain-light', severity: 'caution' },
  65: { label: 'Heavy Rain', shortLabel: 'Heavy Rain', icon: 'rain-heavy', severity: 'adverse' },
  66: { label: 'Light Freezing Rain', shortLabel: 'Freezing Rain', icon: 'freezing-rain', severity: 'adverse' },
  67: { label: 'Heavy Freezing Rain', shortLabel: 'Heavy Freezing Rain', icon: 'freezing-rain', severity: 'adverse' },
  71: { label: 'Slight Snowfall', shortLabel: 'Light Snow', icon: 'snow', severity: 'caution' },
  73: { label: 'Moderate Snowfall', shortLabel: 'Snowfall', icon: 'snow', severity: 'caution' },
  75: { label: 'Heavy Snowfall', shortLabel: 'Heavy Snow', icon: 'snow', severity: 'adverse' },
  77: { label: 'Snow Grains', shortLabel: 'Snow Grains', icon: 'snow', severity: 'caution' },
  80: { label: 'Slight Rain Showers', shortLabel: 'Light Showers', icon: 'showers', severity: 'normal' },
  81: { label: 'Moderate Rain Showers', shortLabel: 'Rain Showers', icon: 'showers', severity: 'caution' },
  82: { label: 'Violent Rain Showers', shortLabel: 'Heavy Showers', icon: 'rain-heavy', severity: 'adverse' },
  85: { label: 'Slight Snow Showers', shortLabel: 'Snow Showers', icon: 'snow', severity: 'caution' },
  86: { label: 'Heavy Snow Showers', shortLabel: 'Heavy Snow Showers', icon: 'snow', severity: 'adverse' },
  95: { label: 'Thunderstorm', shortLabel: 'Thunderstorm', icon: 'thunderstorm', severity: 'adverse' },
  96: { label: 'Thunderstorm with Slight Hail', shortLabel: 'Storm & Hail', icon: 'thunderstorm-hail', severity: 'adverse' },
  99: { label: 'Thunderstorm with Heavy Hail', shortLabel: 'Severe Storm', icon: 'thunderstorm-hail', severity: 'adverse' },
};

export function describeWeatherCode(code: number): WeatherCodeInfo {
  const entry = WMO_MAP[code];
  if (entry) return { code, ...entry };
  return {
    code,
    label: 'Variable Conditions',
    shortLabel: 'Variable',
    icon: 'unknown',
    severity: 'normal',
  };
}

export function formatTemperature(celsius: number, units: WeatherUnitSystem, decimals = 0): string {
  if (!Number.isFinite(celsius)) return '—';
  const value = units === 'imperial' ? (celsius * 9) / 5 + 32 : celsius;
  const suffix = units === 'imperial' ? '°F' : '°C';
  return `${value.toFixed(decimals)}${suffix}`;
}

export function formatWindSpeed(kmh: number, units: WeatherUnitSystem, decimals = 0): string {
  if (!Number.isFinite(kmh)) return '—';
  const value = units === 'imperial' ? kmh * 0.621371 : kmh;
  const suffix = units === 'imperial' ? 'mph' : 'km/h';
  return `${value.toFixed(decimals)} ${suffix}`;
}

export function formatPrecipitation(mm: number, units: WeatherUnitSystem): string {
  if (!Number.isFinite(mm)) return '—';
  if (units === 'imperial') {
    const inches = mm * 0.0393701;
    return `${inches < 0.01 && inches > 0 ? '<0.01' : inches.toFixed(2)} in`;
  }
  return `${mm < 0.1 && mm > 0 ? '<0.1' : mm.toFixed(1)} mm`;
}

export function formatShortTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function formatIsoHour(isoLocal: string): string {
  // Open-Meteo returns local ISO strings such as "2026-11-29T14:00"
  const match = isoLocal.match(/T(\d{2}:\d{2})/);
  if (match) return match[1];
  const parsed = Date.parse(isoLocal);
  return Number.isFinite(parsed) ? formatShortTime(parsed) : isoLocal;
}

export function formatIsoDay(isoDate: string, index: number): { dayName: string; dateLabel: string } {
  // Parse YYYY-MM-DD in local calendar without UTC day-shift bugs
  const parts = isoDate.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const monthDay = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    if (index === 0) return { dayName: 'Today', dateLabel: monthDay };
    if (index === 1) return { dayName: 'Tomorrow', dateLabel: monthDay };
    return { dayName: weekday, dateLabel: monthDay };
  }
  return { dayName: isoDate, dateLabel: '' };
}

export function formatCompactCoords(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}
