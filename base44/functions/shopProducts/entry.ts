import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Server-side paginated product listing for the All Toys page.
// Pushes category + search filtering and (featured/newest) sorting to the
// database with skip/limit, so the client only receives the requested page.
// Price (discount-aware) and age-range filters and price sorting can't be
// expressed as DB queries (age_range is a string, effective price depends on
// category discounts), so when those are active we fetch the matched set and
// filter/sort/paginate it here — still returning only one page to the client.

const PER_PAGE_MAX = 100;
const MATCH_CAP = 10000;

const AGE_OPTIONS = [
  { id: '0_2', min: 0, max: 2 },
  { id: '3_5', min: 3, max: 5 },
  { id: '6_8', min: 6, max: 8 },
  { id: '9_12', min: 9, max: 12 },
  { id: '13', min: 13, max: Infinity },
];

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAgeRange(a) {
  if (!a) return { min: 0, max: Infinity };
  if (String(a).trim() === '0+') return { min: 0, max: Infinity };
  const [lo, hi] = String(a).split('-').map((x) => parseInt(x.trim(), 10));
  return { min: isNaN(lo) ? 0 : lo, max: isNaN(hi) ? Infinity : hi };
}

function overlaps(a, b) {
  return a.max >= b.min && a.min <= b.max;
}

// Effective price: product sale_price wins; otherwise category discount.
function effectivePrice(product, catPct) {
  const base = Number(product?.price) || 0;
  const sale = product?.sale_price != null ? Number(product.sale_price) : null;
  if (sale != null && sale < base) return sale;
  if (catPct > 0) return Math.round(base * (1 - catPct / 100) * 100) / 100;
  return base;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const page = Math.max(1, Math.floor(Number(body.page) || 1));
    const perPage = Math.min(PER_PAGE_MAX, Math.max(1, Math.floor(Number(body.perPage) || 25)));
    const skip = (page - 1) * perPage;
    const sort = body.sort || 'featured';
    const cats = Array.isArray(body.cats) ? body.cats.filter(Boolean) : [];
    const ages = Array.isArray(body.ages) ? body.ages.filter(Boolean) : [];
    const gender = body.gender ? String(body.gender) : null;
    const search = String(body.search || '').trim();
    const priceActive = !!body.priceActive;
    const priceMin = Number(body.priceMin);
    const priceMax = Number(body.priceMax);
    const includeMeta = !!body.includeMeta;

    // Categories — discount-aware pricing + active flag for meta.
    let categories = [];
    try {
      categories = await base44.asServiceRole.entities.Category.list('sort_order', 1000) || [];
    } catch {
      categories = [];
    }
    const catByName = {};
    for (const c of categories) catByName[c.name] = c;
    const catPctFor = (name) => {
      const c = catByName[name];
      return c && c.discount_active && Number(c.discount_percent) > 0 ? Number(c.discount_percent) : 0;
    };

    // DB query: category $in + search $or $regex (implicit AND between them).
    const q = {};
    if (cats.length) q.category = { $in: cats };
    if (gender) q.gender = { $in: [gender, 'Unisex'] };
    if (search) {
      const r = escapeRegex(search);
      q.$or = [
        { name: { $regex: r, $options: 'i' } },
        { name_en: { $regex: r, $options: 'i' } },
        { category: { $regex: r, $options: 'i' } },
        { tags: { $regex: r, $options: 'i' } },
      ];
    }

    const inMemoryNeeded =
      priceActive || ages.length > 0 || sort === 'priceLow' || sort === 'priceHigh';

    let items = [];
    let total = null;
    let hasMore = false;

    if (!inMemoryNeeded) {
      // Pure DB pagination — only the requested page is fetched.
      const sortField = sort === 'newest' ? '-created_date' : '-featured';
      const fetched = await base44.asServiceRole.entities.Product.filter(q, sortField, perPage + 1, skip);
      const list = fetched || [];
      items = list.slice(0, perPage);
      hasMore = list.length > perPage;
      total = null;
    } else {
      // Price/age filtering or price sort need the matched set in memory.
      const matched = await base44.asServiceRole.entities.Product.filter(q, '-created_date', MATCH_CAP);
      const selectedAges = AGE_OPTIONS.filter((g) => ages.includes(g.id));
      const filtered = (matched || []).filter((p) => {
        if (priceActive) {
          const ep = effectivePrice(p, catPctFor(p.category));
          if (ep < priceMin || ep > priceMax) return false;
        }
        if (selectedAges.length) {
          const ok = selectedAges.some((g) =>
            overlaps(parseAgeRange(p.age_range), { min: g.min, max: g.max })
          );
          if (!ok) return false;
        }
        return true;
      });
      filtered.sort((a, b) => {
        if (sort === 'priceLow')
          return effectivePrice(a, catPctFor(a.category)) - effectivePrice(b, catPctFor(b.category));
        if (sort === 'priceHigh')
          return effectivePrice(b, catPctFor(b.category)) - effectivePrice(a, catPctFor(a.category));
        if (sort === 'newest') return new Date(b.created_date) - new Date(a.created_date);
        return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
      });
      total = filtered.length;
      items = filtered.slice(skip, skip + perPage);
      hasMore = skip + perPage < total;
    }

    let priceBounds = null;
    let usedCategories = null;
    if (includeMeta) {
      // Global price bounds + non-empty active categories across ALL products
      // (projected to the few fields we need).
      const allProj = await base44.asServiceRole.entities.Product.filter(
        {}, null, MATCH_CAP, 0, ['category', 'price', 'sale_price']
      );
      let lo = Infinity;
      let hi = -Infinity;
      const usedSet = new Set();
      for (const p of allProj || []) {
        if (p.category) usedSet.add(p.category);
        const ep = effectivePrice(p, catPctFor(p.category));
        if (ep < lo) lo = ep;
        if (ep > hi) hi = ep;
      }
      const activeCatNames = new Set(
        categories.filter((c) => c.active !== false).map((c) => c.name)
      );
      priceBounds = [isFinite(lo) ? Math.floor(lo) : 0, isFinite(hi) ? Math.ceil(hi) : 0];
      usedCategories = [...usedSet].filter((n) => activeCatNames.has(n));
    }

    return Response.json({
      success: true,
      items,
      total,
      hasMore,
      priceBounds,
      usedCategories,
    });
  } catch (error) {
    return Response.json(
      { success: false, message: error.message, items: [], total: 0, hasMore: false },
      { status: 500 }
    );
  }
}