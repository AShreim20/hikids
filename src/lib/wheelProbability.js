// Appearance-probability maths for the admin reward editor. Percentages may
// have decimals, so everything is compared in integer units of 0.0001% (the
// database stores numeric(7,4)) with the same ±0.001 tolerance the server
// enforces — avoids 33.3333 + 33.3333 + 33.3334 style float noise.
const UNITS = 10000;
export const TOLERANCE = 0.001;

export const toUnits = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * UNITS) : 0;
};

// 4 decimals max, no trailing zeros: 33.3333, 25, 4.5
export const formatPercent = (n) => String(Math.round(Number(n) * UNITS) / UNITS);

// Only ACTIVE rewards take part in the total. status:
//   'empty' — no active rewards (nothing to balance; wheel can't be activated)
//   'ok'    — exactly 100 (within tolerance)
//   'under' — below 100, `remaining` says by how much
//   'over'  — above 100, `excess` says by how much
export function summarizeProbabilities(items) {
  const active = items.filter((i) => i.active);
  const units = active.reduce((s, i) => s + toUnits(i.probability_percent), 0);
  const total = units / UNITS;
  // Integer compare (not float): 3 x 33.333 is exactly 10 units short of
  // 100%, which is exactly the tolerance — a float diff would land a hair
  // over it and wrongly reject.
  const diffUnits = units - 100 * UNITS;
  const diff = diffUnits / UNITS;
  const zeroActive = active.filter((i) => toUnits(i.probability_percent) <= 0).length;
  let status = 'ok';
  if (active.length === 0) status = 'empty';
  else if (Math.abs(diffUnits) <= TOLERANCE * UNITS) status = 'ok';
  else status = diff < 0 ? 'under' : 'over';
  return {
    activeCount: active.length,
    total,
    remaining: status === 'under' ? Math.round(-diff * UNITS) / UNITS : 0,
    excess: status === 'over' ? Math.round(diff * UNITS) / UNITS : 0,
    zeroActive,
    status,
    // Saving is allowed with no active rewards (everything switched off);
    // otherwise the total must be exactly 100 and no active reward may be 0%.
    canSave: status === 'empty' || (status === 'ok' && zeroActive === 0),
    // Activating the wheel itself needs a real, balanced set of rewards.
    canActivateWheel: status === 'ok' && zeroActive === 0,
  };
}
