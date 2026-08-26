import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import {
  computeWheelState, weightedPick, grantPoints, grantDiscountCodeRecord,
  recordReward, rewardExpiresAt,
} from '../../shared/rewards.ts';

// Consumes one available spin, runs the weighted random pick server-side, and
// grants the resulting reward. One WheelSpin row per call makes a spin
// non-replayable; the reward's `status` field tracks redemption (unused → used).
// Points are credited immediately (status=used). Discount codes are minted
// one-time and bound to the customer + spin. Product rewards snapshot the
// product so an unavailable product never deletes the reward (status=unavailable).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ success: false, message: 'Auth required' }, { status: 401 });

    const state = await computeWheelState(base44, user);
    if (!state.active) return Response.json({ success: false, message: 'Wheel is not active' });
    if (state.available <= 0) return Response.json({ success: false, message: 'No spins available' });
    if (state.config.max_spins > 0 && state.used >= state.config.max_spins) {
      return Response.json({ success: false, message: 'Maximum spins reached' });
    }

    const rewards = await base44.asServiceRole.entities.WheelReward.filter({ active: true });
    const pool = (rewards || []).filter((r) => Number(r.weight) > 0);
    if (!pool.length) return Response.json({ success: false, message: 'No rewards configured' });
    const picked = weightedPick(pool);

    const expiresAt = rewardExpiresAt(state.config);
    const expiresAtDate = expiresAt ? expiresAt.slice(0, 10) : '';

    let points = 0;
    let status = 'unused';
    let fulfillment = 'auto';
    let productId = picked.product_id || '';
    let productName = picked.product_name || '';
    let productImage = '';
    let productPrice = 0;

    if (picked.type === 'points') {
      points = Math.trunc(Number(picked.value) || 0);
      await grantPoints(base44, user, points, 'Mystery Wheel reward', `wheel-${user.id}-${Date.now()}`);
      status = 'used'; // points are credited to the wallet immediately
    } else if (picked.type === 'product') {
      let product = null;
      if (productId) product = await base44.asServiceRole.entities.Product.get(productId).catch(() => null);
      const productNameEn = product ? (product.name_en || '') : '';
    if (product && Number(product.stock) > 0) {
        productName = product.name;
        productImage = product.image_url || '';
        productPrice = Number(product.sale_price ?? product.price) || 0;
        status = 'unused';
        fulfillment = 'auto'; // auto-added to cart by the customer UI
      } else {
        // Product gone / out of stock — keep the record, mark unavailable.
        if (product) { productName = product.name; productImage = product.image_url || ''; productPrice = Number(product.sale_price ?? product.price) || 0; }
        status = 'unavailable';
        fulfillment = 'manual';
      }
    } else if (picked.type === 'free_delivery') {
      // No automatic delivery-free mechanism exists; fulfilled manually.
      status = 'unused';
      fulfillment = 'manual';
    } else {
      // discount_percent / discount_fixed / credit — code minted after the spin row exists.
      status = 'unused';
      fulfillment = 'auto';
    }

    // Snapshot the customer's name/phone for the admin winners view.
    let customerName = user.full_name || '';
    let customerPhone = user.phone || '';
    if (!customerName || !customerPhone) {
      const ords = await base44.asServiceRole.entities.Order.filter({ created_by_id: user.id });
      const latest = (ords || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
      if (latest) {
        customerName = customerName || latest.customer_name || '';
        customerPhone = customerPhone || latest.phone || '';
      }
    }

    const spin = await base44.asServiceRole.entities.WheelSpin.create({
      user_id: user.id || '', user_email: user.email, source: 'purchase',
      reward_id: picked.id, reward_type: picked.type, reward_label: picked.label,
      reward_label_en: picked.label_en || '',
      reward_value: Number(picked.value) || 0,
      product_id: productId, product_name: productName, product_name_en: productNameEn,
      product_image: productImage, product_price: productPrice,
      points_awarded: points, discount_code: '', discount_code_id: '',
      customer_name: customerName, customer_phone: customerPhone,
      status, redeemed_order_id: '', expires_at: expiresAt, fulfillment,
    });

    // Discount codes are bound to the spin id, so they're minted after the spin exists.
    let discountCode = '';
    if (picked.type === 'discount_percent' || picked.type === 'discount_fixed' || picked.type === 'credit') {
      const type = picked.type === 'discount_percent' ? 'percent' : 'fixed';
      const rec = await grantDiscountCodeRecord(base44, {
        prefix: 'WHL', type, value: picked.value, expires_at: expiresAtDate,
        owner_email: user.email, wheel_spin_id: spin.id, source: 'wheel',
        description: `Mystery Wheel — ${picked.label}`,
      });
      discountCode = rec.code;
      await base44.asServiceRole.entities.WheelSpin.update(spin.id, {
        discount_code: discountCode, discount_code_id: rec.id,
      });
    }

    await base44.asServiceRole.entities.WheelProgress.update(state.progress.id, {
      spins_used: (state.progress.spins_used || 0) + 1,
      last_activity_at: new Date().toISOString(),
    });

    await recordReward(base44, {
      user_id: user.id, user_email: user.email, source: 'wheel', source_id: spin.id,
      source_name: state.config.name || 'Mystery Wheel',
      reward_type: picked.type, reward_label: picked.label,
      reward_label_en: picked.label_en || '',
      points, discount_code: discountCode, product_id: productId,
      amount: picked.type === 'credit' ? Number(picked.value) || 0 : 0, fulfillment,
    });

    return Response.json({
      success: true,
      reward: {
        id: spin.id, label: picked.label, label_en: picked.label_en || '',
        type: picked.type, value: picked.value,
        points, discount_code: discountCode, fulfillment, status, expires_at: expiresAt,
        product: productId ? { id: productId, name: productName, name_en: productNameEn, image_url: productImage, price: productPrice } : null,
      },
    });
  } catch (error) {
    return Response.json({ success: false, message: error.message }, { status: 500 });
  }
}