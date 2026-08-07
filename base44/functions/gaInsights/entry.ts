import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries';
const DATA_API = (id) => `https://analyticsdata.googleapis.com/v1beta/properties/${id}:runReport`;

function fmt(d) {
  return d.toISOString().slice(0, 10);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const days = payload.days || 30;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('google_analytics');
    const authHeaders = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    // Discover GA4 properties
    const accRes = await fetch(ADMIN_API, { headers: authHeaders });
    const accData = await accRes.json();
    if (!accRes.ok) return Response.json({ error: accData.error?.message || 'GA admin error' }, { status: 502 });
    const properties = (accData.accountSummaries || []).flatMap((a) =>
      (a.propertySummaries || []).map((ps) => ({
        id: ps.property.split('/')[1],
        displayName: ps.displayName,
      }))
    );
    if (!properties.length) return Response.json({ error: 'No Google Analytics properties found' }, { status: 404 });

    const propertyId = payload.propertyId || properties[0].id;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const dateRange = { startDate: fmt(start), endDate: fmt(end) };

    // Top product pages by views
    const productReport = {
      dateRanges: [dateRange],
      dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }],
      dimensionFilter: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/product/' } } },
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: 10,
    };
    const pRes = await fetch(DATA_API(propertyId), { method: 'POST', headers: authHeaders, body: JSON.stringify(productReport) });
    const pData = await pRes.json();
    if (!pRes.ok) return Response.json({ error: pData.error?.message || 'GA report error' }, { status: 502 });

    const pathRows = (pData.rows || []).map((r) => ({
      path: r.dimensionValues[0].value,
      views: parseInt(r.metricValues[0].value, 10) || 0,
    }));

    // Map product ids to names
    const ids = pathRows
      .map((r) => r.path.split('/product/')[1])
      .filter(Boolean)
      .map((s) => s.split(/[/?#]/)[0]);
    const products = await base44.asServiceRole.entities.Product.list();
    const byId = new Map(products.map((p) => [p.id, p]));
    const topProducts = pathRows
      .map((r) => {
        const id = r.path.split('/product/')[1]?.split(/[/?#]/)[0];
        const p = id ? byId.get(id) : null;
        return {
          id,
          name: p ? p.name : 'Unknown product',
          image_url: p ? p.image_url : null,
          category: p ? p.category : null,
          views: r.views,
        };
      })
      .filter((r) => r.id);

    // Traffic sources
    const sourceReport = {
      dateRanges: [dateRange],
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'sessions' }],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 10,
    };
    const sRes = await fetch(DATA_API(propertyId), { method: 'POST', headers: authHeaders, body: JSON.stringify(sourceReport) });
    const sData = await sRes.json();
    if (!sRes.ok) return Response.json({ error: sData.error?.message || 'GA report error' }, { status: 502 });
    const sources = (sData.rows || []).map((r) => ({
      source: r.dimensionValues[0].value || '(direct)',
      medium: r.dimensionValues[1].value || '(none)',
      sessions: parseInt(r.metricValues[0].value, 10) || 0,
    }));

    return Response.json({
      propertyId,
      properties,
      days,
      topProducts,
      sources,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}