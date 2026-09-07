import React from 'react';
import { useLanguage } from '@/context/LanguageContext';

// Bilingual "leave without saving?" confirmation, rendered by any admin edit
// page via useUnsavedChangesGuard(). Only ever shown for an actual attempt to
// navigate away with unsaved changes — never for tab-switching, minimizing,
// or losing window focus.
export default function UnsavedChangesDialog({ open, onStay, onLeave }) {
  const { t } = useLanguage();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-5">
      <div className="absolute inset-0 bg-black/40" onClick={onStay} />
      <div className="relative w-full max-w-md rounded-3xl bg-card p-6 shadow-2xl">
        <h2 className="font-heading font-extrabold text-2xl">{t('admin.unsavedChangesTitle')}</h2>
        <p className="mt-3 text-muted-foreground">{t('admin.unsavedChangesBody')}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onStay}
            className="flex-1 h-12 rounded-full bg-mist font-heading font-bold"
            autoFocus
          >
            {t('admin.stay')}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="flex-1 h-12 rounded-full bg-destructive text-white font-heading font-bold"
          >
            {t('admin.leaveWithoutSaving')}
          </button>
        </div>
      </div>
    </div>
  );
}
