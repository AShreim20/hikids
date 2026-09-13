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

// products.gender is a single canonical value enforced by a DB check
// constraint ('male' | 'female' | 'both' | NULL) — stored values are already
// clean, so this only needs to tolerantly parse the *incoming filter
// request*: the client sends 'male'/'female', but a stale bookmark/cached
// bundle from before the gender-classification fix could still send the old
// 'Boy'/'Girl' values, so both are accepted here rather than silently
// dropping the filter.
function normalizeGenderTag(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (['male', 'boy', 'boys', 'm'].includes(s)) return 'male';
  if (['female', 'girl', 'girls', 'f'].includes(s)) return 'female';
  return null;
}

// Effective price: product sale_price wins; otherwise category discount.
// Mirrors src/lib/pricing.js's priceInfo() — kept in sync manually since
// this Edge Function runs in Deno and can't import that Vite-bundled
// client module. Any change to the discount rule belongs in both places.
function effectivePrice(product, catPct) {
  const base = Number(product?.price) || 0;
  const sale = product?.sale_price != null ? Number(product.sale_price) : null;
  if (sale != null && sale < base) return sale;
  if (catPct > 0) return Math.round(base * (1 - catPct / 100) * 100) / 100;
  return base;
}

// "Is this product on sale" / discount % — same rule as effectivePrice
// above and src/lib/pricing.js's isProductOnSale()/getDiscountPercentage().
// No discount start/end date columns exist on products or categories today,
// so there is no date-range check here — see that file's own comment.
function isOnSale(product, catPct) {
  const base = Number(product?.price) || 0;
  if (base <= 0) return false;
  const sale = product?.sale_price != null ? Number(product.sale_price) : null;
  if (sale != null && sale < base) return true;
  return catPct > 0;
}

function discountPercent(product, catPct) {
  const base = Number(product?.price) || 0;
  if (base <= 0) return 0;
  const sale = product?.sale_price != null ? Number(product.sale_price) : null;
  if (sale != null && sale < base) return Math.round((1 - sale / base) * 100);
  return catPct > 0 ? catPct : 0;
}

// PostgREST's `in.()`/array-literal filter syntax needs double-quoting for
// any value containing a comma, parenthesis, or double quote — none of the
// current category names do, but this is user-curated admin data (category
// names), not attacker input, so quoting it correctly is about correctness,
// not security; sanitizeSearch (below) is the actual injection guard for
// real free-text user input.
const pgQuote = (v) => `"${String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

function applyCommonFilters(query, { cats, catIds, gender, search }) {
  // This function runs on the service-role client, which bypasses RLS
  // entirely — so, unlike every other product read path in the app, the
  // status='published' rule has to be applied explicitly here too, or a
  // draft would leak into the public catalog/search despite RLS blocking it
  // everywhere else.
  query = query.eq('status', 'published');
  if (cats.length) {
    // A product matches a selected category if that category is either its
    // Primary Category (the legacy `category` text column, kept as a
    // denormalized mirror of the primary category's name — see the
    // multi-category migration) or one of its Additional Categories
    // (`category_ids`, a uuid[] overlap). `catIds` is the subset of the
    // selected category *names* that resolved to a real category id; a
    // name that didn't resolve (e.g. a legacy/orphaned category label) still
    // matches via the plain name check, so nothing that worked before this
    // stops working.
    if (catIds.length) {
      query = query.or(`category.in.(${cats.map(pgQuote).join(',')}),category_ids.ov.{${catIds.join(',')}}`);
    } else {
      query = query.in('category', cats);
    }
  }
  // gender is already normalized to the literal string 'male' or 'female' by
  // the caller (never raw user input), so this is safe to inline. A product
  // classified 'both' matches every gender filter; NULL (not yet
  // classified) matches neither — it is deliberately never treated as
  // "both", per the explicit fix for products silently appearing in every
  // gender filter.
  if (gender) query = query.or(`gender.eq.${gender},gender.eq.both`);
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
    // The client sends the canonical 'male'/'female', tolerantly parsed here
    // in case of a stale cached bundle sending the old 'Boy'/'Girl' values.
    // Only 'male'/'female' are real filters; a stray 'both'/unrecognized
    // value means "no gender filter", not "match only both-gender products".
    const normalizedGender = normalizeGenderTag(body.gender);
    const gender = normalizedGender === 'male' || normalizedGender === 'female' ? normalizedGender : null;
    const search = String(body.search || '').trim();
    const onSale = !!body.onSale;
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
    const catNameById = {};
    for (const c of categories) { catByName[c.name] = c; catNameById[c.id] = c.name; }
    const catPctFor = (name) => {
      const c = catByName[name];
      return c && c.discount_active && Number(c.discount_percent) > 0 ? Number(c.discount_percent) : 0;
    };
    // Selected category *names* resolved to their stable ids, for matching a
    // product's Additional Categories (category_ids, uuid[]) — a name that
    // doesn't resolve (legacy/orphaned category label) is simply skipped
    // here; it still matches via the plain-name check in applyCommonFilters.
    const catIds = cats.map((n) => catByName[n]?.id).filter(Boolean);

    // gender is now a plain DB-level filter (see applyCommonFilters) — only
    // price/age/onSale filtering or price/discount sorting still need the
    // matched set pulled into memory (age_range is a legacy free-text
    // string, and effective price/discount depend on the category's live
    // discount, which isn't expressible as a single-column DB filter).
    const inMemoryNeeded =
      priceActive || onSale || ages.length > 0 || sort === 'priceLow' || sort === 'priceHigh' || sort === 'discount';

    let items = [];
    let total = null;
    let hasMore = false;

    if (!inMemoryNeeded) {
      // Pure DB pagination — only the requested page is fetched.
      let query = applyCommonFilters(service.from('products').select('*'), { cats, catIds, gender, search });
      const sortColumn = sort === 'newest' ? 'created_date' : 'featured';
      query = query.order(sortColumn, { ascending: false }).range(skip, skip + perPage);
      const { data } = await query;
      const list = data || [];
      items = list.slice(0, perPage);
      hasMore = list.length > perPage;
      total = null;
    } else {
      // Price/age filtering or price sort need the matched set in memory.
      let query = applyCommonFilters(service.from('products').select('*'), { cats, catIds, gender, search });
      query = query.order('created_date', { ascending: false }).limit(MATCH_CAP);
      const { data } = await query;
      const matched = data || [];

      const selectedAges = AGE_OPTIONS.filter((g) => ages.includes(g.id));
      const filtered = matched.filter((p) => {
        if (onSale && !isOnSale(p, catPctFor(p.category))) return false;
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
        if (sort === 'discount') return discountPercent(b, catPctFor(b.category)) - discountPercent(a, catPctFor(a.category));
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
      const { data: allProj } = await service.from('products').select('category,category_ids,price,sale_price').eq('status', 'published').limit(MATCH_CAP);
      let lo = Infinity;
      let hi = -Infinity;
      const usedSet = new Set();
      for (const p of allProj || []) {
        if (p.category) usedSet.add(p.category);
        // "Used" (has at least one product) now also covers a category only
        // ever assigned as an Additional Category, not just Primary.
        for (const cid of p.category_ids || []) {
          const n = catNameById[cid];
          if (n) usedSet.add(n);
        }
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
