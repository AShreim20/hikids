// Mirrors the server-side constants in the loyalty backend functions.
// Used only for live preview of redemption value before the server commits
// the actual decrement at order placement.
export const EARN_RATE = 1;     // points earned per ₪ spent (on subtotal)
export const REDEEM_RATE = 0.1; // ₪ value per point redeemed (10 points = ₪1)