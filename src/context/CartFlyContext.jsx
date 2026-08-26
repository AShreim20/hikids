import React, { createContext, useContext, useCallback } from 'react';
import { animate } from 'motion';

// Flies a toy-brick icon from the clicked "add to cart" button to the cart
// icon in the header (desktop) / bottom nav (mobile), using motion's
// imperative `animate` — no React re-render per frame, and overlapping clicks
// each spawn their own throwaway element so rapid adds never collide.

const CartFlyContext = createContext(null);

const TOY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="12" x="3" y="9" rx="2"/><path d="M6 9V6"/><path d="M10 9V6"/><path d="M14 9V6"/><path d="M18 9V6"/></svg>';

// The cart icon exists in two places: the desktop navbar button and the
// mobile bottom-nav tab. Only one is on screen at a time; pick the visible.
function findCartAnchor() {
  const els = document.querySelectorAll('[data-cart-anchor]');
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function CartFlyProvider({ children }) {
  const flyToCart = useCallback((originEl) => {
    const target = findCartAnchor();
    if (!originEl || !target) return;

    const o = originEl.getBoundingClientRect();
    const t = target.getBoundingClientRect();
    const fromX = o.left + o.width / 2;
    const fromY = o.top + o.height / 2;
    const toX = t.left + t.width / 2;
    const toY = t.top + t.height / 2;

    const size = 44;
    const el = document.createElement('div');
    el.style.cssText = `position:fixed; z-index:70; pointer-events:none; width:${size}px; height:${size}px; display:grid; place-items:center; border-radius:9999px; background:hsl(var(--accent)); color:#fff; box-shadow:0 10px 30px -8px hsl(var(--accent)/0.6); left:${fromX - size / 2}px; top:${fromY - size / 2}px;`;
    el.innerHTML = TOY_SVG;
    document.body.appendChild(el);

    const midX = (fromX + toX) / 2;
    const midY = Math.min(fromY, toY) - 70;

    const controls = animate(
      el,
      {
        left: [`${fromX - size / 2}px`, `${midX - size / 2}px`, `${toX - size / 2}px`],
        top: [`${fromY - size / 2}px`, `${midY - size / 2}px`, `${toY - size / 2}px`],
        scale: [1, 1.1, 0.25],
        rotate: [0, -120, -220],
        opacity: [1, 1, 1, 0],
      },
      { duration: 1.7, ease: [0.22, 1, 0.36, 1] }
    );

    controls.then(() => {
      el.remove();
      animate(target, { scale: [1, 1.35, 1] }, { duration: 0.45, ease: 'easeOut' });
    });
  }, []);

  return (
    <CartFlyContext.Provider value={{ flyToCart }}>
      {children}
    </CartFlyContext.Provider>
  );
}

export const useCartFly = () => useContext(CartFlyContext) ?? { flyToCart: () => {} };