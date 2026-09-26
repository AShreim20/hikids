import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Lock, Eye } from 'lucide-react';
import { db } from '@/api/entities';
import { useAdminLoadGuard } from '@/hooks/useAdminLoadGuard';
import AdminLoadFailed from '@/components/admin/AdminLoadFailed';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import ProductFormFields, { CATEGORIES } from '@/components/admin/ProductFormFields';
import { ageRangeToIds } from '@/lib/ages';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/admin/UnsavedChangesDialog';
import { snapshotsEqual } from '@/lib/formDirty';
import { saveDraft, loadDraft, clearDraft, savePreviewSnapshot } from '@/lib/sessionDraft';
import { cleanFeatureList } from '@/lib/features';

const EMPTY = {
  name: '', name_en: '', description: '', description_en: '', price: '', sale_price: '', unit_cost: '', barcode: '', product_code: '', category: CATEGORIES[0], age_range: '', ages: [],
  // Primary Category is left unset for a new product — the admin picks it
  // explicitly rather than a category being silently defaulted; Publish
  // validation requires one before a product can go live (see performSave).
  // Additional Categories are optional and never include the primary.
  primary_category_id: null,
  category_ids: [],
  gender: null,
  features_ar: [], features_en: [],
  image_url: '', images: [], video_url: '', material: '', rating: '', stock: '',
  featured: false, loyalty_exempt: false, tags: [], options: [], variants: [],
  // Only meaningful once hydrated from the DB — a never-saved product has no
  // status yet, its first Save picks one via whichever button is pressed.
  status: null,
};

// Maps a DB product row to the form's own shape — the exact same mapping is
// used to (a) hydrate the form and (b) rebuild the "last known saved" baseline
// after a save, so dirty-checking always compares like with like.
function productToForm(p) {
  return {
    name: p.name || '',
    name_en: p.name_en || '',
    description: p.description || '',
    description_en: p.description_en || '',
    price: p.price ?? '',
    sale_price: p.sale_price ?? '',
    unit_cost: p.unit_cost ?? '',
    barcode: p.barcode || '',
    product_code: p.product_code || '',
    category: p.category || CATEGORIES[0],
    primary_category_id: p.primary_category_id || null,
    category_ids: Array.isArray(p.category_ids) ? p.category_ids : [],
    age_range: p.age_range || '',
    ages: Array.isArray(p.ages) && p.ages.length ? p.ages : ageRangeToIds(p.age_range),
    // 'male' | 'female' | 'both' | null (not yet classified) — this was the
    // exact bug: this mapping never read p.gender at all, so the field came
    // back from every reload/refetch as undefined regardless of what was
    // saved, which looked exactly like "the selection got cleared".
    gender: p.gender === 'male' || p.gender === 'female' || p.gender === 'both' ? p.gender : null,
    // Old products predate this column and simply come back as [] — no
    // special-casing needed, the DB default already handles it.
    features_ar: Array.isArray(p.features_ar) ? p.features_ar : [],
    features_en: Array.isArray(p.features_en) ? p.features_en : [],
    image_url: p.image_url || '',
    images: Array.isArray(p.images) ? p.images : [],
    video_url: p.video_url || '',
    material: p.material || '',
    rating: p.rating ?? '',
    stock: p.stock ?? '',
    featured: !!p.featured,
    loyalty_exempt: !!p.loyalty_exempt,
    tags: Array.isArray(p.tags) ? p.tags : [],
    options: Array.isArray(p.options) ? p.options : [],
    variants: Array.isArray(p.variants) ? p.variants : [],
    status: p.status === 'draft' ? 'draft' : 'published',
  };
}

export default function ProductEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  // The draft key ('new' for a not-yet-created product, otherwise the id) —
  // stable draftId lets a new product's draft survive the /new -> /:id URL
  // change that happens right after its first save fails part-way, without
  // ever being reachable from a genuinely different product's edit page.
  // Also doubles as the Preview snapshot key (see preview() below) and the
  // matching /admin/product/:id/preview route.
  const draftId = isNew ? 'new' : id;
  // Pending "you have an older draft than what's on the server" choice —
  // null when there's nothing to ask about.
  const [staleDraft, setStaleDraft] = useState(null);

  // `baselineRef` is the last known saved-to-DB (or freshly loaded) form
  // snapshot. Dirty = form no longer matches it. It's a ref, not state,
  // because updating it must never itself trigger a re-render or re-run any
  // effect — only real edits to `form` should do that.
  const baselineRef = useRef(EMPTY);
  // Guards against re-hydrating the same product twice — e.g. if this effect
  // were ever re-triggered for a reason unrelated to actually switching
  // products, it must not silently clobber whatever the user has typed.
  // (Root cause of the reported bug: the fetch effect used to also depend on
  // the whole `user` object from AuthContext, which gets a *new* object
  // reference every time Supabase's background token refresh fires — which
  // happens periodically and on regaining tab focus, independent of any
  // actual permission change. That made this effect re-run — and blindly
  // overwrite the form with fresh server data — just from switching tabs and
  // coming back. Fixed at the source in AuthContext (stable user reference)
  // and, as a second, independent safety net, this effect no longer depends
  // on `user` at all and never re-hydrates once a given id has loaded.)
  const hydratedIdRef = useRef(null);
  // The server row's own updated_date at hydration time — stamped onto every
  // autosaved draft so a later reload can tell a same-version draft (safe to
  // restore silently) from a stale one (someone saved again since).
  const serverUpdatedDateRef = useRef(null);

  const { failure, guard } = useAdminLoadGuard();

  useEffect(() => {
    if (isNew) {
      hydratedIdRef.current = 'new';
      baselineRef.current = EMPTY;
      serverUpdatedDateRef.current = null;
      const draft = loadDraft('product', 'new');
      if (draft?.data) setForm({ ...EMPTY, ...draft.data });
      setLoading(false);
      return;
    }
    if (hydratedIdRef.current === id) return;
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  // A failed load must not leave the editor on blank defaults (saving would
  // overwrite the real product), so the product itself goes through the guard.
  const loadProduct = () => {
    setLoading(true);
    guard(() => db.Product.get(id))
      .then((p) => {
        if (p === undefined) return;
        try {
        const serverForm = productToForm(p);
        hydratedIdRef.current = id;
        baselineRef.current = serverForm;
        serverUpdatedDateRef.current = p.updated_date;
        const draft = loadDraft('product', id);
        if (draft?.data) {
          if (draft.baseline === p.updated_date) {
            // Same server version the draft was taken from — safe to
            // restore silently (this is exactly the "accidental remount"
            // case draft protection exists for).
            setForm({ ...serverForm, ...draft.data });
          } else {
            // The product was saved again (by anyone) since this draft was
            // taken — don't let a stale draft silently hide newer data.
            setForm(serverForm);
            setStaleDraft({ draft, serverForm });
          }
        } else {
          setForm(serverForm);
        }
        } catch {
          toast({ title: lang === 'ar' ? 'المنتج غير موجود' : 'Product not found', variant: 'destructive' });
        }
      })
      .finally(() => setLoading(false));
  };

  const isDirty = useMemo(() => !snapshotsEqual(form, baselineRef.current), [form]);

  // Debounced draft autosave — a safety net under the dirty-form guard below,
  // not a replacement for it: if this component is ever remounted while
  // dirty (e.g. a future refactor reintroduces a remount trigger), the draft
  // lets the user's edits survive that too. Never touches the database.
  useEffect(() => {
    if (loading || !isDirty) return;
    const t = setTimeout(() => saveDraft('product', draftId, form, serverUpdatedDateRef.current), 400);
    return () => clearTimeout(t);
  }, [form, isDirty, loading, draftId]);

  const { confirmOpen, stay, leave } = useUnsavedChangesGuard(isDirty, () => clearDraft('product', draftId));

  if (failure) return <AdminLoadFailed failure={failure} onRetry={loadProduct} />;

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('admin.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('admin.deniedDesc')}</p>
        </div>
        <Footer />
      </div>
    );
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const discardDraft = () => {
    setStaleDraft(null);
    clearDraft('product', draftId);
  };
  const restoreStaleDraft = () => {
    if (!staleDraft) return;
    setForm({ ...staleDraft.serverForm, ...staleDraft.draft.data });
    setStaleDraft(null);
  };

  const cancel = () => {
    // Cancel is an explicit, deliberate discard — not a navigation the guard
    // should intercept (see useUnsavedChangesGuard's doc comment).
    clearDraft('product', draftId);
    navigate('/admin');
  };

  // Opens the real Product Detail page, in a brand-new tab, showing the
  // CURRENT in-memory form — including anything typed but not yet saved.
  // A new tab (rather than navigating this one away) structurally can't
  // unmount this edit form or lose its state; the snapshot travels via
  // sessionStorage, which a same-origin window.open() tab shares with its
  // opener. Already-uploaded images are real URLs the moment they're picked
  // (ProductImageManager uploads immediately — see its own comment), so they
  // just work here with no object-URL handling needed.
  const preview = () => {
    const snapshot = {
      id: isNew ? null : id,
      name: form.name,
      name_en: form.name_en || null,
      description: form.description,
      description_en: form.description_en || null,
      price: Number(form.price) || 0,
      sale_price: form.sale_price ? Number(form.sale_price) : null,
      category: form.category,
      primary_category_id: form.primary_category_id || null,
      category_ids: (form.category_ids || []).filter((id) => id !== form.primary_category_id),
      age_range: form.age_range,
      ages: form.ages || [],
      gender: form.gender === 'male' || form.gender === 'female' || form.gender === 'both' ? form.gender : null,
      features_ar: form.features_ar || [],
      features_en: form.features_en || [],
      image_url: form.image_url || '',
      images: form.images || [],
      video_url: form.video_url || '',
      material: form.material || '',
      rating: form.rating ? Number(form.rating) : 0,
      stock: form.stock !== '' ? Number(form.stock) : 0,
      tags: form.tags || [],
      options: (form.options || []).filter((o) => o.name),
      variants: form.variants || [],
      status: form.status || 'draft',
    };
    savePreviewSnapshot(draftId, snapshot);
    window.open(`/admin/product/${draftId}/preview`, '_blank', 'noopener');
  };

  // Shared save core for every "write to the database" action below.
  // `requireFull` runs the same completeness checks a publish always needs;
  // skipped for Save as Draft, which only insists on a name (everything else
  // — price, category, image, description — is allowed to be filled in
  // later, and the DB itself tolerates it: price defaults to 0, image_url is
  // nullable, category always has a real default from the form itself).
  const performSave = async (status, { requireFull, setPublishedAt }) => {
    if (requireFull) {
      if (!form.name || !form.price || !form.category || !form.primary_category_id || !form.image_url) {
        toast({ title: t('admin.required'), variant: 'destructive' });
        return;
      }
      if (!form.description || !form.description.trim()) {
        toast({ title: lang === 'ar' ? 'الوصف (عربي) مطلوب' : 'Arabic description required', variant: 'destructive' });
        return;
      }
    } else if (!form.name || !form.name.trim()) {
      toast({ title: lang === 'ar' ? 'الاسم مطلوب حتى لحفظ مسودة' : 'A name is required, even for a draft', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const barcodeValue = (form.barcode || '').trim();
    if (barcodeValue) {
      try {
        const res = await invokeFunction('validateBarcode', { barcode: barcodeValue, exclude_id: isNew ? '' : id });
        if (res && res.unique === false) {
          toast({ title: t('admin.barcodeInUse'), description: res.conflict?.name || '', variant: 'destructive' });
          setSaving(false);
          return;
        }
      } catch (e) {
        toast({ title: lang === 'ar' ? 'تعذّر التحقق من الباركود' : 'Could not verify barcode', variant: 'destructive' });
        setSaving(false);
        return;
      }
    }
    // Product Code is the stable business identifier (see productExportFields.js
    // / the Excel export) — required once a product exists (a brand-new one may
    // leave it blank and get one auto-generated server-side on insert). Changing
    // an already-assigned code is allowed but confirmed explicitly, since Excel
    // files/integrations may already reference the old value.
    const productCodeValue = (form.product_code || '').trim();
    if (!isNew) {
      if (!productCodeValue) {
        toast({ title: t('admin.productCodeRequired'), variant: 'destructive' });
        setSaving(false);
        return;
      }
      const originalCode = (baselineRef.current.product_code || '').trim();
      if (originalCode && productCodeValue.toLowerCase() !== originalCode.toLowerCase() && !window.confirm(t('admin.productCodeChangeWarning'))) {
        setSaving(false);
        return;
      }
    }
    const payload = {
      name: form.name,
      name_en: (form.name_en || '').trim() || null,
      description: form.description,
      description_en: (form.description_en || '').trim() || null,
      price: Number(form.price) || 0,
      sale_price: form.sale_price ? Number(form.sale_price) : null,
      unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
      barcode: form.barcode || '',
      // null (not '') for a new product with no code typed — sanitize()
      // would turn '' into null anyway, but explicit here since that null is
      // exactly what tells the DB trigger to auto-generate one on insert.
      product_code: productCodeValue || null,
      // `category` stays the denormalized primary-category NAME (every
      // existing reader — cards, ProductDetail, search, category discounts —
      // keeps working unchanged); primary_category_id/category_ids are the
      // real, stable-id multi-category relationships.
      category: form.category,
      primary_category_id: form.primary_category_id || null,
      category_ids: (form.category_ids || []).filter((id) => id !== form.primary_category_id),
      age_range: form.age_range,
      ages: form.ages || [],
      // The other half of the same bug as above: this payload never
      // included gender at all, so Save silently discarded whatever was
      // selected. Normalized defensively — only these three values are
      // ever written; anything else (including '', undefined, a stray
      // legacy tag) becomes null rather than being guessed or coerced.
      gender: form.gender === 'male' || form.gender === 'female' || form.gender === 'both' ? form.gender : null,
      // Trims whitespace and drops empty rows (e.g. an "+ Add feature" row
      // the admin never filled in) while preserving the chosen order.
      features_ar: cleanFeatureList(form.features_ar),
      features_en: cleanFeatureList(form.features_en),
      image_url: form.image_url,
      images: form.images || [],
      video_url: form.video_url || null,
      material: form.material,
      rating: form.rating ? Number(form.rating) : 0,
      stock: form.stock !== '' ? Number(form.stock) : 0,
      featured: !!form.featured,
      loyalty_exempt: !!form.loyalty_exempt,
      tags: form.tags || [],
      options: (form.options || []).filter((o) => o.name),
      variants: (form.variants || []).map((v) => ({
        key: v.key,
        attributes: v.attributes,
        price: v.price === '' || v.price == null ? null : Number(v.price),
        cost: v.cost === '' || v.cost == null ? null : Number(v.cost),
        compare_price: v.compare_price === '' || v.compare_price == null ? null : Number(v.compare_price),
        stock: Number(v.stock) || 0,
        sku: v.sku || '',
        barcode: v.barcode || '',
        weight: v.weight === '' || v.weight == null ? null : Number(v.weight),
        active: v.active !== false,
      })),
      status,
      ...(setPublishedAt ? { published_at: new Date().toISOString() } : {}),
    };
    try {
      if (isNew) {
        const created = await db.Product.create(payload);
        await invokeFunction('logAuditActivity', {
          action: 'product.created', target_type: 'product', target_id: created?.id || '',
          details: `Created product "${payload.name}" (${status})`,
        });
        toast({ title: status === 'draft' ? (lang === 'ar' ? 'حُفظت المسودة' : 'Draft saved') : (lang === 'ar' ? 'نُشر المنتج' : 'Product published') });
      } else {
        await db.Product.update(id, payload);
        await invokeFunction('logAuditActivity', {
          action: 'product.updated', target_type: 'product', target_id: id,
          details: `Updated product "${payload.name}" (${status})`,
        });
        toast({ title: status === 'draft' ? (lang === 'ar' ? 'حُفظت المسودة' : 'Draft saved') : (lang === 'ar' ? 'تم التحديث' : 'Product updated') });
      }
      // Baseline now matches what's saved, so the form is clean — no
      // unsaved-changes prompt fires on the navigate() below.
      baselineRef.current = JSON.parse(JSON.stringify(form));
      clearDraft('product', draftId);
      navigate('/admin');
    } catch (err) {
      if (err.code === '23505' && String(err.message || '').includes('product_code')) {
        toast({ title: t('admin.productCodeInUse'), variant: 'destructive' });
      } else {
        toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  const saveAsDraft = (e) => { e.preventDefault(); performSave('draft', { requireFull: false, setPublishedAt: false }); };
  const publishProduct = (e) => { e.preventDefault(); performSave('published', { requireFull: true, setPublishedAt: true }); };
  const saveChanges = (e) => { e.preventDefault(); performSave('published', { requireFull: true, setPublishedAt: false }); };

  const doUnpublish = async () => {
    setUnpublishing(true);
    try {
      await db.Product.update(id, { status: 'draft' });
      await invokeFunction('logAuditActivity', {
        action: 'product.unpublished', target_type: 'product', target_id: id,
        details: `Unpublished product "${form.name}"`,
      });
      // A pure status flip — doesn't touch (or discard) any other unsaved
      // edit the admin might have in progress, and both form + baseline move
      // together so this doesn't itself register as a new unsaved change.
      setForm((f) => ({ ...f, status: 'draft' }));
      baselineRef.current = { ...baselineRef.current, status: 'draft' };
      toast({ title: lang === 'ar' ? 'تم إلغاء نشر المنتج' : 'Product unpublished' });
      setUnpublishOpen(false);
    } catch (err) {
      toast({ title: lang === 'ar' ? 'خطأ' : 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUnpublishing(false);
    }
  };

  const isPublished = !isNew && form.status === 'published';

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> {t('admin.title')}
        </Link>
        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <h1 className="font-heading font-extrabold text-3xl md:text-4xl">
            {isNew ? t('admin.new') : t('admin.edit')}
          </h1>
          {!isNew && (
            <span className={`px-3 py-1 rounded-full text-xs font-heading font-bold ${isPublished ? 'bg-cosmic/10 text-cosmic' : 'bg-accent/15 text-accent'}`}>
              {isPublished ? t('admin.statusPublished') : t('admin.statusDraft')}
            </span>
          )}
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cosmic" /></div>
        ) : (
          <form onSubmit={isPublished ? saveChanges : publishProduct} className="mt-8 rounded-3xl bg-card border border-border/60 p-5 sm:p-8">
            <ProductFormFields form={form} set={set} isNew={isNew} />

            {/* Responsive action row: wraps into a clean 2-up grid on
                narrow screens instead of a line of tiny buttons, and the
                primary action (Save Changes / Publish) is always first and
                visually distinct (cosmic). */}
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="squish flex-1 min-w-[45%] h-12 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? t('admin.saving') : isPublished ? t('admin.saveChanges') : t('admin.publish')}
              </button>
              <button
                type="button"
                onClick={preview}
                className="squish flex-1 min-w-[45%] h-12 rounded-full bg-mist font-heading font-bold inline-flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" /> {t('admin.preview')}
              </button>
              {isPublished ? (
                <button
                  type="button"
                  onClick={() => setUnpublishOpen(true)}
                  disabled={saving}
                  className="squish flex-1 min-w-[45%] h-12 rounded-full bg-accent/15 text-accent hover:bg-accent hover:text-white transition-colors font-heading font-bold disabled:opacity-60"
                >
                  {t('admin.unpublish')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveAsDraft}
                  disabled={saving}
                  className="squish flex-1 min-w-[45%] h-12 rounded-full bg-mist font-heading font-bold disabled:opacity-60"
                >
                  {t('admin.saveDraft')}
                </button>
              )}
              <button type="button" onClick={cancel} className="squish h-12 px-6 rounded-full bg-mist font-heading font-bold">
                {t('admin.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
      <Footer />

      <UnsavedChangesDialog open={confirmOpen} onStay={stay} onLeave={leave} />

      {staleDraft && (
        <div className="fixed inset-0 z-[100] grid place-items-center p-5">
          <div className="absolute inset-0 bg-black/40" onClick={discardDraft} />
          <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
            <h2 className="font-heading font-extrabold text-2xl">{t('admin.draftRestoredTitle')}</h2>
            <p className="mt-3 text-muted-foreground">{t('admin.draftRestoredBody')}</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={discardDraft} className="flex-1 h-12 rounded-full bg-mist font-heading font-bold">
                {t('admin.draftDiscard')}
              </button>
              <button type="button" onClick={restoreStaleDraft} className="flex-1 h-12 rounded-full bg-cosmic text-white font-heading font-bold">
                {t('admin.draftRestore')}
              </button>
            </div>
          </div>
        </div>
      )}

      {unpublishOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center p-5">
          <div className="absolute inset-0 bg-black/40" onClick={() => !unpublishing && setUnpublishOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
            <h2 className="font-heading font-extrabold text-2xl">{t('admin.confirmUnpublishTitle')}</h2>
            <p className="mt-3 text-muted-foreground">{t('admin.confirmUnpublishBody')}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setUnpublishOpen(false)}
                disabled={unpublishing}
                className="flex-1 h-12 rounded-full bg-mist font-heading font-bold disabled:opacity-60"
              >
                {t('admin.cancel')}
              </button>
              <button
                type="button"
                onClick={doUnpublish}
                disabled={unpublishing}
                className="flex-1 h-12 rounded-full bg-accent text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {unpublishing && <Loader2 className="w-4 h-4 animate-spin" />} {t('admin.unpublish')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
