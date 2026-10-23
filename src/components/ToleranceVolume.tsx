import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw } from 'lucide-react';
import type { ShotTolerance } from '../engine/types';
import './ToleranceVolume.css';

interface ToleranceVolumeProps {
  tolerance: ShotTolerance;
  label: string;
}

interface Vector3 { x: number; y: number; z: number }
interface Projection { x: number; y: number; depth: number }

const INITIAL_VIEW = { yaw: -0.66, pitch: 0.38 };
const CENTER = { x: 340, y: 225 };
const SCALE = 102;
const CORNERS: Vector3[] = Array.from({ length: 8 }, (_, index) => ({
  x: index & 1 ? 1 : -1,
  y: index & 2 ? 1 : -1,
  z: index & 4 ? 1 : -1,
}));
const EDGES = CORNERS.flatMap((_, index) => [1, 2, 4]
  .filter((bit) => (index & bit) === 0)
  .map((bit) => [index, index | bit] as const));

function project(point: Vector3, yaw: number, pitch: number): Projection {
  const horizontal = point.x * Math.cos(yaw) + point.z * Math.sin(yaw);
  const depth = -point.x * Math.sin(yaw) + point.z * Math.cos(yaw);
  return {
    x: CENTER.x + horizontal * SCALE,
    y: CENTER.y - (point.y * Math.cos(pitch) - depth * Math.sin(pitch)) * SCALE,
    depth: point.y * Math.sin(pitch) + depth * Math.cos(pitch),
  };
}

function signed(value: number, suffix = '') {
  return `${value > 0 ? '+' : ''}${Number(value.toFixed(2))}${suffix}`;
}

function strengthLabel(value: number) {
  return value === 0 ? 'Nominal strength' : `${signed(value, '%')} · ${value < 0 ? 'softer' : 'harder'}`;
}

export default function ToleranceVolume({ tolerance, label }: ToleranceVolumeProps) {
  const descriptionId = useId();
  const [view, setView] = useState(INITIAL_VIEW);
  const [showFailures, setShowFailures] = useState(false);
  const [slice, setSlice] = useState(false);
  const [sliceIndex, setSliceIndex] = useState<number | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const { points, limits } = tolerance.volume;
  const strengths = useMemo(() => [...new Set(points.map((point) => point.speed))].sort((a, b) => a - b), [points]);
  const nominalSliceIndex = Math.max(0, strengths.findIndex((strength) => Math.abs(strength) < 1e-8));
  const activeSliceIndex = Math.max(0, Math.min(sliceIndex ?? nominalSliceIndex, strengths.length - 1));
  const sliceStrength = strengths[activeSliceIndex] ?? 0;
  const visibleSamples = useMemo(() => points.filter((point) => !slice || Math.abs(point.speed - sliceStrength) < 1e-8), [points, slice, sliceStrength]);
  const successCount = visibleSamples.filter((point) => point.success).length;
  const unavailableCount = visibleSamples.filter((point) => !point.available).length;
  const sampleShare = visibleSamples.length ? successCount / visibleSamples.length * 100 : 0;

  const projected = useMemo(() => visibleSamples
    .filter((point) => point.success || showFailures)
    .map((point) => ({
      point,
      projection: project({
        x: point.angle / (limits.angle || 1),
        y: point.speed / (limits.speed || 1),
        z: point.sideSpin / (limits.sideSpin || 1),
      }, view.yaw, view.pitch),
    }))
    .sort((a, b) => a.projection.depth - b.projection.depth), [visibleSamples, showFailures, limits, view]);
  const corners = CORNERS.map((point) => project(point, view.yaw, view.pitch));
  const axes = [
    { key: 'angle', vector: { x: 1, y: 0, z: 0 }, name: 'Angle', negative: `${signed(-limits.angle, '°')} left`, positive: `${signed(limits.angle, '°')} right` },
    { key: 'sideSpin', vector: { x: 0, y: 0, z: 1 }, name: 'English', negative: `${signed(-limits.sideSpin)} right`, positive: `${signed(limits.sideSpin)} left` },
    { key: 'speed', vector: { x: 0, y: 1, z: 0 }, name: 'Strength', negative: `${signed(-limits.speed, '%')} softer`, positive: `${signed(limits.speed, '%')} harder` },
  ];

  function rotate(yaw: number, pitch: number) {
    setView((previous) => ({
      yaw: previous.yaw + yaw,
      pitch: Math.max(-1.15, Math.min(1.15, previous.pitch + pitch)),
    }));
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    rotate((event.clientX - start.x) * 0.008, (event.clientY - start.y) * 0.008);
    drag.current = { ...start, x: event.clientX, y: event.clientY };
  }

  function endDrag(event: PointerEvent<SVGSVGElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => rotate(-0.18, 0),
      ArrowRight: () => rotate(0.18, 0),
      ArrowUp: () => rotate(0, -0.12),
      ArrowDown: () => rotate(0, 0.12),
      Home: () => setView(INITIAL_VIEW),
    };
    const action = actions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  }

  const sliceCorners = [
    { x: -1, y: sliceStrength / (limits.speed || 1), z: -1 },
    { x: 1, y: sliceStrength / (limits.speed || 1), z: -1 },
    { x: 1, y: sliceStrength / (limits.speed || 1), z: 1 },
    { x: -1, y: sliceStrength / (limits.speed || 1), z: 1 },
  ].map((point) => project(point, view.yaw, view.pitch));

  return (
    <section className="tolerance-volume" aria-label={`${label} success volume`}>
      <div className="tolerance-volume-heading">
        <div>
          <span className="tolerance-volume-eyebrow">THREE VARIABLES, ONE SHOT</span>
          <h3>Sampled success volume</h3>
          <p className="tolerance-volume-shot-label">{label}</p>
        </div>
        <div className="tolerance-volume-share">
          <strong>{sampleShare.toFixed(1)}<span>%</span></strong>
          <span>of {slice ? 'slice' : 'grid'} points</span>
        </div>
      </div>
      <div className="tolerance-volume-toolbar">
        <div className="tolerance-volume-modes" aria-label="Volume display">
          <button type="button" aria-pressed={!slice} onClick={() => setSlice(false)}>Full volume</button>
          <button type="button" aria-pressed={slice} onClick={() => setSlice(true)}>Strength slice</button>
        </div>
        <label className="tolerance-volume-toggle">
          <input type="checkbox" checked={showFailures} onChange={(event) => setShowFailures(event.target.checked)} />
          Show unsuccessful samples
        </label>
      </div>
      <div className="tolerance-volume-stage">
        <svg
          className="tolerance-volume-plot"
          viewBox="90 0 500 450"
          role="img"
          aria-label={`${label} sampled success volume`}
          aria-describedby={descriptionId}
          tabIndex={0}
          data-testid="tolerance-volume-plot"
          data-yaw={view.yaw.toFixed(3)}
          data-pitch={view.pitch.toFixed(3)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={onKeyDown}
        >
          <title>{label}: sampled combinations of angle, English, and strength</title>
          <desc>{successCount} of {visibleSamples.length} grid points succeed. Green dots represent a legal pot with the cue ball in the target area. Hollow gray dots are outside the modeled speed range and were not simulated. The gold crosshair is the nominal shot. Drag or use arrow keys to rotate; Home resets the view.</desc>
          <g className="tolerance-volume-cube">
            {EDGES.map(([a, b]) => <line key={`${a}-${b}`} x1={corners[a].x} y1={corners[a].y} x2={corners[b].x} y2={corners[b].y} />)}
          </g>
          {slice && <polygon className="tolerance-volume-slice-plane" points={sliceCorners.map((point) => `${point.x},${point.y}`).join(' ')} />}
          {axes.map((axis) => {
            const start = project({ x: -axis.vector.x * 1.12, y: -axis.vector.y * 1.12, z: -axis.vector.z * 1.12 }, view.yaw, view.pitch);
            const end = project({ x: axis.vector.x * 1.12, y: axis.vector.y * 1.12, z: axis.vector.z * 1.12 }, view.yaw, view.pitch);
            return <line className={`tolerance-volume-axis tolerance-axis-${axis.key}`} key={axis.key} x1={start.x} y1={start.y} x2={end.x} y2={end.y} />;
          })}
          {projected.map(({ point, projection }) => (
            <circle
              key={`${point.angle}-${point.sideSpin}-${point.speed}`}
              className={!point.available ? 'tolerance-volume-point-unavailable' : point.success ? 'tolerance-volume-point-success' : point.pot ? 'tolerance-volume-point-pot' : 'tolerance-volume-point-miss'}
              cx={projection.x}
              cy={projection.y}
              r={!point.available ? 2.3 : point.success ? 3.5 + (projection.depth + 1.75) * 0.35 : point.pot ? 2.3 : 1.8}
              opacity={point.success ? 0.6 + (projection.depth + 1.75) * 0.1 : undefined}
            >
              <title>{`Angle ${signed(point.angle, '°')}; English ${signed(point.sideSpin)} rad/s; strength ${signed(point.speed, '%')}. ${!point.available ? 'Outside modeled speed range; not simulated' : point.success ? 'Pot + target reached' : point.pot ? 'Potted, outside target' : 'Unsuccessful pot'}.`}</title>
            </circle>
          ))}
          <g className="tolerance-volume-origin" aria-label="Nominal shot at zero deviation">
            <circle cx={CENTER.x} cy={CENTER.y} r="8" />
            <path d={`M${CENTER.x - 13},${CENTER.y}h26 M${CENTER.x},${CENTER.y - 13}v26`} />
            <circle cx={CENTER.x} cy={CENTER.y} r="2" />
          </g>
          {axes.flatMap((axis) => [-1, 1].map((direction) => {
            const end = project({ x: axis.vector.x * direction * 1.38, y: axis.vector.y * direction * 1.38, z: axis.vector.z * direction * 1.38 }, view.yaw, view.pitch);
            const anchor = end.x > CENTER.x + 28 ? 'start' : end.x < CENTER.x - 28 ? 'end' : 'middle';
            const dy = end.y < CENTER.y - 40 ? -8 : 12;
            return <text className={`tolerance-volume-axis-label tolerance-axis-${axis.key}`} key={`${axis.key}-${direction}`} x={end.x} y={end.y + dy} textAnchor={anchor}>
              <tspan x={end.x}>{axis.name}</tspan>
              <tspan x={end.x} dy="1.2em" className="tolerance-volume-axis-value">{direction < 0 ? axis.negative : axis.positive}</tspan>
            </text>;
          }))}
        </svg>
        {successCount === 0 && <div className="tolerance-volume-empty">No successful samples {slice ? 'in this strength slice' : 'in this grid'}</div>}
        <div className="tolerance-volume-controls">
          <span>Drag to rotate</span>
          <div>
            <button type="button" aria-label="Rotate volume left" title="Rotate left" onClick={() => rotate(-0.25, 0)}><ArrowLeft size={14} /></button>
            <button type="button" aria-label="Rotate volume right" title="Rotate right" onClick={() => rotate(0.25, 0)}><ArrowRight size={14} /></button>
            <button type="button" aria-label="Tilt volume up" title="Tilt up" onClick={() => rotate(0, -0.16)}><ArrowUp size={14} /></button>
            <button type="button" aria-label="Tilt volume down" title="Tilt down" onClick={() => rotate(0, 0.16)}><ArrowDown size={14} /></button>
            <button type="button" aria-label="Reset volume view" title="Reset view" onClick={() => setView(INITIAL_VIEW)}><RotateCcw size={14} /></button>
          </div>
        </div>
      </div>
      {slice && <div className="tolerance-volume-slice-control">
        <label htmlFor={`${descriptionId}-slice`}>Shot strength <strong>{strengthLabel(sliceStrength)}</strong></label>
        <input id={`${descriptionId}-slice`} aria-label="Shot strength slice" aria-valuetext={strengthLabel(sliceStrength)} type="range" min={0} max={Math.max(0, strengths.length - 1)} step={1} value={activeSliceIndex} onChange={(event) => setSliceIndex(Number(event.target.value))} />
        <div><span>{signed(-limits.speed, '%')} softer</span><span>{signed(limits.speed, '%')} harder</span></div>
      </div>}
      <div className="tolerance-volume-legend">
        <span><i className="tolerance-volume-key-success" />Pot + target</span>
        <span><i className="tolerance-volume-key-origin" />Nominal shot</span>
        {showFailures && <><span><i className="tolerance-volume-key-pot" />Pot, outside target</span><span><i className="tolerance-volume-key-miss" />Miss / foul</span></>}
        {showFailures && unavailableCount > 0 && <span><i className="tolerance-volume-key-unavailable" />Outside modeled range</span>}
      </div>
      <p className="tolerance-volume-count" aria-live="polite">{successCount} of {visibleSamples.length} grid points succeed{slice ? ` at ${signed(sliceStrength, '%')} strength` : ''}.</p>
      <p className="tolerance-volume-note" id={descriptionId}>Each point represents a combination relative to the nominal shot; top/backspin stays fixed. English is measured in rad/s. This grid shows sampled outcomes, not a probability or an exact success boundary.{unavailableCount > 0 && <> {unavailableCount} grid points are outside the modeled speed range (0.05–4 m/s) and were not simulated. They remain in the grid denominator for consistent comparisons.</>}</p>
    </section>
  );
}
