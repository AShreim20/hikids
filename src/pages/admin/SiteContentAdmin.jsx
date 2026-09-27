import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Save, Plus, Trash2, ArrowUp, ArrowDown, Lock, Type, HelpCircle, BookOpen, Tag, Bot, Search, ChevronDown } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSiteContent } from '@/context/SiteContentContext';
import { useAdminLoadGuard } from '@/hooks/useAdminLoadGuard';
import AdminLoadFailed from '@/components/admin/AdminLoadFailed';
import { upsertContent, loadContentRecord } from '@/lib/siteContent';
import { DEFAULT_FAQ_ITEMS, DEFAULT_ABOUT } from '@/lib/siteDefaults';
import { translations } from '@/context/translations';
import { GROUPS, TEXT_FIELD_META } from '@/lib/siteContentMeta';
import { diffCount, snapshotsEqual } from '@/lib/formDirty';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/admin/UnsavedChangesDialog';
import StickySaveBar from '@/components/admin/StickySaveBar';
import HomepageDealsAdminSettings from '@/components/admin/HomepageDealsAdminSettings';
import AssistantAdminSettings from '@/components/admin/AssistantAdminSettings';

const TABS = [
  { id: 'text', label: 'Page Text', icon: Type },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'about', label: 'About', icon: BookOpen },
  { id: 'deals', label: 'Homepage Deals', icon: Tag },
  { id: 'assistant', label: 'Assistant', icon: Bot },
];

const input = 'w-full h-11 px-3 rounded-2xl bg-mist border border-border/70 outline-none focus:border-cosmic';
const area = 'w-full min-h-[80px] p-3 rounded-2xl bg-mist border border-border/70 outline-none focus:border-cosmic font-body';

// How many distinct translation keys differ between the working i18n-overrides
// value and its last-saved baseline — counts a key once even if BOTH its
// AR and EN value changed, matching how one field reads to the admin.
function ovDiffCount(a, b) {
  const keys = new Set([...Object.keys(a?.en || {}), ...Object.keys(a?.ar || {}), ...Object.keys(b?.en || {}), ...Object.keys(b?.ar || {})]);
  let n = 0;
  for (const k of keys) {
    if ((a?.en?.[k] ?? '') !== (b?.en?.[k] ?? '') || (a?.ar?.[k] ?? '') !== (b?.ar?.[k] ?? '')) n += 1;
  }
  return n;
}

function matchesSearch(meta, ov, q) {
  if (!q) return true;
  const hay = [
    meta.label_ar, meta.label_en, meta.location_ar, meta.location_en, meta.key,
    ov.ar[meta.key] ?? translations.ar[meta.key] ?? '',
    ov.en[meta.key] ?? translations.en[meta.key] ?? '',
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

// One field's paired AR/EN editor, with its human label + "appears in" hint
// instead of the raw translation key as the primary thing the admin reads.
function TextField({ meta, ov, setOvField }) {
  const Ctl = meta.type === 'textarea' ? 'textarea' : 'input';
  const cls = meta.type === 'textarea' ? area : input;
  return (
    <div className="rounded-3xl bg-card border border-border/60 p-4">
      <p className="font-heading font-bold text-sm">{meta.label_ar}</p>
      <p className="text-xs text-muted-foreground">{meta.label_en}</p>
      <p className="mt-1 text-[11px] text-cosmic/80">
        {meta.location_ar} · {meta.location_en}
      </p>
      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-heading font-bold text-cosmic">العربية</label>
          <Ctl
            value={ov.ar[meta.key] ?? translations.ar[meta.key] ?? ''}
            onChange={(e) => setOvField('ar', meta.key, e.target.value)}
            className={`mt-1 ${cls}`}
            dir="rtl"
          />
        </div>
        <div>
          <label className="text-xs font-heading font-bold text-cosmic">English</label>
          <Ctl
            value={ov.en[meta.key] ?? translations.en[meta.key] ?? ''}
            onChange={(e) => setOvField('en', meta.key, e.target.value)}
            className={`mt-1 ${cls}`}
            dir="ltr"
          />
        </div>
      </div>
      <p className="mt-1.5 text-[10px] font-mono text-muted-foreground/60">{meta.key}</p>
    </div>
  );
}

// One collapsible group — only rendered at all when it has at least one
// field matching the current search (so filtering never leaves an empty
// accordion header sitting on screen).
function GroupSection({ group, fields, ov, setOvField, open, onToggle }) {
  // Fields inside a group are shown under their own small sub-heading
  // (e.g. Homepage's Hero vs. Newsletter block) whenever consecutive fields
  // share a `section`, so a 50-field group never reads as one flat wall.
  let lastSection = null;
  return (
    <div className="rounded-3xl bg-card border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-start"
      >
        <span className="font-heading font-extrabold">{group.label_ar} <span className="text-muted-foreground font-normal">/ {group.label_en}</span></span>
        <span className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{fields.length}</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-5 space-y-3">
          {fields.map((meta) => {
            const showHeading = meta.section && meta.section !== lastSection;
            lastSection = meta.section;
            return (
              <React.Fragment key={meta.key}>
                {showHeading && (
                  <p className="pt-2 text-xs font-heading font-bold uppercase tracking-wide text-muted-foreground">{meta.section}</p>
                )}
                <TextField meta={meta} ov={ov} setOvField={setOvField} />
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SiteContentAdmin() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const { faqItems: liveFaq, about: liveAbout } = useSiteContent();
  const [tab, setTab] = useState('text');

  // --- Page Text (i18n overrides) ---
  const [ov, setOv] = useState({ en: {}, ar: {} });
  const ovBaselineRef = useRef({ en: {}, ar: {} });
  const [savingText, setSavingText] = useState(false);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [openGroups, setOpenGroups] = useState(() => new Set());

  const { failure, guard } = useAdminLoadGuard();

  // The existing overrides are editable data: if they fail to load the page
  // shows the load-failed screen (no editor, so no save can overwrite them with
  // an empty set). A record that genuinely doesn't exist yet stays {en:{},ar:{}}.
  const loadOverrides = async () => {
    const r = await guard(() => loadContentRecord('i18n_overrides'));
    if (r === undefined) return;
    const next = r?.data ? { en: r.data.en || {}, ar: r.data.ar || {} } : { en: {}, ar: {} };
    setOv(next);
    ovBaselineRef.current = next;
  };

  useEffect(() => {
    if (user?.role === 'admin') loadOverrides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const setOvField = (langKey, key, val) => setOv((o) => ({ ...o, [langKey]: { ...o[langKey], [key]: val } }));

  const saveText = async () => {
    setSavingText(true);
    try {
      await upsertContent('i18n_overrides', ov);
      ovBaselineRef.current = ov;
      toast({ title: t('settings.saved') });
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setSavingText(false);
  };
  const cancelText = () => setOv(ovBaselineRef.current);
  const textDirty = ovDiffCount(ov, ovBaselineRef.current);

  // Groups + fields the current search/filter combination actually matches —
  // an unmatched group is left out entirely rather than shown empty.
  const q = search.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    return GROUPS
      .filter((g) => groupFilter === 'all' || groupFilter === g.id)
      .map((g) => ({ group: g, fields: TEXT_FIELD_META.filter((m) => m.group === g.id && matchesSearch(m, ov, q)) }))
      .filter((g) => g.fields.length > 0);
  }, [groupFilter, q, ov]);

  // A search match auto-expands its group (otherwise the admin would have to
  // guess which collapsed section to open); typing a search also implies
  // "show me everything that matches" rather than only what was already open.
  useEffect(() => {
    if (!q) return;
    setOpenGroups((prev) => {
      const next = new Set(prev);
      visibleGroups.forEach((g) => next.add(g.group.id));
      return next;
    });
  }, [q, visibleGroups]);

  const toggleGroup = (id) => setOpenGroups((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // --- FAQ items ---
  const [items, setItems] = useState([]);
  const faqBaselineRef = useRef([]);
  const [savingFaq, setSavingFaq] = useState(false);
  useEffect(() => {
    const next = (liveFaq && liveFaq.length ? liveFaq : DEFAULT_FAQ_ITEMS).map((it) => ({ ...it }));
    setItems(next);
    faqBaselineRef.current = next;
  }, [liveFaq]);
  const updateItem = (i, field, val) => setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const addItem = () => setItems((arr) => [...arr, { q_ar: '', q_en: '', a_ar: '', a_en: '' }]);
  const removeItem = (i) => setItems((arr) => arr.filter((_, idx) => idx !== i));
  const move = (i, dir) => setItems((arr) => {
    const j = i + dir; if (j < 0 || j >= arr.length) return arr;
    const next = [...arr]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const saveFaq = async () => {
    setSavingFaq(true);
    try {
      await upsertContent('faq_items', { items });
      faqBaselineRef.current = items;
      toast({ title: t('settings.saved') });
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setSavingFaq(false);
  };
  const cancelFaq = () => setItems(faqBaselineRef.current);
  const faqDirty = snapshotsEqual(items, faqBaselineRef.current) ? 0 : 1;

  // --- About content ---
  const [about, setAbout] = useState(DEFAULT_ABOUT);
  const aboutBaselineRef = useRef(DEFAULT_ABOUT);
  const [savingAbout, setSavingAbout] = useState(false);
  useEffect(() => {
    const next = { ...DEFAULT_ABOUT, ...(liveAbout || {}) };
    setAbout(next);
    aboutBaselineRef.current = next;
  }, [liveAbout]);
  const setAboutField = (k, v) => setAbout((a) => ({ ...a, [k]: v }));
  const saveAbout = async () => {
    setSavingAbout(true);
    try {
      await upsertContent('about', about);
      aboutBaselineRef.current = about;
      toast({ title: t('settings.saved') });
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setSavingAbout(false);
  };
  const cancelAbout = () => setAbout(aboutBaselineRef.current);
  const aboutDirty = diffCount(about, aboutBaselineRef.current);

  // One navigation guard covering whichever tab currently has unsaved edits —
  // reuses the same architecture every other admin editor uses, rather than
  // inventing a second one for this page.
  const anyDirty = textDirty > 0 || faqDirty > 0 || aboutDirty > 0;
  const { confirmOpen, stay, leave } = useUnsavedChangesGuard(anyDirty);

  if (failure) return <AdminLoadFailed failure={failure} onRetry={loadOverrides} />;

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10"><Lock className="w-8 h-8 text-destructive" /></div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('admin.denied')}</h1>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">{t('pd.back')}</Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('pd.back')}</Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid place-items-center w-12 h-12 rounded-2xl bg-cosmic/10"><Type className="w-6 h-6 text-cosmic" /></div>
          <div>
            <h1 className="font-heading font-extrabold text-3xl">Site Content</h1>
            <p className="text-muted-foreground">Edit the static text customers see across the website.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex items-center gap-1 p-1 rounded-full bg-mist w-fit flex-wrap">
          {TABS.map((tb) => (
            <button key={tb.id} onClick={() => setTab(tb.id)} className={`inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-heading font-bold transition-colors ${tab === tb.id ? 'bg-cosmic text-white' : 'text-foreground/70'}`}>
              <tb.icon className="w-4 h-4" /> {tb.label}
            </button>
          ))}
        </div>

        {/* Page Text */}
        {tab === 'text' && (
          <div className="mt-6">
            <div className="relative">
              <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={ar ? 'ابحث عن نص، مثال: الشحن' : 'Search text, e.g. shipping'}
                className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border/70 text-sm"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setGroupFilter('all')} className={`h-9 px-3 rounded-full text-xs font-heading font-bold transition-colors ${groupFilter === 'all' ? 'bg-cosmic text-white' : 'bg-card border border-border/60 text-foreground/70'}`}>
                {ar ? 'الكل' : 'All'}
              </button>
              {GROUPS.map((g) => (
                <button key={g.id} onClick={() => setGroupFilter(g.id)} className={`h-9 px-3 rounded-full text-xs font-heading font-bold transition-colors ${groupFilter === g.id ? 'bg-cosmic text-white' : 'bg-card border border-border/60 text-foreground/70'}`}>
                  {ar ? g.label_ar : g.label_en}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {ar ? 'اترك حقل لغة فارغًا لإبقاء النص الأصلي لتلك اللغة.' : 'Leave a language field empty to keep that language’s original wording.'}
            </p>
            <div className="mt-4 space-y-3">
              {visibleGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">{ar ? 'لا نتائج مطابقة' : 'No matching content'}</p>
              ) : visibleGroups.map(({ group, fields }) => (
                <GroupSection
                  key={group.id}
                  group={group}
                  fields={fields}
                  ov={ov}
                  setOvField={setOvField}
                  open={openGroups.has(group.id) || groupFilter === group.id}
                  onToggle={() => toggleGroup(group.id)}
                />
              ))}
            </div>
            <StickySaveBar dirtyCount={textDirty} onCancel={cancelText} ar={ar}>
              <button onClick={saveText} disabled={savingText} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60">
                {savingText ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {t('settings.save')}
              </button>
            </StickySaveBar>
          </div>
        )}

        {/* FAQ */}
        {tab === 'faq' && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground">Add, edit, delete, and reorder frequently asked questions. Each question has Arabic and English text.</p>
            <div className="mt-4 space-y-4">
              {items.map((it, i) => (
                <div key={i} className="rounded-3xl bg-card border border-border/60 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-heading font-bold text-muted-foreground">#{i + 1}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="grid place-items-center w-9 h-9 rounded-full bg-mist disabled:opacity-40"><ArrowUp className="w-4 h-4" /></button>
                      <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="grid place-items-center w-9 h-9 rounded-full bg-mist disabled:opacity-40"><ArrowDown className="w-4 h-4" /></button>
                      <button onClick={() => removeItem(i)} className="grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-heading font-bold text-cosmic">Question (AR)</label>
                      <input value={it.q_ar} onChange={(e) => updateItem(i, 'q_ar', e.target.value)} className={`mt-1 ${input}`} dir="rtl" />
                    </div>
                    <div>
                      <label className="text-xs font-heading font-bold text-cosmic">Question (EN)</label>
                      <input value={it.q_en} onChange={(e) => updateItem(i, 'q_en', e.target.value)} className={`mt-1 ${input}`} dir="ltr" />
                    </div>
                    <div>
                      <label className="text-xs font-heading font-bold text-cosmic">Answer (AR)</label>
                      <textarea value={it.a_ar} onChange={(e) => updateItem(i, 'a_ar', e.target.value)} className={`mt-1 ${area}`} dir="rtl" />
                    </div>
                    <div>
                      <label className="text-xs font-heading font-bold text-cosmic">Answer (EN)</label>
                      <textarea value={it.a_en} onChange={(e) => updateItem(i, 'a_en', e.target.value)} className={`mt-1 ${area}`} dir="ltr" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-4 squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-mist font-heading font-bold"><Plus className="w-5 h-5" /> Add question</button>
            <StickySaveBar dirtyCount={faqDirty} onCancel={cancelFaq} ar={ar}>
              <button onClick={saveFaq} disabled={savingFaq} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60">
                {savingFaq ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {t('settings.save')}
              </button>
            </StickySaveBar>
          </div>
        )}

        {/* About */}
        {tab === 'about' && (
          <div className="mt-6 space-y-6">
            <p className="text-sm text-muted-foreground">Edit the About page story, values, and call-to-action.</p>
            <div className="rounded-3xl bg-card border border-border/60 p-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-heading font-bold text-cosmic">Story label (AR)</label><input value={about.storyLabelAr || ''} onChange={(e) => setAboutField('storyLabelAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Story label (EN)</label><input value={about.storyLabelEn || ''} onChange={(e) => setAboutField('storyLabelEn', e.target.value)} className={`mt-1 ${input}`} dir="ltr" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Story title (AR)</label><input value={about.storyTitleAr || ''} onChange={(e) => setAboutField('storyTitleAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Story title (EN)</label><input value={about.storyTitleEn || ''} onChange={(e) => setAboutField('storyTitleEn', e.target.value)} className={`mt-1 ${input}`} dir="ltr" /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-heading font-bold text-cosmic">Story paragraphs (AR) — one per line</label><textarea value={(about.storyAr || []).join('\n')} onChange={(e) => setAboutField('storyAr', e.target.value.split('\n'))} className={`mt-1 ${area}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Story paragraphs (EN) — one per line</label><textarea value={(about.storyEn || []).join('\n')} onChange={(e) => setAboutField('storyEn', e.target.value.split('\n'))} className={`mt-1 ${area}`} dir="ltr" /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-heading font-bold text-cosmic">Values label (AR)</label><input value={about.valuesLabelAr || ''} onChange={(e) => setAboutField('valuesLabelAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Values label (EN)</label><input value={about.valuesLabelEn || ''} onChange={(e) => setAboutField('valuesLabelEn', e.target.value)} className={`mt-1 ${input}`} dir="ltr" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Values title (AR)</label><input value={about.valuesTitleAr || ''} onChange={(e) => setAboutField('valuesTitleAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Values title (EN)</label><input value={about.valuesTitleEn || ''} onChange={(e) => setAboutField('valuesTitleEn', e.target.value)} className={`mt-1 ${input}`} dir="ltr" /></div>
              </div>
              {['Ar', 'En'].map((lng) => (
                <div key={lng}>
                  <label className="text-xs font-heading font-bold text-cosmic">Values ({lng})</label>
                  <div className="mt-1 space-y-2">
                    {(about[`values${lng}`] || []).map((v, i) => (
                      <div key={i} className="grid sm:grid-cols-2 gap-2">
                        <input value={v.title || ''} onChange={(e) => { const arr = [...about[`values${lng}`]]; arr[i] = { ...arr[i], title: e.target.value }; setAboutField(`values${lng}`, arr); }} className={input} placeholder="Title" dir={lng === 'Ar' ? 'rtl' : 'ltr'} />
                        <input value={v.desc || ''} onChange={(e) => { const arr = [...about[`values${lng}`]]; arr[i] = { ...arr[i], desc: e.target.value }; setAboutField(`values${lng}`, arr); }} className={input} placeholder="Description" dir={lng === 'Ar' ? 'rtl' : 'ltr'} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA title (AR)</label><input value={about.ctaTitleAr || ''} onChange={(e) => setAboutField('ctaTitleAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA title (EN)</label><input value={about.ctaTitleEn || ''} onChange={(e) => setAboutField('ctaTitleEn', e.target.value)} className={`mt-1 ${input}`} dir="ltr" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA description (AR)</label><input value={about.ctaDescAr || ''} onChange={(e) => setAboutField('ctaDescAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA description (EN)</label><input value={about.ctaDescEn || ''} onChange={(e) => setAboutField('ctaDescEn', e.target.value)} className={`mt-1 ${input}`} dir="ltr" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA button (AR)</label><input value={about.ctaBtnAr || ''} onChange={(e) => setAboutField('ctaBtnAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA button (EN)</label><input value={about.ctaBtnEn || ''} onChange={(e) => setAboutField('ctaBtnEn', e.target.value)} className={`mt-1 ${input}`} dir="ltr" /></div>
              </div>
            </div>
            <StickySaveBar dirtyCount={aboutDirty} onCancel={cancelAbout} ar={ar}>
              <button onClick={saveAbout} disabled={savingAbout} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60">
                {savingAbout ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {t('settings.save')}
              </button>
            </StickySaveBar>
          </div>
        )}

        {/* Homepage Deals */}
        {tab === 'deals' && <HomepageDealsAdminSettings />}
        {tab === 'assistant' && <AssistantAdminSettings />}
      </div>
      <Footer />
      <UnsavedChangesDialog open={confirmOpen} onStay={stay} onLeave={leave} />
    </div>
  );
}
