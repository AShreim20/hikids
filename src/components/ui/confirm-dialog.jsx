import React from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLanguage } from '@/context/LanguageContext';

// Small reusable replacement for window.confirm() on a destructive action —
// same controlled-state pattern MobileCartView.jsx already uses for its own
// per-item delete confirmation (pendingDelete + AlertDialog), just factored
// out so other pages don't each re-implement it. Controlled, not
// trigger-wrapped, so it drops into an existing per-row delete button without
// restructuring the row itself: the caller keeps its own "what am I about to
// delete/cancel" state and passes `open`.
export default function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, busy, destructive = true }) {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{ar ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(e) => { e.preventDefault(); if (!busy) onConfirm(); }}
            className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {ar ? 'تأكيد' : 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
