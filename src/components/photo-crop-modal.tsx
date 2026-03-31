"use client";

import * as React from "react";
import { X } from "lucide-react";

const VIEW = 280;
const OUTPUT = 512;

export type PhotoCropModalLabels = {
  title: string;
  apply: string;
  cancel: string;
  zoom: string;
  dragHint: string;
};

type PhotoCropModalProps = {
  imageSrc: string;
  labels: PhotoCropModalLabels;
  onCancel: () => void;
  onComplete: (dataUrl: string) => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function PhotoCropModal({ imageSrc, labels, onCancel, onComplete }: PhotoCropModalProps) {
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef<{ active: boolean; startX: number; startY: number; panX: number; panY: number } | null>(
    null,
  );
  const panInitRef = React.useRef(true);

  React.useEffect(() => {
    panInitRef.current = true;
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setNatural(null);
  }, [imageSrc]);

  React.useEffect(() => {
    const img = new window.Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => setNatural(null);
    img.src = imageSrc;
  }, [imageSrc]);

  const metrics = React.useMemo(() => {
    if (!natural || natural.w < 1 || natural.h < 1) return null;
    const base = Math.max(VIEW / natural.w, VIEW / natural.h);
    const scaledW = natural.w * base * zoom;
    const scaledH = natural.h * base * zoom;
    return { base, scaledW, scaledH, nw: natural.w, nh: natural.h };
  }, [natural, zoom]);

  const clampPan = React.useCallback(
    (x: number, y: number, sw: number, sh: number) => {
      const minX = VIEW - sw;
      const maxX = 0;
      const minY = VIEW - sh;
      const maxY = 0;
      return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
    },
    [],
  );

  const centerPan = React.useCallback(
    (sw: number, sh: number) => ({
      x: (VIEW - sw) / 2,
      y: (VIEW - sh) / 2,
    }),
    [],
  );

  React.useEffect(() => {
    if (!metrics) return;
    const { scaledW, scaledH } = metrics;
    if (panInitRef.current) {
      panInitRef.current = false;
      setPan(centerPan(scaledW, scaledH));
      return;
    }
    setPan((prev) => clampPan(prev.x, prev.y, scaledW, scaledH));
  }, [metrics, clampPan, centerPan]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!metrics) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d?.active || !metrics) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const next = clampPan(d.panX + dx, d.panY + dy, metrics.scaledW, metrics.scaledH);
    setPan(next);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.active) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
    dragRef.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!metrics) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.06 : 0.06;
    setZoom((z) => clamp(Number((z + delta).toFixed(2)), 1, 3));
  };

  const handleApply = () => {
    if (!metrics || !natural) return;
    const { scaledW, scaledH, nw, nh } = metrics;
    const { x: panX, y: panY } = pan;

    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = OUTPUT;
        canvas.height = OUTPUT;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          onCancel();
          return;
        }
        const sx = (-panX / scaledW) * nw;
        const sy = (-panY / scaledH) * nh;
        const sw = (VIEW / scaledW) * nw;
        const sh = (VIEW / scaledH) * nh;
        const csx = clamp(sx, 0, nw);
        const csy = clamp(sy, 0, nh);
        const csw = clamp(sw, 1, nw - csx);
        const csh = clamp(sh, 1, nh - csy);
        ctx.drawImage(img, csx, csy, csw, csh, 0, 0, OUTPUT, OUTPUT);
        onComplete(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        onCancel();
      }
    };
    img.onerror = () => onCancel();
    img.src = imageSrc;
  };

  return (
    <div
      className="no-print fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-crop-title"
    >
      <div className="relative w-full max-w-md rounded-xl border border-slate-600 bg-zinc-900 p-4 text-slate-100 shadow-xl">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-slate-200"
          aria-label={labels.cancel}
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <h2 id="photo-crop-title" className="mb-1 pr-8 text-sm font-semibold text-white">
          {labels.title}
        </h2>
        <p className="mb-3 text-xs text-slate-400">{labels.dragHint}</p>

        <div
          className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-lg bg-black ring-1 ring-cyan-500/40 active:cursor-grabbing"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          {metrics ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob URL preview
            <img
              src={imageSrc}
              alt=""
              draggable={false}
              className="pointer-events-none absolute select-none"
              style={{
                width: metrics.scaledW,
                height: metrics.scaledH,
                left: pan.x,
                top: pan.y,
                maxWidth: "none",
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">…</div>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2 text-xs text-slate-300">
          <span className="shrink-0">{labels.zoom}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.02}
            value={zoom}
            onChange={(ev) => setZoom(Number(ev.target.value))}
            className="h-1.5 flex-1 accent-cyan-400"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!metrics}
            className="rounded-md bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
          >
            {labels.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
