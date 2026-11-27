import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Compass, Layers, Maximize, Minus, Plus, Ruler, Spline, Mountain } from 'lucide-react';
import { BASEMAPS, BASEMAP_ORDER } from '../../lib/mapStyle';
import type { BasemapId } from '../../types';

function Btn({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-[34px] w-[34px] items-center justify-center transition-colors ${active ? 'bg-forest-tint text-forest' : 'text-ink-2 hover:bg-canvas hover:text-ink'}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <div className="mx-1.5 h-px bg-line" />;

export function MapToolbar({
  basemap,
  onBasemap,
  terrain3d,
  onToggle3d,
  onFit,
  onZoom,
  bearing,
  onResetBearing,
  measure,
  onMeasure,
  vector,
  onVector,
}: {
  basemap: BasemapId;
  onBasemap: (b: BasemapId) => void;
  terrain3d: boolean;
  onToggle3d: () => void;
  onFit: () => void;
  onZoom: (d: 1 | -1) => void;
  bearing: number;
  onResetBearing: () => void;
  measure: boolean;
  onMeasure: () => void;
  vector: boolean;
  onVector: () => void;
}) {
  const [layersOpen, setLayersOpen] = useState(false);
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
      <div className="relative overflow-visible rounded-panel border border-line bg-surface py-0.5 shadow-float">
        <div className="relative">
          <Btn label="Map layers" onClick={() => setLayersOpen((o) => !o)} active={layersOpen}>
            <Layers size={17} />
          </Btn>
          <AnimatePresence>
            {layersOpen && (
              <motion.div
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.12 }}
                className="absolute right-full top-0 mr-2 w-[150px] overflow-hidden rounded-ctl border border-line bg-surface p-1 shadow-float"
                role="menu"
              >
                {BASEMAP_ORDER.map((id) => (
                  <button
                    key={id}
                    role="menuitemradio"
                    aria-checked={basemap === id}
                    onClick={() => {
                      onBasemap(id);
                      setLayersOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-chip px-2 py-1.5 text-left text-[12.5px] font-semibold ${basemap === id ? 'bg-forest-tint text-forest' : 'text-ink-2 hover:bg-canvas'}`}
                  >
                    <span className={`h-2 w-2 rounded-full border ${basemap === id ? 'border-forest bg-forest' : 'border-line-strong'}`} />
                    {BASEMAPS[id].label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <Btn label={terrain3d ? 'Switch to 2D flat (3)' : 'Switch to 3D mountain terrain (3)'} onClick={onToggle3d} active={terrain3d}>
          {terrain3d ? <Mountain size={17} /> : <Box size={17} />}
        </Btn>
        <Sep />
        <Btn label="Fit all markers" onClick={onFit}>
          <Maximize size={16} />
        </Btn>
        <Btn label="Zoom in" onClick={() => onZoom(1)}>
          <Plus size={16} />
        </Btn>
        <Btn label="Zoom out" onClick={() => onZoom(-1)}>
          <Minus size={16} />
        </Btn>
        <Btn label="Reset bearing to north" onClick={onResetBearing}>
          <Compass size={17} style={{ transform: `rotate(${-bearing}deg)`, transition: 'transform 80ms linear' }} />
        </Btn>
        <Sep />
        <Btn label="Tactical measure (click two points)" onClick={onMeasure} active={measure}>
          <Ruler size={16} />
        </Btn>
        <Btn label="Basecamp rescue vector" onClick={onVector} active={vector}>
          <Spline size={16} />
        </Btn>
      </div>
      <div className="num rounded-chip border border-line bg-surface/95 px-2 py-0.5 text-[10.5px] font-semibold text-ink-2 shadow-hair">
        {terrain3d ? '3D TERRAIN' : '2D FLAT'}
      </div>
    </div>
  );
}
