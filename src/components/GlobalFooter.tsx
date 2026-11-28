import { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronUp,
  Clock,
  Cloud,
  CloudRain,
  Compass,
  Droplets,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPin,
  MapPinOff,
  RefreshCw,
  Thermometer,
  Umbrella,
  Wind,
  X,
} from 'lucide-react';
import { WeatherIcon } from './WeatherIcon';
import { useAuth } from '../store/auth';
import { useWeather, type GeolocationStatus } from '../store/weather';
import { useNow } from '../hooks';
import { cardinal } from '../lib/geo';
import { formatAgo } from '../lib/format';
import {
  formatCompactCoords,
  formatIsoDay,
  formatIsoHour,
  formatPrecipitation,
  formatShortTime,
  formatTemperature,
  formatWindSpeed,
} from '../lib/weatherCodes';

function geoStatusMeta(status: GeolocationStatus): { title: string; short: string; canRetry: boolean } {
  switch (status) {
    case 'acquiring':
    case 'idle':
      return { title: 'Acquiring Device Location', short: 'Locating…', canRetry: false };
    case 'denied':
      return { title: 'Location Permission Denied', short: 'Location denied', canRetry: true };
    case 'unavailable':
      return { title: 'Device Location Unavailable', short: 'Location unavailable', canRetry: true };
    case 'timeout':
      return { title: 'Location Request Timed Out', short: 'Location timeout', canRetry: true };
    case 'unsupported':
      return { title: 'Geolocation Unsupported', short: 'GPS unsupported', canRetry: false };
    case 'granted':
      return { title: 'Device Location Active', short: 'Located', canRetry: true };
  }
}

export function GlobalFooter() {
  const user = useAuth((s) => s.user);
  const {
    geoStatus,
    geoError,
    coords,
    locationName,
    locationRegion,
    weather,
    loadingWeather,
    refreshing,
    stale,
    weatherError,
    lastUpdatedAt,
    units,
    panelOpen,
    setUnits,
    setPanelOpen,
    togglePanel,
    requestRefresh,
    requestRelocate,
  } = useWeather();

  const now = useNow(30_000);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on outside pointer click
  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [panelOpen, setPanelOpen]);

  const displayLocation = useMemo(() => {
    if (locationName) return locationName;
    if (coords) return formatCompactCoords(coords.lat, coords.lon);
    return 'Your Location';
  }, [locationName, coords]);

  const dailyBounds = useMemo(() => {
    if (!weather || weather.daily.length === 0) return { min: 0, max: 1 };
    let min = Infinity;
    let max = -Infinity;
    for (const d of weather.daily) {
      if (Number.isFinite(d.tempMin)) min = Math.min(min, d.tempMin);
      if (Number.isFinite(d.tempMax)) max = Math.max(max, d.tempMax);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return { min: 0, max: 1 };
    return { min, max };
  }, [weather]);

  const geoMeta = geoStatusMeta(geoStatus);
  const updatedClock = lastUpdatedAt ? formatShortTime(lastUpdatedAt) : null;
  const updatedAgo = lastUpdatedAt ? formatAgo(now - lastUpdatedAt) : null;
  const current = weather?.current ?? null;
  const todayDaily = weather?.daily[0] ?? null;

  return (
    <footer
      ref={containerRef}
      aria-label="Global dashboard status and personal weather footer"
      className="relative z-30 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line bg-surface px-3 py-1.5 text-[11.5px] text-ink-2 md:px-4"
    >
      {/* Left: Compact RAKSA System Bar Info */}
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-forest" aria-hidden />
        <span className="truncate font-semibold tracking-[0.04em] text-ink">RAKSA Basecamp</span>
        <span className="text-line-strong" aria-hidden>
          |
        </span>
        <span className="hidden truncate text-[11px] text-ink-muted xl:inline">
          Personal Device Weather · {user?.role ?? 'OPERATOR'} Session
        </span>
        <span className="truncate text-[11px] text-ink-muted xl:hidden">Local Weather</span>
      </div>

      {/* Right: Compact Personal GPS Weather Widget */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-initial">
        {/* Geolocation acquiring state */}
        {(geoStatus === 'idle' || geoStatus === 'acquiring') && !weather && (
          <button
            type="button"
            onClick={togglePanel}
            aria-expanded={panelOpen}
            className="inline-flex h-7 items-center gap-2 rounded-ctl border border-line bg-canvas px-2.5 text-[11.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-surface hover:text-ink"
          >
            <Loader2 size={13} className="shrink-0 animate-spin text-forest" />
            <span className="truncate">Acquiring your device location…</span>
            <ChevronUp size={13} className={`shrink-0 text-ink-muted transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
          </button>
        )}

        {/* Geolocation error / unsupported state (no weather available) */}
        {(geoStatus === 'denied' || geoStatus === 'unavailable' || geoStatus === 'timeout' || geoStatus === 'unsupported') && !weather && (
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={togglePanel}
              aria-expanded={panelOpen}
              className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-ctl border border-amber/40 bg-amber-tint px-2.5 text-[11.5px] font-semibold text-amber-ink transition-colors hover:border-amber"
              title={geoError ?? geoMeta.title}
            >
              {geoStatus === 'timeout' ? (
                <Clock size={13} className="shrink-0" />
              ) : (
                <MapPinOff size={13} className="shrink-0" />
              )}
              <span className="text-[10px] font-bold uppercase tracking-[0.06em] opacity-80 max-sm:hidden">Weather</span>
              <span className="max-sm:hidden opacity-40" aria-hidden>
                |
              </span>
              <span className="truncate">{geoMeta.short}</span>
              <ChevronUp size={13} className={`shrink-0 transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
            </button>
            {geoMeta.canRetry && (
              <button
                type="button"
                onClick={requestRelocate}
                className="btn h-7 px-2 text-[11px]"
                title="Retry acquiring your device location"
              >
                <LocateFixed size={12} />
                <span className="max-sm:hidden">Retry</span>
              </button>
            )}
          </div>
        )}

        {/* Initial weather loading state (after GPS acquired) */}
        {geoStatus === 'granted' && loadingWeather && !weather && (
          <button
            type="button"
            onClick={togglePanel}
            aria-expanded={panelOpen}
            className="inline-flex h-7 items-center gap-2 rounded-ctl border border-line bg-canvas px-2.5 text-[11.5px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-surface"
          >
            <MapPin size={12} className="shrink-0 text-forest" />
            <span className="max-w-[130px] truncate font-semibold uppercase tracking-[0.04em] text-ink">{displayLocation}</span>
            <span className="text-line-strong" aria-hidden>
              |
            </span>
            <Loader2 size={13} className="shrink-0 animate-spin text-forest" />
            <span>Loading weather…</span>
          </button>
        )}

        {/* Weather fetch failed on initial load (GPS granted, no cached weather) */}
        {geoStatus === 'granted' && !loadingWeather && !weather && weatherError && (
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={togglePanel}
              aria-expanded={panelOpen}
              className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-ctl border border-amber/40 bg-amber-tint px-2.5 text-[11.5px] font-semibold text-amber-ink transition-colors hover:border-amber"
            >
              <AlertTriangle size={13} className="shrink-0" />
              <span className="truncate">{displayLocation}: Weather unavailable</span>
              <ChevronUp size={13} className={`shrink-0 transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
            </button>
            <button type="button" onClick={requestRefresh} className="btn h-7 px-2 text-[11px]" title="Retry weather request">
              <RefreshCw size={12} />
              <span className="max-sm:hidden">Retry</span>
            </button>
          </div>
        )}

        {/* Active compact weather bar (fresh or stale cached data) */}
        {current && (
          <button
            type="button"
            onClick={togglePanel}
            aria-expanded={panelOpen}
            aria-controls="personal-weather-popover"
            title="Click to open detailed personal weather forecast (hourly & 5-day)"
            className={`group flex min-w-0 max-w-full items-center gap-2 rounded-ctl border px-2.5 py-1 text-left transition-colors ${
              stale
                ? 'border-amber/50 bg-amber-tint/50 hover:border-amber hover:bg-amber-tint/80'
                : panelOpen
                  ? 'border-forest/40 bg-forest-tint/40'
                  : 'border-line bg-canvas/80 hover:border-line-strong hover:bg-canvas'
            }`}
          >
            {/* Location badge */}
            <span className="flex min-w-0 items-center gap-1">
              <span className="hidden text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted sm:inline">Weather</span>
              <span className="hidden text-line-strong sm:inline" aria-hidden>
                |
              </span>
              <MapPin size={12} className="shrink-0 text-forest" />
              <span className="max-w-[110px] truncate text-[11px] font-bold uppercase tracking-[0.04em] text-ink sm:max-w-[150px]">
                {displayLocation}
              </span>
            </span>

            <span className="h-3.5 w-px shrink-0 bg-line-strong/80" aria-hidden />

            {/* Icon + Temperature + Short Condition */}
            <span className="flex shrink-0 items-center gap-1.5">
              <WeatherIcon kind={current.condition.icon} isDay={current.isDay} size={15} />
              <span className="num text-[12.5px] font-bold text-ink">{formatTemperature(current.temperature, units)}</span>
              <span className="hidden max-w-[115px] truncate text-[11.5px] font-medium text-ink-2 min-[420px]:inline">
                {current.condition.shortLabel}
              </span>
            </span>

            {/* Secondary metrics — progressively revealed by viewport width */}
            <span className="hidden h-3.5 w-px shrink-0 bg-line-strong/80 lg:block" aria-hidden />
            <span className="num hidden shrink-0 items-center gap-1 text-[11px] text-ink-2 lg:inline-flex" title="Feels like temperature">
              <span className="font-sans text-ink-muted">Feels</span>
              <span className="font-semibold text-ink">{formatTemperature(current.apparentTemperature, units)}</span>
            </span>

            <span className="num hidden shrink-0 items-center gap-1 text-[11px] text-ink-2 xl:inline-flex" title="Relative humidity">
              <Droplets size={11} className="text-sky-600" />
              <span>{Math.round(current.humidity)}%</span>
            </span>

            {current.precipitationProbability !== null && (
              <span className="num hidden shrink-0 items-center gap-1 text-[11px] text-ink-2 md:inline-flex" title="Rain probability">
                <Umbrella size={11} className="text-sky-600" />
                <span>{Math.round(current.precipitationProbability)}%</span>
              </span>
            )}

            <span className="num hidden shrink-0 items-center gap-1 text-[11px] text-ink-2 lg:inline-flex" title="Wind speed">
              <Wind size={11} className="text-slate-500" />
              <span>{formatWindSpeed(current.windSpeed, units)}</span>
            </span>

            {/* Updated timestamp or stale indicator */}
            {updatedClock && (
              <>
                <span className="hidden h-3.5 w-px shrink-0 bg-line-strong/80 sm:block" aria-hidden />
                <span className="num hidden shrink-0 items-center gap-1 text-[10.5px] text-ink-muted sm:inline-flex">
                  {stale ? (
                    <span className="inline-flex items-center gap-1 rounded-chip border border-amber/40 bg-amber-tint px-1.5 py-px font-sans text-[10px] font-bold text-amber-ink">
                      <AlertTriangle size={10} />
                      Stale · {updatedClock}
                    </span>
                  ) : refreshing ? (
                    <span className="inline-flex items-center gap-1 text-forest">
                      <Loader2 size={10} className="animate-spin" />
                      Updating
                    </span>
                  ) : (
                    <span>Updated {updatedClock}</span>
                  )}
                </span>
              </>
            )}

            <ChevronUp
              size={14}
              className={`shrink-0 text-ink-muted transition-transform duration-150 group-hover:text-ink ${panelOpen ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Expandable Weather Forecast Popover (opens upward above global footer) */}
      <AnimatePresence>
        {panelOpen && (
          <motion.section
            id="personal-weather-popover"
            role="dialog"
            aria-label="Personal GPS Weather Forecast"
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full right-2 z-40 mb-2 flex max-h-[min(78dvh,640px)] w-[min(660px,calc(100vw-16px))] flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-float sm:right-4"
          >
            {/* Panel Header */}
            <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line bg-canvas/75 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-chip border border-forest/25 bg-forest-tint px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.06em] text-forest">
                    <MapPin size={10} />
                    Your Device Location
                  </span>
                  {coords && Number.isFinite(coords.accuracy) && (
                    <span className="num text-[10.5px] text-ink-muted" title="Estimated browser location accuracy">
                      ±{Math.round(coords.accuracy)} m
                    </span>
                  )}
                </div>
                <h2 className="mt-1 truncate text-[15px] font-bold leading-tight text-ink">
                  {coords ? displayLocation : geoMeta.title}
                </h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-2">
                  {locationRegion && <span>{locationRegion}</span>}
                  {coords && (
                    <span className="num text-ink-muted">
                      {coords.lat.toFixed(4)}°, {coords.lon.toFixed(4)}°
                      {weather?.elevation !== undefined ? ` · ${Math.round(weather.elevation)} m elev.` : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {/* Unit Switcher (°C / °F) */}
                <div
                  role="group"
                  aria-label="Weather units"
                  className="inline-flex h-7 items-center rounded-ctl border border-line bg-surface p-0.5 text-[11px] font-semibold"
                >
                  <button
                    type="button"
                    onClick={() => setUnits('metric')}
                    aria-pressed={units === 'metric'}
                    className={`rounded-[5px] px-2 py-0.5 transition-colors ${
                      units === 'metric' ? 'bg-forest text-white' : 'text-ink-2 hover:text-ink'
                    }`}
                    title="Metric (°C, km/h, mm)"
                  >
                    °C
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnits('imperial')}
                    aria-pressed={units === 'imperial'}
                    className={`rounded-[5px] px-2 py-0.5 transition-colors ${
                      units === 'imperial' ? 'bg-forest text-white' : 'text-ink-2 hover:text-ink'
                    }`}
                    title="Imperial (°F, mph, in)"
                  >
                    °F
                  </button>
                </div>

                {/* Re-locate GPS */}
                {geoStatus !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={requestRelocate}
                    disabled={geoStatus === 'acquiring'}
                    className="btn h-7 w-7 !px-0"
                    title="Re-acquire your device GPS location"
                    aria-label="Re-acquire device location"
                  >
                    <LocateFixed size={13} className={geoStatus === 'acquiring' ? 'animate-pulse text-forest' : ''} />
                  </button>
                )}

                {/* Manual Weather Refresh */}
                {coords && (
                  <button
                    type="button"
                    onClick={requestRefresh}
                    disabled={refreshing || loadingWeather}
                    className="btn h-7 gap-1 px-2 text-[11px]"
                    title="Refresh weather forecast now"
                  >
                    <RefreshCw size={12} className={refreshing || loadingWeather ? 'animate-spin text-forest' : ''} />
                    <span className="max-sm:hidden">Refresh</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="btn btn-ghost h-7 w-7 !px-0"
                  aria-label="Close weather forecast"
                >
                  <X size={15} />
                </button>
              </div>
            </header>

            {/* Scrollable Body */}
            <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {/* Permission Revoked Notice (when cached weather is still displayed) */}
              {current && geoStatus === 'denied' && geoError && (
                <div
                  role="status"
                  className="flex items-start justify-between gap-3 rounded-ctl border border-amber/40 bg-amber-tint p-2.5 text-[12px] text-amber-ink"
                >
                  <div className="flex items-start gap-2">
                    <MapPinOff size={15} className="mt-0.5 shrink-0" />
                    <div>
                      <div className="font-bold">Location permission revoked</div>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed">{geoError}</p>
                    </div>
                  </div>
                  <button type="button" onClick={requestRelocate} className="btn h-7 shrink-0 px-2.5 text-[11px]">
                    Retry
                  </button>
                </div>
              )}

              {/* Stale Data Banner (keeps latest good weather visible) */}
              {stale && weatherError && (
                <div
                  role="status"
                  className="flex items-start justify-between gap-3 rounded-ctl border border-amber/40 bg-amber-tint p-2.5 text-[12px] text-amber-ink"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <div>
                      <div className="font-bold">Showing cached weather (stale)</div>
                      <p className="mt-0.5 text-[11.5px] leading-relaxed">
                        {weatherError}
                        {updatedClock ? ` Last successful update at ${updatedClock} (${updatedAgo}).` : ''}
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={requestRefresh} className="btn h-7 shrink-0 px-2.5 text-[11px]">
                    Retry
                  </button>
                </div>
              )}

              {/* Geolocation Pending / Error / Unsupported States (when no weather yet) */}
              {!current && (
                <div className="rounded-ctl border border-line bg-canvas/60 p-4">
                  {(geoStatus === 'acquiring' || geoStatus === 'idle' || loadingWeather) && (
                    <div className="flex items-center gap-3 text-[12.5px] text-ink-2">
                      <Loader2 size={18} className="shrink-0 animate-spin text-forest" />
                      <div>
                        <div className="font-semibold text-ink">
                          {loadingWeather ? 'Retrieving local weather from Open-Meteo…' : 'Waiting for browser location…'}
                        </div>
                        <p className="mt-0.5 text-[11.5px] text-ink-muted">
                          Approve your browser&apos;s location prompt to view personalized weather for where you are accessing RAKSA.
                        </p>
                      </div>
                    </div>
                  )}

                  {(geoStatus === 'denied' || geoStatus === 'unavailable' || geoStatus === 'timeout' || geoStatus === 'unsupported') && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2.5">
                        <MapPinOff size={18} className="mt-0.5 shrink-0 text-amber-ink" />
                        <div>
                          <div className="text-[13px] font-bold text-ink">{geoMeta.title}</div>
                          <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{geoError}</p>
                        </div>
                      </div>

                      {geoStatus === 'denied' && (
                        <p className="rounded-chip border border-line bg-surface px-3 py-2 text-[11.5px] leading-relaxed text-ink-2">
                          Click the site permissions / lock icon in your browser&apos;s address bar, set <strong>Location</strong> to{' '}
                          <strong>Allow</strong>, and then click <strong>Retry Location</strong>.
                        </p>
                      )}

                      {geoMeta.canRetry && (
                        <button type="button" onClick={requestRelocate} className="btn btn-primary h-8 text-[12px]">
                          <LocateFixed size={14} />
                          Retry Location
                        </button>
                      )}
                    </div>
                  )}

                  {geoStatus === 'granted' && !loadingWeather && weatherError && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-ink" />
                        <div>
                          <div className="text-[13px] font-bold text-ink">Weather Service Temporarily Unavailable</div>
                          <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{weatherError}</p>
                        </div>
                      </div>
                      <button type="button" onClick={requestRefresh} className="btn btn-primary h-8 text-[12px]">
                        <RefreshCw size={13} />
                        Try Again
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Full Weather Content */}
              {current && weather && (
                <>
                  {/* Current Weather Hero + Detailed Telemetry Grid */}
                  <section aria-label="Current weather conditions" className="grid gap-3 sm:grid-cols-[200px_1fr]">
                    <div className="flex flex-col justify-between rounded-ctl border border-line bg-canvas/70 p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <WeatherIcon kind={current.condition.icon} isDay={current.isDay} size={34} />
                        <div className="text-right">
                          <div className="num text-[30px] font-bold leading-none text-ink">
                            {formatTemperature(current.temperature, units)}
                          </div>
                          <div className="mt-1 text-[11.5px] font-semibold text-ink-2">{current.condition.label}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[11px] text-ink-2">
                        <span className="inline-flex items-center gap-1">
                          <Thermometer size={12} className="text-ink-muted" />
                          Feels <strong className="num text-ink">{formatTemperature(current.apparentTemperature, units)}</strong>
                        </span>
                        {todayDaily && (
                          <span className="num text-ink-muted">
                            L:{formatTemperature(todayDaily.tempMin, units)} · H:{formatTemperature(todayDaily.tempMax, units)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <MetricCard
                        icon={<Droplets size={13} className="text-sky-600" />}
                        label="Humidity"
                        value={`${Math.round(current.humidity)}%`}
                      />
                      <MetricCard
                        icon={<Umbrella size={13} className="text-sky-600" />}
                        label="Rain Prob."
                        value={current.precipitationProbability !== null ? `${Math.round(current.precipitationProbability)}%` : '—'}
                      />
                      <MetricCard
                        icon={<CloudRain size={13} className="text-blue-600" />}
                        label="Precip / Rain"
                        value={formatPrecipitation(current.precipitation, units)}
                        sub={current.rain > 0 ? `Rain ${formatPrecipitation(current.rain, units)}` : 'No active rain'}
                      />
                      <MetricCard
                        icon={<Wind size={13} className="text-slate-600" />}
                        label="Wind"
                        value={formatWindSpeed(current.windSpeed, units)}
                        sub={`${cardinal(current.windDirection)} (${Math.round(current.windDirection)}°)`}
                      />
                      <MetricCard
                        icon={<Compass size={13} className="text-slate-600" />}
                        label="Wind Gusts"
                        value={formatWindSpeed(current.windGusts, units)}
                      />
                      <MetricCard
                        icon={<Cloud size={13} className="text-slate-500" />}
                        label="Cloud Cover"
                        value={`${Math.round(current.cloudCover)}%`}
                      />
                    </div>
                  </section>

                  {/* Hourly Forecast (Next 24 Hours) */}
                  {weather.hourly.length > 0 && (
                    <section aria-label="Hourly weather forecast">
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="label !text-ink-2">Hourly Forecast (Next {weather.hourly.length} Hours)</h3>
                        <span className="text-[10.5px] text-ink-muted">Scroll horizontally →</span>
                      </div>
                      <div className="scroll-thin flex gap-2 overflow-x-auto pb-1.5">
                        {weather.hourly.map((hour, idx) => (
                          <div
                            key={hour.time}
                            title={`${formatIsoHour(hour.time)} — ${hour.condition.label}`}
                            className={`flex w-[74px] shrink-0 flex-col items-center rounded-ctl border px-2 py-2 text-center ${
                              idx === 0 ? 'border-forest/35 bg-forest-tint/45' : 'border-line bg-canvas/55'
                            }`}
                          >
                            <span className={`num text-[10.5px] font-semibold ${idx === 0 ? 'text-forest' : 'text-ink-muted'}`}>
                              {idx === 0 ? 'Now' : formatIsoHour(hour.time)}
                            </span>
                            <div className="my-1.5">
                              <WeatherIcon kind={hour.condition.icon} isDay={hour.isDay} size={18} />
                            </div>
                            <span className="num text-[13px] font-bold text-ink">{formatTemperature(hour.temperature, units)}</span>
                            <span className="mt-0.5 w-full truncate text-[9.5px] text-ink-muted">{hour.condition.shortLabel}</span>
                            <div className="mt-1.5 flex flex-col items-center gap-0.5 border-t border-line/80 pt-1 text-[10px] text-ink-2">
                              <span className="num inline-flex items-center gap-0.5 text-sky-700" title="Rain probability">
                                <Droplets size={9} />
                                {Math.round(hour.precipitationProbability)}%
                              </span>
                              {hour.precipitation > 0 && (
                                <span className="num text-[9.5px] text-blue-700" title="Precipitation">
                                  {formatPrecipitation(hour.precipitation, units)}
                                </span>
                              )}
                              <span className="num inline-flex items-center gap-0.5 text-ink-muted" title="Wind speed">
                                <Wind size={9} />
                                {Math.round(units === 'imperial' ? hour.windSpeed * 0.621371 : hour.windSpeed)}
                                {units === 'imperial' ? 'mph' : 'km/h'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 5-Day Daily Forecast */}
                  {weather.daily.length > 0 && (
                    <section aria-label="5-day weather forecast">
                      <h3 className="label mb-2 !text-ink-2">5-Day Forecast</h3>
                      <div className="divide-y divide-line overflow-hidden rounded-ctl border border-line bg-canvas/40">
                        {weather.daily.map((day, idx) => {
                          const { dayName, dateLabel } = formatIsoDay(day.date, idx);
                          const span = Math.max(1, dailyBounds.max - dailyBounds.min);
                          const leftPct = Math.max(0, Math.min(100, ((day.tempMin - dailyBounds.min) / span) * 100));
                          const widthPct = Math.max(8, Math.min(100 - leftPct, ((day.tempMax - day.tempMin) / span) * 100));

                          return (
                            <div
                              key={day.date}
                              className="grid grid-cols-[88px_1fr_auto] items-center gap-2 px-3 py-2 text-[12px] sm:grid-cols-[108px_1fr_92px_138px]"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-ink">{dayName}</div>
                                <div className="num text-[10.5px] text-ink-muted">{dateLabel}</div>
                              </div>

                              <div className="flex min-w-0 items-center gap-2">
                                <WeatherIcon kind={day.condition.icon} isDay size={17} />
                                <div className="min-w-0">
                                  <div className="truncate text-[11.5px] text-ink-2">{day.condition.label}</div>
                                  <div className="num mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-ink-muted sm:hidden">
                                    <span className="inline-flex items-center gap-0.5 text-sky-700">
                                      <Droplets size={9} />
                                      {Math.round(day.precipitationProbabilityMax)}%
                                      {day.precipitationSum > 0 ? ` · ${formatPrecipitation(day.precipitationSum, units)}` : ''}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5">
                                      <Wind size={9} />
                                      {formatWindSpeed(day.windSpeedMax, units)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="hidden flex-col items-end text-[10.5px] sm:flex">
                                <span className="num inline-flex items-center gap-1 font-medium text-sky-700" title="Max rain probability">
                                  <Droplets size={10} />
                                  {Math.round(day.precipitationProbabilityMax)}%
                                  {day.precipitationSum > 0 && (
                                    <span className="text-ink-muted">· {formatPrecipitation(day.precipitationSum, units)}</span>
                                  )}
                                </span>
                                <span className="num inline-flex items-center gap-1 text-ink-muted" title="Max wind speed">
                                  <Wind size={10} />
                                  {formatWindSpeed(day.windSpeedMax, units)}
                                </span>
                              </div>

                              <div className="flex items-center justify-end gap-2">
                                <span className="num w-9 text-right text-[11.5px] text-ink-muted">
                                  {formatTemperature(day.tempMin, units)}
                                </span>
                                <div className="relative hidden h-1.5 w-14 overflow-hidden rounded-full bg-line sm:block" aria-hidden>
                                  <span
                                    className="absolute inset-y-0 rounded-full bg-forest/75"
                                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                  />
                                </div>
                                <span className="num w-9 text-right text-[12px] font-bold text-ink">
                                  {formatTemperature(day.tempMax, units)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>

            {/* Popover Attribution Footer */}
            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-canvas/75 px-4 py-2 text-[10.5px] text-ink-muted">
              <div className="flex items-center gap-2">
                {updatedClock ? (
                  <span className="num">
                    Updated {updatedClock}
                    {updatedAgo ? ` (${updatedAgo})` : ''}
                    {weather?.timezoneAbbreviation ? ` · ${weather.timezoneAbbreviation}` : ''}
                  </span>
                ) : (
                  <span>Personalized from your browser&apos;s location — independent of hiker GPS</span>
                )}
              </div>
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-forest hover:underline"
              >
                Weather data by Open-Meteo
                <ExternalLink size={10} />
              </a>
            </footer>
          </motion.section>
        )}
      </AnimatePresence>
    </footer>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-ctl border border-line bg-canvas/50 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="num mt-1 text-[13.5px] font-bold text-ink">{value}</div>
      {sub && <div className="num mt-0.5 truncate text-[10px] text-ink-muted">{sub}</div>}
    </div>
  );
}
