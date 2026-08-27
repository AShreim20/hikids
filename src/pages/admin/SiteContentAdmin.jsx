import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Save, Plus, Trash2, ArrowUp, ArrowDown, Lock, Type, HelpCircle, BookOpen } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSiteContent } from '@/context/SiteContentContext';
import { upsertContent, loadContentRecord } from '@/lib/siteContent';
import { DEFAULT_FAQ_ITEMS, DEFAULT_ABOUT } from '@/lib/siteDefaults';
import { translations } from '@/context/translations';
import StickySaveBar from '@/components/admin/StickySaveBar';

// Group translation keys into friendly pages for the override editor.
const PAGE_GROUPS = [
  { id: 'home', label: 'Home', prefixes: ['hero.', 'cats.', 'cat.', 'promise.', 'rec.', 'nl.'] },
  { id: 'about', label: 'About', prefixes: ['aboutPage.', 'about.'] },
  { id: 'faq', label: 'FAQ', prefixes: ['faq.'] },
  { id: 'contact', label: 'Contact', prefixes: ['contact.'] },
  { id: 'footer', label: 'Footer', prefixes: ['footer.'] },
  { id: 'nav', label: 'Navigation', prefixes: ['nav.'] },
  { id: 'common', label: 'Buttons / Common', prefixes: ['common.'] },
];

const keysForGroup = (g) => Object.keys(translations.en).filter((k) => g.prefixes.some((p) => k.startsWith(p)));

const TABS = [
  { id: 'text', label: 'Page Text', icon: Type },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'about', label: 'About', icon: BookOpen },
];

const input = 'w-full h-11 px-3 rounded-2xl bg-mist border border-border/70 outline-none focus:border-cosmic';
const area = 'w-full min-h-[80px] p-3 rounded-2xl bg-mist border border-border/70 outline-none focus:border-cosmic font-body';

export default function SiteContentAdmin() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { faqItems: liveFaq, about: liveAbout } = useSiteContent();
  const [tab, setTab] = useState('text');

  // --- Page Text (i18n overrides) ---
  const [ov, setOv] = useState({ en: {}, ar: {} });
  const [group, setGroup] = useState(PAGE_GROUPS[0]);
  const [savingText, setSavingText] = useState(false);

  useEffect(() => {
    loadContentRecord('i18n_overrides').then((r) => setOv(r?.data ? { en: r.data.en || {}, ar: r.data.ar || {} } : { en: {}, ar: {} })).catch(() => {});
  }, []);

  const groupKeys = useMemo(() => keysForGroup(group), [group]);
  const setOvField = (lang, key, val) => setOv((o) => ({ ...o, [lang]: { ...o[lang], [key]: val } }));

  const saveText = async () => {
    setSavingText(true);
    try {
      await upsertContent('i18n_overrides', ov);
      toast({ title: t('settings.saved') });
    } catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setSavingText(false);
  };

  // --- FAQ items ---
  const [items, setItems] = useState([]);
  const [savingFaq, setSavingFaq] = useState(false);
  useEffect(() => { setItems((liveFaq && liveFaq.length ? liveFaq : DEFAULT_FAQ_ITEMS).map((it) => ({ ...it }))); }, [liveFaq]);
  const updateItem = (i, field, val) => setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const addItem = () => setItems((arr) => [...arr, { q_ar: '', q_en: '', a_ar: '', a_en: '' }]);
  const removeItem = (i) => setItems((arr) => arr.filter((_, idx) => idx !== i));
  const move = (i, dir) => setItems((arr) => {
    const j = i + dir; if (j < 0 || j >= arr.length) return arr;
    const next = [...arr]; [next[i], next[j]] = [next[j], next[i]]; return next;
  });
  const saveFaq = async () => {
    setSavingFaq(true);
    try { await upsertContent('faq_items', { items }); toast({ title: t('settings.saved') }); }
    catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setSavingFaq(false);
  };

  // --- About content ---
  const [about, setAbout] = useState(DEFAULT_ABOUT);
  const [savingAbout, setSavingAbout] = useState(false);
  useEffect(() => { setAbout({ ...DEFAULT_ABOUT, ...(liveAbout || {}) }); }, [liveAbout]);
  const setAboutField = (k, v) => setAbout((a) => ({ ...a, [k]: v }));
  const saveAbout = async () => {
    setSavingAbout(true);
    try { await upsertContent('about', about); toast({ title: t('settings.saved') }); }
    catch (e) { toast({ title: e.message, variant: 'destructive' }); }
    setSavingAbout(false);
  };

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
            <div className="flex flex-wrap gap-2">
              {PAGE_GROUPS.map((g) => (
                <button key={g.id} onClick={() => setGroup(g)} className={`h-9 px-3 rounded-full text-xs font-heading font-bold transition-colors ${group.id === g.id ? 'bg-cosmic text-white' : 'bg-card border border-border/60 text-foreground/70'}`}>{g.label}</button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Edit the {group.label} page text. Leave a field empty to keep the original wording.</p>
            <div className="mt-4 space-y-4">
              {groupKeys.map((key) => (
                <div key={key} className="rounded-3xl bg-card border border-border/60 p-4">
                  <p className="text-xs font-mono text-muted-foreground mb-2">{key}</p>
                  <label className="text-xs font-heading font-bold text-cosmic">English</label>
                  <textarea value={ov.en[key] ?? translations.en[key] ?? ''} onChange={(e) => setOvField('en', key, e.target.value)} className={`mt-1 mb-3 ${area}`} />
                  <label className="text-xs font-heading font-bold text-cosmic">العربية</label>
                  <textarea value={ov.ar[key] ?? translations.ar[key] ?? ''} onChange={(e) => setOvField('ar', key, e.target.value)} className={`mt-1 ${area}`} dir="rtl" />
                </div>
              ))}
            </div>
            <StickySaveBar>
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
                      <input value={it.q_en} onChange={(e) => updateItem(i, 'q_en', e.target.value)} className={`mt-1 ${input}`} />
                    </div>
                    <div>
                      <label className="text-xs font-heading font-bold text-cosmic">Answer (AR)</label>
                      <textarea value={it.a_ar} onChange={(e) => updateItem(i, 'a_ar', e.target.value)} className={`mt-1 ${area}`} dir="rtl" />
                    </div>
                    <div>
                      <label className="text-xs font-heading font-bold text-cosmic">Answer (EN)</label>
                      <textarea value={it.a_en} onChange={(e) => updateItem(i, 'a_en', e.target.value)} className={`mt-1 ${area}`} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-4 squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-mist font-heading font-bold"><Plus className="w-5 h-5" /> Add question</button>
            <StickySaveBar>
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
                <div><label className="text-xs font-heading font-bold text-cosmic">Story label (EN)</label><input value={about.storyLabelEn || ''} onChange={(e) => setAboutField('storyLabelEn', e.target.value)} className={`mt-1 ${input}`} /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Story title (AR)</label><input value={about.storyTitleAr || ''} onChange={(e) => setAboutField('storyTitleAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Story title (EN)</label><input value={about.storyTitleEn || ''} onChange={(e) => setAboutField('storyTitleEn', e.target.value)} className={`mt-1 ${input}`} /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-heading font-bold text-cosmic">Story paragraphs (AR) — one per line</label><textarea value={(about.storyAr || []).join('\n')} onChange={(e) => setAboutField('storyAr', e.target.value.split('\n'))} className={`mt-1 ${area}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Story paragraphs (EN) — one per line</label><textarea value={(about.storyEn || []).join('\n')} onChange={(e) => setAboutField('storyEn', e.target.value.split('\n'))} className={`mt-1 ${area}`} /></div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-heading font-bold text-cosmic">Values label (AR)</label><input value={about.valuesLabelAr || ''} onChange={(e) => setAboutField('valuesLabelAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Values label (EN)</label><input value={about.valuesLabelEn || ''} onChange={(e) => setAboutField('valuesLabelEn', e.target.value)} className={`mt-1 ${input}`} /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Values title (AR)</label><input value={about.valuesTitleAr || ''} onChange={(e) => setAboutField('valuesTitleAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">Values title (EN)</label><input value={about.valuesTitleEn || ''} onChange={(e) => setAboutField('valuesTitleEn', e.target.value)} className={`mt-1 ${input}`} /></div>
              </div>
              {['Ar', 'En'].map((lng) => (
                <div key={lng}>
                  <label className="text-xs font-heading font-bold text-cosmic">Values ({lng})</label>
                  <div className="mt-1 space-y-2">
                    {(about[`values${lng}`] || []).map((v, i) => (
                      <div key={i} className="grid sm:grid-cols-2 gap-2">
                        <input value={v.title || ''} onChange={(e) => { const arr = [...about[`values${lng}`]]; arr[i] = { ...arr[i], title: e.target.value }; setAboutField(`values${lng}`, arr); }} className={input} placeholder="Title" dir={lng === 'Ar' ? 'rtl' : undefined} />
                        <input value={v.desc || ''} onChange={(e) => { const arr = [...about[`values${lng}`]]; arr[i] = { ...arr[i], desc: e.target.value }; setAboutField(`values${lng}`, arr); }} className={input} placeholder="Description" dir={lng === 'Ar' ? 'rtl' : undefined} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA title (AR)</label><input value={about.ctaTitleAr || ''} onChange={(e) => setAboutField('ctaTitleAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA title (EN)</label><input value={about.ctaTitleEn || ''} onChange={(e) => setAboutField('ctaTitleEn', e.target.value)} className={`mt-1 ${input}`} /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA description (AR)</label><input value={about.ctaDescAr || ''} onChange={(e) => setAboutField('ctaDescAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA description (EN)</label><input value={about.ctaDescEn || ''} onChange={(e) => setAboutField('ctaDescEn', e.target.value)} className={`mt-1 ${input}`} /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA button (AR)</label><input value={about.ctaBtnAr || ''} onChange={(e) => setAboutField('ctaBtnAr', e.target.value)} className={`mt-1 ${input}`} dir="rtl" /></div>
                <div><label className="text-xs font-heading font-bold text-cosmic">CTA button (EN)</label><input value={about.ctaBtnEn || ''} onChange={(e) => setAboutField('ctaBtnEn', e.target.value)} className={`mt-1 ${input}`} /></div>
              </div>
            </div>
            <StickySaveBar>
              <button onClick={saveAbout} disabled={savingAbout} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60">
                {savingAbout ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {t('settings.save')}
              </button>
            </StickySaveBar>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}