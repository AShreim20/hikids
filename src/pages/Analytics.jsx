import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Eye, Users, ArrowLeft } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { useLanguage } from '@/context/LanguageContext';
import Footer from '@/components/Footer';
import { Image } from '@/components/ui/image';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export default function Analytics() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [propertyId, setPropertyId] = useState('');

  // gaInsights read from Base44's platform-managed Google Analytics connector
  // (a stored GA4 OAuth token) — there's no Supabase equivalent yet, and
  // building one means a real Google Cloud OAuth client + re-authorizing a
  // GA4 property, which needs the store owner's input, not something this
  // migration can do on its own. Surfaced clearly rather than left silently
  // broken or crashing now that Base44 itself is gone (Phase 9 cutover).
  const load = () => {
    setLoading(false);
    setError('Google Analytics is not connected yet.');
  };

  useEffect(() => {
    load();
  }, []);

  const maxViews = data?.topProducts?.length ? Math.max(...data.topProducts.map((p) => p.views)) : 1;
  const maxSessions = data?.sources?.length ? Math.max(...data.sources.map((s) => s.sessions)) : 1;

  return (
    <div className="min-h-screen bg-background pb-32">
      <PageHeader title={t('nav.insights')} />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to store
        </Link>

        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-cosmic">
              <BarChart3 className="w-6 h-6" />
              <p className="text-sm uppercase tracking-widest font-medium">Insights</p>
            </div>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">Store analytics</h1>
            <p className="mt-2 text-muted-foreground">Top viewed toys and where your visitors come from — last 30 days.</p>
          </div>
          {data?.properties?.length > 1 && (
            <Select value={propertyId} onValueChange={(v) => load(v)}>
              <SelectTrigger className="h-12 w-64 rounded-2xl bg-card border-border">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {data.properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {loading ? (
          <div className="mt-12 grid lg:grid-cols-2 gap-8">
            <div className="h-80 rounded-3xl bg-mist animate-pulse" />
            <div className="h-80 rounded-3xl bg-mist animate-pulse" />
          </div>
        ) : error ? (
          <div className="mt-12 rounded-3xl bg-destructive/10 border border-destructive/30 p-8 text-center">
            <p className="font-heading font-bold text-xl text-destructive">{error}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Connecting a Google Analytics property needs a one-time setup by the store owner.
            </p>
          </div>
        ) : (
          <div className="mt-12 grid lg:grid-cols-2 gap-8">
            {/* Top products */}
            <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <Eye className="w-5 h-5 text-cosmic" />
                <h2 className="font-heading font-extrabold text-2xl">Most viewed toys</h2>
              </div>
              {data.topProducts.length === 0 ? (
                <p className="text-muted-foreground py-10 text-center">No product views recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {data.topProducts.map((p, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <span className="font-heading font-extrabold text-lg text-muted-foreground w-6">{i + 1}</span>
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-mist shrink-0">
                        {p.image_url && <Image src={p.image_url} fittingType="fill" className="w-12 h-12" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link to={`/product/${p.id}`} className="font-heading font-bold truncate block hover:text-cosmic">
                          {p.name}
                        </Link>
                        <div className="mt-1.5 h-2 rounded-full bg-mist overflow-hidden">
                          <div className="h-full bg-cosmic rounded-full" style={{ width: `${(p.views / maxViews) * 100}%` }} />
                        </div>
                      </div>
                      <span className="font-heading font-bold text-sm shrink-0">{p.views} views</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Traffic sources */}
            <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-8">
              <div className="flex items-center gap-2 mb-6">
                <Users className="w-5 h-5 text-cosmic" />
                <h2 className="font-heading font-extrabold text-2xl">Where visitors come from</h2>
              </div>
              {data.sources.length === 0 ? (
                <p className="text-muted-foreground py-10 text-center">No traffic recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {data.sources.map((s, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="grid place-items-center w-10 h-10 rounded-full bg-cosmic/15 text-cosmic font-heading font-bold shrink-0">
                        {s.source.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-bold truncate">{s.source} <span className="text-muted-foreground font-normal">/ {s.medium}</span></p>
                        <div className="mt-1.5 h-2 rounded-full bg-mist overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${(s.sessions / maxSessions) * 100}%` }} />
                        </div>
                      </div>
                      <span className="font-heading font-bold text-sm shrink-0">{s.sessions} sessions</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}