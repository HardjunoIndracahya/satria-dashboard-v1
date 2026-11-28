import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from 'lucide-react';
import type { WeatherIconKind } from '../lib/weatherCodes';

interface WeatherIconProps {
  kind: WeatherIconKind;
  isDay?: boolean;
  size?: number;
  className?: string;
}

/**
 * Day/night-aware weather condition icon styled to match RAKSA's Swiss GIS light palette.
 */
export function WeatherIcon({ kind, isDay = true, size = 16, className = '' }: WeatherIconProps) {
  switch (kind) {
    case 'clear':
      return isDay ? (
        <Sun size={size} className={`shrink-0 text-amber ${className}`} aria-hidden />
      ) : (
        <Moon size={size} className={`shrink-0 text-slate-600 ${className}`} aria-hidden />
      );
    case 'mainly-clear':
    case 'partly-cloudy':
      return isDay ? (
        <CloudSun size={size} className={`shrink-0 text-amber ${className}`} aria-hidden />
      ) : (
        <CloudMoon size={size} className={`shrink-0 text-slate-600 ${className}`} aria-hidden />
      );
    case 'overcast':
      return <Cloud size={size} className={`shrink-0 text-slate-500 ${className}`} aria-hidden />;
    case 'fog':
      return <CloudFog size={size} className={`shrink-0 text-slate-500 ${className}`} aria-hidden />;
    case 'drizzle':
    case 'freezing-drizzle':
      return <CloudDrizzle size={size} className={`shrink-0 text-sky-600 ${className}`} aria-hidden />;
    case 'rain-light':
    case 'showers':
    case 'freezing-rain':
      return <CloudRain size={size} className={`shrink-0 text-sky-600 ${className}`} aria-hidden />;
    case 'rain-heavy':
      return <CloudRainWind size={size} className={`shrink-0 text-blue-700 ${className}`} aria-hidden />;
    case 'snow':
      return <CloudSnow size={size} className={`shrink-0 text-sky-500 ${className}`} aria-hidden />;
    case 'thunderstorm':
      return <CloudLightning size={size} className={`shrink-0 text-amber-ink ${className}`} aria-hidden />;
    case 'thunderstorm-hail':
      return <CloudHail size={size} className={`shrink-0 text-crimson ${className}`} aria-hidden />;
    default:
      return <Cloud size={size} className={`shrink-0 text-slate-500 ${className}`} aria-hidden />;
  }
}
