import React, { useEffect, useState } from 'react';
import { Loader2, CreditCard } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { getSetting, setSetting } from '@/lib/storeSettings';

// Admin-controlled toggle that enables/disables Visa as a payment option at
// checkout. Stored in the Setting entity as `visa_payment_enabled` (1/0).
export default function VisaPaymentToggle() {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const ar = lang === 'ar';
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetting('visa_payment_enabled', 1)
      .then((v) => { setEnabled(!!v); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    const ok = await setSetting('visa_payment_enabled', next ? 1 : 0, 'Visa payment enabled (1/0)');
    setSaving(false);
    toast({
      title: ok ? (ar ? 'تم الحفظ' : 'Saved') : (ar ? 'حدث خطأ' : 'Error'),
      variant: ok ? 'default' : 'destructive',
    });
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 px-4 py-3">
      <div className="grid place-items-center w-10 h-10 rounded-xl bg-[#1A1F71] text-white shrink-0">
        <CreditCard className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-bold text-sm">{ar ? 'دفع فيزا' : 'Visa Payment'}</p>
        <p className="text-xs text-muted-foreground truncate">
          {ar ? 'إظهار خيار فيزا عند الدفع' : 'Show Visa as a checkout payment option'}
        </p>
      </div>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      ) : (
        <Switch checked={enabled} onCheckedChange={toggle} disabled={saving} aria-label="Visa payment" />
      )}
    </div>
  );
}