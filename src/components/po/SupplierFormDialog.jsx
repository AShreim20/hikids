import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';
import FormInput from '@/components/admin/FormInput';

const EMPTY = { name: '', phone: '', email: '', address: '', contact_person: '', notes: '' };

export default function SupplierFormDialog({ open, onOpenChange, initial, onSaved }) {
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
  }, [open, initial]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.name) {
      toast({ title: ar ? 'الاسم مطلوب' : 'Name required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone || '',
        email: form.email || '',
        address: form.address || '',
        contact_person: form.contact_person || '',
        notes: form.notes || '',
      };
      let saved;
      if (initial?.id) saved = await base44.entities.Supplier.update(initial.id, payload);
      else saved = await base44.entities.Supplier.create(payload);
      toast({ title: ar ? 'تم الحفظ' : 'Saved' });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial?.id ? (ar ? 'تعديل مورّد' : 'Edit supplier') : (ar ? 'مورّد جديد' : 'New supplier')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
          <FormInput label={ar ? 'الاسم' : 'Name'} value={form.name || ''} onChange={(e) => set('name', e.target.value)} required className="sm:col-span-2" />
          <FormInput label={ar ? 'الهاتف' : 'Phone'} value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />
          <FormInput label={ar ? 'البريد الإلكتروني' : 'Email'} value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
          <FormInput label={ar ? 'جهة الاتصال' : 'Contact person'} value={form.contact_person || ''} onChange={(e) => set('contact_person', e.target.value)} />
          <FormInput label={ar ? 'العنوان' : 'Address'} value={form.address || ''} onChange={(e) => set('address', e.target.value)} />
          <FormInput label={ar ? 'ملاحظات' : 'Notes'} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} textarea className="sm:col-span-2" />
          <DialogFooter className="sm:col-span-2">
            <button type="button" onClick={() => onOpenChange(false)} className="squish h-11 px-5 rounded-full bg-mist font-heading font-bold">{t('admin.cancel')}</button>
            <button type="submit" disabled={saving} className="squish h-11 px-5 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center gap-2 disabled:opacity-60">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t('admin.save')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}