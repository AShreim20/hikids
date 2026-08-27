import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Save, Upload, Lock, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useSiteContent } from '@/context/SiteContentContext';
import { upsertSettings } from '@/lib/siteContent';
import { DEFAULT_SETTINGS } from '@/lib/siteDefaults';
import StickySaveBar from '@/components/admin/StickySaveBar';

const FIELDS = [
  { key: 'storeName', en: 'Store name', ar: 'اسم المتجر' },
  { key: 'logoUrl', en: 'Logo URL', ar: 'رابط الشعار', type: 'image' },
  { key: 'phone', en: 'Phone (display)', ar: 'الهاتف (للعرض)' },
  { key: 'phoneTel', en: 'Phone (tel link)', ar: 'هاتف (رابط الاتصال)' },
  { key: 'whatsapp', en: 'WhatsApp number (digits only)', ar: 'رقم واتساب (أرقام فقط)' },
  { key: 'email', en: 'Email', ar: 'البريد الإلكتروني' },
  { key: 'instagram', en: 'Instagram URL', ar: 'رابط إنستغرام' },
  { key: 'facebook', en: 'Facebook URL', ar: 'رابط فيسبوك' },
  { key: 'addressAr', en: 'Address (Arabic)', ar: 'العنوان (عربي)' },
  { key: 'addressEn', en: 'Address (English)', ar: 'العنوان (إنجليزي)' },
  { key: 'hoursAr', en: 'Response hours (Arabic)', ar: 'ساعات الرد (عربي)' },
  { key: 'hoursEn', en: 'Response hours (English)', ar: 'ساعات الرد (إنجليزي)' },
];

export default function SiteSettingsAdmin() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { settings } = useSiteContent();
  const { toast } = useToast();
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setForm({ ...DEFAULT_SETTINGS, ...settings });
  }, [settings]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const uploadLogo = async (file) => {
    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      set('logoUrl', res.file_url);
      toast({ title: 'Logo uploaded' });
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await upsertSettings(form);
      toast({ title: t('settings.saved') });
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
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
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← {t('pd.back')}</Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid place-items-center w-12 h-12 rounded-2xl bg-cosmic/10"><FileText className="w-6 h-6 text-cosmic" /></div>
          <div>
            <h1 className="font-heading font-extrabold text-3xl">Site Settings</h1>
            <p className="text-muted-foreground">Global store information shown across the website.</p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-card border border-border/60 p-6 space-y-4">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="text-sm font-heading font-bold">{f.en} <span className="text-muted-foreground font-normal">/ {f.ar}</span></label>
              {f.type === 'image' ? (
                <div className="mt-1 flex items-center gap-3">
                  <input value={form[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} className="flex-1 h-11 px-3 rounded-2xl bg-mist border border-border/70 outline-none" placeholder="https://..." />
                  <label className="squish inline-flex items-center gap-2 h-11 px-4 rounded-full bg-cosmic text-white font-heading font-bold cursor-pointer">
                    <Upload className="w-4 h-4" /> {uploading ? '…' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files[0]; if (file) uploadLogo(file); }} disabled={uploading} />
                  </label>
                </div>
              ) : (
                <input value={form[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} className="mt-1 w-full h-11 px-3 rounded-2xl bg-mist border border-border/70 outline-none" />
              )}
            </div>
          ))}
        </div>

        <StickySaveBar>
          <button onClick={save} disabled={saving} className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-60">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} {t('settings.save')}
          </button>
        </StickySaveBar>
      </div>
      <Footer />
    </div>
  );
}