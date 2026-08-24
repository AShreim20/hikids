import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';

// All loyalty rules live in the Setting entity as numeric keys (booleans as 0/1)
// so both the frontend and the backend read one source of truth.
const NUMBER_FIELDS = [
  { key: 'loyalty_earn_rate', labelKey: 'loyalty.earnRate', step: '0.1' },
  { key: 'loyalty_redeem_rate', labelKey: 'loyalty.redeemRate', step: '0.001' },
  { key: 'loyalty_min_order', labelKey: 'wallet.setMinOrder', step: '1' },
  { key: 'loyalty_min_redeem', labelKey: 'wallet.setMinRedeem', step: '1' },
  { key: 'loyalty_max_redeem_percent', labelKey: 'wallet.setMaxPercent', step: '1' },
  { key: 'loyalty_max_redeem_value', labelKey: 'wallet.setMaxValue', step: '1' },
  { key: 'loyalty_expiry_days', labelKey: 'wallet.setExpiry', step: '1' },
];

// When earned points become spendable.
const AWARD_STAGES = [
  { value: 0, labelKey: 'wallet.stagePlaced' },
  { value: 1, labelKey: 'wallet.stagePaid' },
  { value: 2, labelKey: 'wallet.stageConfirmed' },
  { value: 3, labelKey: 'wallet.stageDelivered' },
];

const TOGGLE_FIELDS = [
  { key: 'loyalty_earn_on_delivery_fee', labelKey: 'wallet.setEarnDelivery' },
  { key: 'loyalty_earn_on_discounted', labelKey: 'wallet.setEarnDiscounted' },
  { key: 'loyalty_redeem_with_discount', labelKey: 'wallet.setCombineDiscount' },
  { key: 'loyalty_redeem_delivery', labelKey: 'wallet.setRedeemDelivery' },
];

const DEFAULTS = {
  loyalty_earn_rate: 1,
  loyalty_redeem_rate: 0.1,
  loyalty_min_order: 0,
  loyalty_min_redeem: 0,
  loyalty_max_redeem_percent: 100,
  loyalty_max_redeem_value: 0,
  loyalty_expiry_days: 0,
  loyalty_award_stage: 3,
  loyalty_earn_on_delivery_fee: 0,
  loyalty_earn_on_discounted: 1,
  loyalty_redeem_with_discount: 1,
  loyalty_redeem_delivery: 0,
};

export default function LoyaltySettingsForm({ canEdit }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [settings, setSettings] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.entities.Setting.list()
      .then((rows) => {
        const map = { ...DEFAULTS };
        (rows || []).forEach((r) => { if (r.key in map) map[r.key] = r.value; });
        setSettings(map);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      for (const key of Object.keys(DEFAULTS)) {
        const value = Number(settings[key]) || 0;
        const existing = await base44.entities.Setting.filter({ key });
        if (existing.length) await base44.entities.Setting.update(existing[0].id, { value });
        else await base44.entities.Setting.create({ key, value });
      }
      await base44.functions.invoke('logAuditActivity', {
        action: 'loyalty.settings_updated',
        target_type: 'setting',
        details: JSON.stringify(settings),
      });
      toast({ title: t('loyalty.settingsSaved') });
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl bg-card border border-border/60 p-5 md:p-6">
      <h2 className="font-heading font-extrabold text-xl">{t('wallet.settingsTitle')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('wallet.settingsDesc')}</p>

      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {NUMBER_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-sm font-medium text-foreground/80">{t(f.labelKey)}</span>
            <input
              type="number"
              min="0"
              step={f.step}
              disabled={!canEdit}
              value={settings[f.key]}
              onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))}
              className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic disabled:opacity-60"
            />
          </label>
        ))}
      </div>

      <label className="mt-4 block max-w-sm">
        <span className="text-sm font-medium text-foreground/80">{t('wallet.setAwardStage')}</span>
        <select
          disabled={!canEdit}
          value={Number(settings.loyalty_award_stage)}
          onChange={(e) => setSettings((s) => ({ ...s, loyalty_award_stage: Number(e.target.value) }))}
          className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic disabled:opacity-60"
        >
          {AWARD_STAGES.map((s) => (
            <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted-foreground">{t('wallet.setAwardStageDesc')}</span>
      </label>

      <div className="mt-5 space-y-3">
        {TOGGLE_FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-3 text-sm cursor-pointer min-h-12">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={Number(settings[f.key]) === 1}
              onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.checked ? 1 : 0 }))}
              className="w-5 h-5 rounded"
            />
            {t(f.labelKey)}
          </label>
        ))}
      </div>

      {canEdit && (
        <button onClick={save} disabled={saving} className="mt-5 squish h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center gap-2 disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t('loyalty.saveSettings')}
        </button>
      )}
    </div>
  );
}