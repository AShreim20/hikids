import React from 'react';

// Playful toy-themed header decoration, placed in the background on the side
// opposite the logo. Flat/vector illustrations built from inline SVG (no emoji,
// no raster). Colors sampled from the HiKids logo: purple #5D3F85, cyan #00BFF3,
// yellow #FFEC5C, light yellow #FFF38A, pink #FF4F81. The header's purple
// background stays dominant; these sit behind all content (zIndex 0) with soft
// transparency so they read as a brand pattern, not clipart.

const C = {
  purple: '#5D3F85',
  cyan: '#00BFF3',
  yellow: '#FFEC5C',
  lightYellow: '#FFF38A',
  pink: '#FF4F81',
};

function Blocks() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <rect x="5" y="27" width="17" height="17" rx="4.5" fill={C.yellow} />
      <rect x="26" y="27" width="17" height="17" rx="4.5" fill={C.pink} />
      <rect x="15.5" y="6" width="17" height="17" rx="4.5" fill={C.cyan} />
      <circle cx="13.5" cy="35.5" r="2.4" fill={C.purple} opacity="0.45" />
      <circle cx="34.5" cy="35.5" r="2.4" fill={C.purple} opacity="0.45" />
      <rect x="22" y="12" width="4" height="4" rx="1.2" fill={C.purple} opacity="0.45" />
    </svg>
  );
}

function Teddy() {
  return (
    <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
      <circle cx="11" cy="11" r="6.5" fill={C.lightYellow} />
      <circle cx="37" cy="11" r="6.5" fill={C.lightYellow} />
      <circle cx="11" cy="11" r="3.2" fill={C.pink} opacity="0.55" />
      <circle cx="37" cy="11" r="3.2" fill={C.pink} opacity="0.55" />
      <circle cx="24" cy="26" r="16.5" fill={C.yellow} />
      <ellipse cx="24" cy="31" rx="9" ry="7.5" fill={C.lightYellow} />
      <circle cx="18.5" cy="23.5" r="2.1" fill={C.purple} />
      <circle cx="29.5" cy="23.5" r="2.1" fill={C.purple} />
      <ellipse cx="24" cy="29.5" rx="2.1" ry="1.6" fill={C.purple} />
    </svg>
  );
}

function ToyCar() {
  return (
    <svg viewBox="0 0 48 34" fill="none" className="w-full h-full">
      <path
        d="M3 23c0-2.8 2-4.8 4.8-4.8h2.1l3.7-7.4c.9-1.8 2.7-2.8 4.7-2.8h11.4c2 0 3.8 1 4.7 2.8l3.7 7.4h2.6c1.7 0 3 1.3 3 3v3.3H3z"
        fill={C.cyan}
      />
      <path d="M13.5 18.2h14.2l-3-6c-.5-1-1.4-1.6-2.5-1.6h-5.2c-1.1 0-2 .6-2.5 1.6z" fill="#ffffff" opacity="0.5" />
      <circle cx="13.5" cy="26.5" r="4.8" fill={C.purple} />
      <circle cx="34.5" cy="26.5" r="4.8" fill={C.purple} />
      <circle cx="13.5" cy="26.5" r="1.9" fill={C.lightYellow} />
      <circle cx="34.5" cy="26.5" r="1.9" fill={C.lightYellow} />
    </svg>
  );
}

function Puzzle() {
  // One top tab + one bottom notch — reads clearly as a jigsaw piece.
  return (
    <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
      <path
        d="M7 5 H12 a4 4 0 0 0 8 0 H25 a2 2 0 0 1 2 2 V25 a2 2 0 0 1 -2 2 H20 a4 4 0 0 0 -8 0 H7 a2 2 0 0 1 -2 -2 V7 a2 2 0 0 1 2 -2 Z"
        fill={C.pink}
      />
      <circle cx="16" cy="15" r="2.4" fill={C.lightYellow} opacity="0.55" />
    </svg>
  );
}

function Star({ color = C.cyan }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M12 2 L14.5 8.6 L21.5 9 L16 13.7 L17.8 20.5 L12 16.8 L6.2 20.5 L8 13.7 L2.5 9 L9.5 8.6 Z"
        fill={color}
      />
    </svg>
  );
}

const Piece = ({ children, className, style }) => (
  <div className={`absolute ${className}`} style={style} aria-hidden>
    {children}
  </div>
);

export default function HeaderToyPattern() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 end-0 w-40 sm:w-48 lg:w-56 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {/* Teddy — upper area, always visible */}
      <Piece className="top-1 sm:top-2 end-14 sm:end-20 lg:end-24 h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 opacity-90" style={{ transform: 'rotate(-8deg)' }}>
        <Teddy />
      </Piece>

      {/* Star (cyan) — top edge accent, always visible */}
      <Piece className="top-2 sm:top-3 end-4 sm:end-5 h-5 w-5 sm:h-6 sm:w-6 opacity-90">
        <Star color={C.cyan} />
      </Piece>

      {/* Building blocks — lower area, always visible */}
      <Piece className="bottom-1.5 sm:bottom-2 end-4 sm:end-6 lg:end-8 h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 opacity-85" style={{ transform: 'rotate(6deg)' }}>
        <Blocks />
      </Piece>

      {/* Toy car — desktop only */}
      <Piece className="hidden sm:block bottom-2 sm:bottom-3 end-20 lg:end-28 h-8 w-11 sm:h-9 sm:w-12 lg:h-10 lg:w-14 opacity-80" style={{ transform: 'rotate(-3deg)' }}>
        <ToyCar />
      </Piece>

      {/* Puzzle piece — desktop only */}
      <Piece className="hidden sm:block top-10 sm:top-12 end-3 sm:end-4 h-7 w-7 sm:h-8 sm:w-8 lg:h-9 lg:w-9 opacity-75" style={{ transform: 'rotate(12deg)' }}>
        <Puzzle />
      </Piece>

      {/* Star (yellow) — desktop accent */}
      <Piece className="hidden sm:block bottom-12 sm:bottom-14 end-14 lg:end-20 h-4 w-4 sm:h-5 sm:w-5 opacity-70">
        <Star color={C.yellow} />
      </Piece>
    </div>
  );
}