import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { rewardName } from '@/lib/bilingual';
import { gaEvent } from '@/lib/ga4';
import {
  CX, CY, R, LABEL_MID, polar, arcPath, segmentAngle, segmentCenter,
  landingRotation, layoutLabels, labelRotation, sliceColor, textColorFor,
} from '@/lib/wheelGeometry';

// Prize wheel. Three layers, so only what should move, moves:
//   1. rotating <div>  → the equal-size reward segments + their labels
//   2. static hub      → the HiKids logo (never rotates)
//   3. static pointer  → fixed at the top
//
// Segment size is ALWAYS 360° / (number of active rewards) — reward win
// probability never affects the picture. The server's wheel_spin() picks the
// winner by probability; this component only animates the wheel so that the
// already-chosen reward's segment stops under the pointer.
// The official HiKids logo on its purple background (the same asset as the
// site's share image) — used as-is, clipped to the circular hub.
const LOGO_PURPLE_URL = 'https://media.base44.com/images/public/6a75c91fa5dfe02359c5f127/7971fd204_HiKidsLogo.webp';
const SPIN_MS = 4200;
const REDUCED_MS = 500;

// A short burst of confetti when a reward is won. Pure CSS (no library), skipped
// for people who prefer reduced motion, and never intercepts clicks.
const CONFETTI_COLORS = ['#F2559B', '#F5A623', '#3DB7A0', '#4A90E2', '#9B6BD6', '#FFD23F'];
const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  left: 4 + ((i * 37) % 92),
  delay: (i % 7) * 70,
  dur: 1400 + ((i * 53) % 700),
  drift: ((i * 29) % 80) - 40,
  size: 6 + (i % 4) * 2,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 3 === 0,
}));

function WinConfetti() {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-6 h-48 overflow-hidden" aria-hidden="true">
      <style>{'@keyframes hkConfetti{0%{transform:translate3d(0,-10px,0) rotate(0);opacity:1}100%{transform:translate3d(var(--dx),170px,0) rotate(540deg);opacity:0}}'}</style>
      {CONFETTI.map((c, i) => (
        <span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.round ? c.size : c.size * 1.6,
            borderRadius: c.round ? '50%' : 2,
            background: c.color,
            '--dx': `${c.drift}px`,
            animation: `hkConfetti ${c.dur}ms ${c.delay}ms ease-out forwards`,
            opacity: 0,
          }}
        />
      ))}
    </div>
  );
}

export default function MysteryWheelChart({ rewards, available, onSpin, ar, preview = false, maxWidth = 440 }) {
  const lang = ar ? 'ar' : 'en';
  const n = rewards.length;
  const seg = segmentAngle(n);

  const labels = useMemo(() => layoutLabels(rewards.map((r) => rewardName(r, lang) || ''), n), [rewards, lang, n]);

  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const rotationRef = useRef(0);
  const pendingRef = useRef(null); // reward waiting for the animation to end
  const timerRef = useRef(null);

  const duration = useMemo(
    () => (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? REDUCED_MS : SPIN_MS),
    []
  );

  const finish = useCallback(() => {
    if (!pendingRef.current) return;
    clearTimeout(timerRef.current);
    setResult(pendingRef.current);
    pendingRef.current = null;
    setBusy(false);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleSpin = async () => {
    if (preview || busy || available <= 0 || n === 0) return;
    setBusy(true);
    setResult(null);
    gaEvent('wheel_spin');
    const reward = await onSpin();
    if (!reward) {
      setBusy(false);
      return;
    }
    gaEvent('wheel_reward_won', { reward_type: reward.type, reward_label: reward.label });
    // The server already decided. Find that exact reward's segment by id
    // (label match only as a fallback for an older response without reward_id).
    let index = reward.reward_id ? rewards.findIndex((r) => r.id === reward.reward_id) : -1;
    if (index < 0) index = rewards.findIndex((r) => r.label === reward.label);

    const turns = 5 + Math.floor(Math.random() * 3);
    const next = index >= 0
      ? landingRotation({
        current: rotationRef.current,
        index,
        count: n,
        // Random stop somewhere inside the winner's safe zone (inner 65% of
        // its width) so it doesn't always rest dead-centre.
        offsetUnit: Math.random() * 2 - 1,
        turns,
      })
      : rotationRef.current + 360 * turns + Math.random() * 360;
    rotationRef.current = next;
    pendingRef.current = reward;
    setRotation(next);
    // transitionend is the normal trigger; the timer covers a skipped event
    // (hidden tab, reduced motion).
    timerRef.current = setTimeout(finish, duration + 400);
  };

  if (n === 0) {
    return <p className="text-center text-sm text-muted-foreground">{ar ? 'لا توجد مكافآت فعّالة' : 'No active rewards'}</p>;
  }

  const spinLabel = busy ? (ar ? 'تدور…' : 'Spinning…') : (ar ? 'أدر العجلة' : 'Spin the wheel');

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative" style={{ width: `min(${maxWidth}px, 100%)`, aspectRatio: '1 / 1' }}>
        {/* Fixed pointer at the top */}
        <div
          className="absolute left-1/2 -translate-x-1/2 -top-1 z-20 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[22px] border-t-accent drop-shadow-md"
          aria-hidden="true"
        />

        {/* Rotating layer: segments + labels only. A CSS transform on a div
            pivots at its centre in every browser (rotating the <svg> itself
            can pivot at 0,0). */}
        <div
          className="absolute inset-0"
          onTransitionEnd={(e) => { if (e.target === e.currentTarget && e.propertyName === 'transform') finish(); }}
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: busy ? `transform ${duration}ms cubic-bezier(0.2, 0.8, 0.2, 1)` : 'none',
            willChange: 'transform',
          }}
        >
          <svg viewBox="0 0 300 300" className="w-full h-full drop-shadow-xl" role="img" aria-label={ar ? 'عجلة الجوائز' : 'Prize wheel'}>
            <circle cx={CX} cy={CY} r={R + 6} fill="hsl(var(--card))" />
            {rewards.map((r, i) => (
              <path
                key={r.id || `s${i}`}
                data-reward-id={r.id}
                d={arcPath(CX, CY, R, i * seg, (i + 1) * seg)}
                fill={sliceColor(i, n)}
                stroke="hsl(var(--card))"
                strokeWidth={2}
              />
            ))}
            {rewards.map((r, i) => {
              const item = labels.items[i];
              if (!item || item.lines.length === 0) return null;
              const center = segmentCenter(i, n);
              const p = polar(CX, CY, LABEL_MID, center);
              const color = textColorFor(sliceColor(i, n));
              const lineH = item.fontSize * 1.15;
              return (
                <g
                  key={`t${r.id || i}`}
                  transform={`translate(${p.x} ${p.y}) rotate(${labelRotation(center)})`}
                  style={{ pointerEvents: 'none' }}
                >
                  {item.lines.map((line, k) => (
                    <text
                      key={k}
                      x={0}
                      y={(k - (item.lines.length - 1) / 2) * lineH}
                      fill={color}
                      fontSize={item.fontSize}
                      fontWeight={700}
                      textAnchor="middle"
                      dominantBaseline="central"
                      direction={/[؀-ۿ]/.test(line) ? 'rtl' : 'ltr'}
                      className="font-heading select-none"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Static hub: the real HiKids logo (the same <Logo/> the header
            uses — not redrawn, recoloured or translated). Sits outside the
            rotating layer so it stays upright while the wheel turns. In the
            live page it doubles as a click target for spinning, but the
            visible button below is the accessible control. */}
        <div
          className={`absolute z-10 overflow-hidden rounded-full bg-[#5D3F85] shadow-lg border-4 border-white ${preview ? '' : 'cursor-pointer'}`}
          style={{ left: '50%', top: '50%', width: '25%', height: '25%', transform: 'translate(-50%, -50%)' }}
          onClick={preview ? undefined : handleSpin}
          aria-hidden="true"
        >
          <img src={LOGO_PURPLE_URL} alt="HiKids" draggable={false} className="w-full h-full object-cover select-none" />
        </div>
      </div>

      {!preview && (
        <button
          type="button"
          onClick={handleSpin}
          disabled={busy || available <= 0}
          className="mt-6 inline-flex items-center justify-center h-12 px-10 rounded-full bg-cosmic text-white font-heading font-extrabold text-base shadow-lg disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 transition-transform"
        >
          {spinLabel}
        </button>
      )}

      {!preview && result && (
        <div className="relative mt-6 text-center float-in max-w-sm">
          <WinConfetti key={result.id || result.reward_id} />
          <p className="text-sm text-muted-foreground">{ar ? 'ربحت!' : 'You won'}</p>
          <p className="mt-1 font-heading font-extrabold text-3xl text-cosmic">{rewardName(result, lang)}</p>
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
