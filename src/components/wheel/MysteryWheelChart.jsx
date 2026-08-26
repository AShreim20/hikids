import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';

// Prize wheel rendered as an SVG pie chart: each reward is a slice sized by
// its probability weight, labels radiate around the rim, a fixed pointer
// marks the top, and the center hub is the "SPIN" button. On a spin the
// wheel rotates 5 full turns then lands the winning slice under the pointer.
const SLICE_COLORS = [
  '#5D3F85', '#FF5977', '#F5A623', '#3BB4A2', '#4A90E2',
  '#E94B6E', '#7B6CA6', '#FFB84D', '#2EC4B6', '#9B5DE5',
];

function polar(cx, cy, r, angleDeg) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

function arcPath(cx, cy, R, start, end) {
  if (end - start >= 359.999) {
    // Full circle — a normal arc with start===end renders nothing.
    return `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.001} ${cy - R} Z`;
  }
  const s = polar(cx, cy, R, start);
  const e = polar(cx, cy, R, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

export default function MysteryWheelChart({ rewards, available, onSpin, ar }) {
  const slices = useMemo(() => {
    const total = rewards.reduce(
      (s, r) => s + (Number(r.weight) > 0 ? Number(r.weight) : 1),
      0
    ) || 1;
    let acc = 0;
    return rewards.map((r, i) => {
      const w = Number(r.weight) > 0 ? Number(r.weight) : 1;
      const angle = (w / total) * 360;
      const start = acc;
      acc += angle;
      return {
        reward: r,
        start,
        angle,
        center: start + angle / 2,
        color: SLICE_COLORS[i % SLICE_COLORS.length],
      };
    });
  }, [rewards]);

  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const rotationRef = useRef(0);

  const handleSpin = async () => {
    if (busy || available <= 0) return;
    setBusy(true);
    setResult(null);
    const reward = await onSpin();
    if (!reward) {
      setBusy(false);
      return;
    }
    // Land the winning slice (matched by label) under the top pointer.
    const idx = slices.findIndex((s) => s.reward.label === reward.label);
    const targetCenter = idx >= 0 ? slices[idx].center : 0;
    const desiredMod = (360 - (((targetCenter % 360) + 360) % 360)) % 360;
    const current = rotationRef.current;
    const currentMod = ((current % 360) + 360) % 360;
    let delta = (desiredMod - currentMod + 360) % 360;
    delta += 360 * 5; // five full turns for drama
    const next = current + delta;
    rotationRef.current = next;
    setRotation(next);
    setTimeout(() => {
      setResult(reward);
      setBusy(false);
    }, 2700);
  };

  const cx = 150;
  const cy = 150;
  const R = 140;
  const labelR = 96;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 320, maxWidth: '86vw', aspectRatio: '1 / 1' }}>
        {/* Fixed pointer at the top */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-1 z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[22px] border-t-accent drop-shadow-md"
          aria-hidden="true"
        />
        {/* The wheel — rotated via a wrapper div (CSS transform on a div is
            reliably pivoted at its center; rotating the <svg> directly can
            pivot at 0,0 in some browsers and swing off-screen). */}
        <div
          className="absolute inset-0"
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: busy ? 'transform 2600ms cubic-bezier(0.16,1,0.3,1)' : 'none',
          }}
        >
          <svg viewBox="0 0 300 300" className="w-full h-full drop-shadow-xl">
            <circle cx={cx} cy={cy} r={R + 6} fill="hsl(var(--card))" />
            {slices.map((s, i) => (
              <path
                key={`s${i}`}
                d={arcPath(cx, cy, R, s.start, s.start + s.angle)}
                fill={s.color}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              />
            ))}
            {slices.map((s, i) => {
              const p = polar(cx, cy, labelR, s.center);
              let rot = s.center;
              if (s.center > 90 && s.center < 270) rot = s.center + 180;
              const raw = s.reward.label || '';
              const label = raw.length > 14 ? `${raw.slice(0, 13)}…` : raw;
              return (
                <text
                  key={`t${i}`}
                  x={p.x}
                  y={p.y}
                  fill="#fff"
                  fontSize={11}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${rot} ${p.x} ${p.y})`}
                  className="font-heading select-none"
                  style={{ pointerEvents: 'none' }}
                >
                  {label}
                </text>
              );
            })}
          </svg>
        </div>
        {/* Center SPIN hub — positioned with an inline translate so no hover
            transform can override the centering (the old `squish` class
            replaced the translate and made the button jump). */}
        <button
          type="button"
          onClick={handleSpin}
          disabled={busy || available <= 0}
          className="absolute z-10 grid place-items-center w-24 h-24 rounded-full bg-cosmic text-white shadow-lg border-4 border-white disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
          aria-label={ar ? 'أدر العجلة' : 'Spin the wheel'}
        >
          <span className="font-heading font-extrabold text-lg tracking-wide transition-transform active:scale-95">
            {busy ? (ar ? 'يدور' : 'Spin') : (ar ? 'أدر' : 'SPIN')}
          </span>
        </button>
      </div>

      {result && (
        <div className="mt-6 text-center float-in max-w-sm">
          <p className="text-sm text-muted-foreground">{ar ? 'ربحت!' : 'You won'}</p>
          <p className="mt-1 font-heading font-extrabold text-3xl text-cosmic">{result.label}</p>
          {result.discount_code && (
            <p className="mt-2 text-sm">
              {ar ? 'كود الخصم' : 'Discount code'}: <b className="font-mono">{result.discount_code}</b>
            </p>
          )}
          {result.product && (
            <p className="mt-2 text-sm text-emerald-600 font-bold">
              {ar ? 'أُضيفت مجانًا إلى سلتك' : 'Added to your cart for free'}
            </p>
          )}
          {result.fulfillment === 'manual' && (
            <p className="mt-2 text-xs text-muted-foreground">
              {ar ? 'سيتم تواصل المتجر معك لاستلام المكافأة' : 'The store will contact you to fulfill this reward'}
            </p>
          )}
          <Link to="/wheel-rewards" className="mt-3 inline-flex items-center gap-1 text-cosmic font-heading font-bold text-sm">
            {ar ? 'عرض مكافآتي' : 'View my rewards'}
          </Link>
        </div>
      )}
    </div>
  );
}