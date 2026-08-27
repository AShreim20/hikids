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

// Beach-style ball: two-tone with a simple curved seam.
function Ball() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="w-full h-full">
      <circle cx="16" cy="16" r="14" fill={C.pink} />
      <path d="M2 16c0-7.2 6.3-13 14-13S30 8.8 30 16" stroke={C.lightYellow} strokeWidth="2.2" fill="none" opacity="0.7" />
      <path d="M5.5 9.5c4 3 17 3 21 0" stroke={C.lightYellow} strokeWidth="2.2" fill="none" opacity="0.6" />
      <circle cx="16" cy="16" r="14" stroke={C.purple} strokeWidth="1.4" fill="none" opacity="0.35" />
    </svg>
  );
}

// Toy rocket: rounded body, fins, porthole.
function Rocket() {
  return (
    <svg viewBox="0 0 32 40" fill="none" className="w-full h-full">
      <path d="M16 2c5 4.5 7.5 10 7.5 17v10H8.5V19C8.5 12 11 6.5 16 2Z" fill={C.cyan} />
      <path d="M8.5 19v10h-4c-1.6 0-2.5-1.2-2-2.8C3.6 23 5.6 20.5 8.5 19Z" fill={C.pink} />
      <path d="M23.5 19v10h4c1.6 0 2.5-1.2 2-2.8C28.4 23 26.4 20.5 23.5 19Z" fill={C.pink} />
      <circle cx="16" cy="14" r="3.4" fill={C.lightYellow} />
      <circle cx="16" cy="14" r="3.4" stroke={C.purple} strokeWidth="1" fill="none" opacity="0.4" />
      <path d="M13 31l3 6 3-6" stroke={C.yellow} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Balloon: ellipse body + curling string.
function Balloon() {
  return (
    <svg viewBox="0 0 24 36" fill="none" className="w-full h-full">
      <ellipse cx="12" cy="12" rx="9" ry="11" fill={C.pink} />
      <path d="M10 3.5c-2.5 1-4 3.5-4 6.5" stroke="#ffffff" strokeWidth="1.4" fill="none" opacity="0.55" />
      <path d="M12 23l-1.4 3 2.8 0L12 23Z" fill={C.purple} opacity="0.6" />
      <path d="M12 26c-1 2-2 4 0 6s-1 3 0 4" stroke={C.purple} strokeWidth="1.2" fill="none" opacity="0.5" />
    </svg>
  );
}

// Spinning top: cone body + stem + tip.
function Top() {
  return (
    <svg viewBox="0 0 28 34" fill="none" className="w-full h-full">
      <path d="M14 3v6" stroke={C.purple} strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="2" r="1.6" fill={C.yellow} />
      <path d="M4 12c4 4 16 4 20 0c-3 7-6 11-10 11s-7-4-10-11Z" fill={C.cyan} />
      <path d="M4 12c4 4 16 4 20 0" stroke={C.purple} strokeWidth="1.2" fill="none" opacity="0.4" />
      <path d="M14 23l3 9h-6l3-9Z" fill={C.pink} />
    </svg>
  );
}

// Toy train piece: rounded body + wheels + window.
function Train() {
  return (
    <svg viewBox="0 0 40 30" fill="none" className="w-full h-full">
      <rect x="4" y="6" width="22" height="15" rx="3.5" fill={C.yellow} />
      <rect x="9" y="9" width="9" height="7" rx="2" fill={C.lightYellow} />
      <rect x="26" y="10" width="8" height="11" rx="2.5" fill={C.cyan} />
      <path d="M30 10V6.5h4V10" stroke={C.purple} strokeWidth="1.4" fill="none" opacity="0.5" />
      <circle cx="10" cy="24" r="3.6" fill={C.purple} />
      <circle cx="20" cy="24" r="3.6" fill={C.purple} />
      <circle cx="10" cy="24" r="1.3" fill={C.lightYellow} />
      <circle cx="20" cy="24" r="1.3" fill={C.lightYellow} />
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

      {/* Rocket — desktop, mid-upper */}
      <Piece className="hidden sm:block top-2 sm:top-3 end-32 lg:end-44 h-8 w-6 sm:h-10 sm:w-8 lg:h-12 lg:w-9 opacity-85" style={{ transform: 'rotate(10deg)' }}>
        <Rocket />
      </Piece>

      {/* Balloon — desktop, mid area */}
      <Piece className="hidden sm:block top-14 sm:top-16 end-28 lg:end-36 h-8 w-6 sm:h-10 sm:w-7 lg:h-12 lg:w-8 opacity-80" style={{ transform: 'rotate(-6deg)' }}>
        <Balloon />
      </Piece>

      {/* Spinning top — desktop, mid-lower */}
      <Piece className="hidden sm:block bottom-10 sm:bottom-12 end-32 lg:end-44 h-7 w-6 sm:h-9 sm:w-7 lg:h-11 lg:w-8 opacity-80" style={{ transform: 'rotate(-12deg)' }}>
        <Top />
      </Piece>

      {/* Toy train — desktop, lower band */}
      <Piece className="hidden lg:block bottom-2 end-44 h-7 w-9 opacity-75" style={{ transform: 'rotate(2deg)' }}>
        <Train />
      </Piece>

      {/* Ball — desktop, mid accent */}
      <Piece className="hidden lg:block top-8 end-56 h-7 w-7 opacity-75" style={{ transform: 'rotate(4deg)' }}>
        <Ball />
      </Piece>

      {/* Star (pink) — desktop micro accent */}
      <Piece className="hidden lg:block top-6 end-8 h-4 w-4 opacity-70">
        <Star color={C.pink} />
      </Piece>
    </div>
  );
}