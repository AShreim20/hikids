import { serviceRoleClient } from '../_shared/client.ts';
import { handlePreflight, json } from '../_shared/cors.ts';

// Server-side paginated product listing for the All Toys page. Public — no
// auth required. Pushes category + search filtering and (featured/newest)
// sorting to the database with range-based pagination, so the client only
// receives the requested page. Price (discount-aware) and age-range filters
// and price sorting can't be expressed as a simple DB query (age_range is a
// legacy string, effective price depends on category discounts), so when
// those are active the matched set is fetched and filtered/sorted/paginated
// here in memory — still returning only one page to the client.

const PER_PAGE_MAX = 100;
const MATCH_CAP = 10000;

const AGE_OPTIONS = [
  { id: '0_2', min: 0, max: 2 },
  { id: '3_5', min: 3, max: 5 },
  { id: '6_8', min: 6, max: 8 },
  { id: '9_12', min: 9, max: 12 },
  { id: '12', min: 12, max: Infinity },
];

// PostgREST's .or() filter syntax uses "," to separate conditions and
// "(",")" for grouping — strip those from user search input so it can't
// break out of the filter string. "%"/"_" stay as ILIKE wildcards, same as
// typing them into any search box.
function sanitizeSearch(s) {
  return String(s || '').replace(/[,()]/g, '').trim();
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

function applyCommonFilters(query, { cats, gender, search }) {
  if (cats.length) query = query.in('category', cats);
  if (gender) query = query.overlaps('gender', [gender, 'Unisex']);
  const s = sanitizeSearch(search);
  if (s) query = query.or(`name.ilike.%${s}%,name_en.ilike.%${s}%,category.ilike.%${s}%`);
  return query;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  try {
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

    const service = serviceRoleClient();

    // Categories — discount-aware pricing + active flag for meta.
    let categories = [];
    try {
      const { data } = await service.from('categories').select('*').order('sort_order').limit(1000);
      categories = data || [];
    } catch {
      categories = [];
    }
    const catByName = {};
    for (const c of categories) catByName[c.name] = c;
    const catPctFor = (name) => {
      const c = catByName[name];
      return c && c.discount_active && Number(c.discount_percent) > 0 ? Number(c.discount_percent) : 0;
    };

    const inMemoryNeeded = priceActive || ages.length > 0 || sort === 'priceLow' || sort === 'priceHigh';

    let items = [];
    let total = null;
    let hasMore = false;

    if (!inMemoryNeeded) {
      // Pure DB pagination — only the requested page is fetched.
      let query = applyCommonFilters(service.from('products').select('*'), { cats, gender, search });
      const sortColumn = sort === 'newest' ? 'created_date' : 'featured';
      query = query.order(sortColumn, { ascending: false }).range(skip, skip + perPage);
      const { data } = await query;
      const list = data || [];
      items = list.slice(0, perPage);
      hasMore = list.length > perPage;
      total = null;
    } else {
      // Price/age filtering or price sort need the matched set in memory.
      let query = applyCommonFilters(service.from('products').select('*'), { cats, gender, search });
      query = query.order('created_date', { ascending: false }).limit(MATCH_CAP);
      const { data } = await query;
      const matched = data || [];

      const selectedAges = AGE_OPTIONS.filter((g) => ages.includes(g.id));
      const filtered = matched.filter((p) => {
        if (priceActive) {
          const ep = effectivePrice(p, catPctFor(p.category));
          if (ep < priceMin || ep > priceMax) return false;
        }
        if (selectedAges.length) {
          const ids = Array.isArray(p.ages) ? p.ages : [];
          const ok = selectedAges.some((g) => {
            if (ids.includes(g.id) || ids.includes('all')) return true;
            const legacy = p.age_range;
            if (legacy) return overlaps(parseAgeRange(legacy), { min: g.min, max: g.max });
            return false;
          });
          if (!ok) return false;
        }
        return true;
      });
      filtered.sort((a, b) => {
        if (sort === 'priceLow') return effectivePrice(a, catPctFor(a.category)) - effectivePrice(b, catPctFor(b.category));
        if (sort === 'priceHigh') return effectivePrice(b, catPctFor(b.category)) - effectivePrice(a, catPctFor(a.category));
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
      const { data: allProj } = await service.from('products').select('category,price,sale_price').limit(MATCH_CAP);
      let lo = Infinity;
      let hi = -Infinity;
      const usedSet = new Set();
      for (const p of allProj || []) {
        if (p.category) usedSet.add(p.category);
        const ep = effectivePrice(p, catPctFor(p.category));
        if (ep < lo) lo = ep;
        if (ep > hi) hi = ep;
      }
      const activeCatNames = new Set(categories.filter((c) => c.active !== false).map((c) => c.name));
      priceBounds = [isFinite(lo) ? Math.floor(lo) : 0, isFinite(hi) ? Math.ceil(hi) : 0];
      usedCategories = [...usedSet].filter((n) => activeCatNames.has(n));
    }

    return json({ success: true, items, total, hasMore, priceBounds, usedCategories });
  } catch (error) {
    return json({ success: false, message: error.message, items: [], total: 0, hasMore: false }, { status: 500 });
  }
});
