import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trash2, Loader2, Moon, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function SettingsDialog({ open, onOpenChange }) {
  const { user, logout } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const reset = () => {
    setConfirming(false);
    setBusy(false);
    setError(null);
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await base44.functions.invoke('deleteAccount', {});
      onOpenChange(false);
      logout();
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to delete account');
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl">Settings</DialogTitle>
          <DialogDescription>
            {user ? `Signed in as ${user.email}` : 'Manage your account and preferences.'}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-mist p-4">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-cosmic" />
              <p className="font-heading font-bold">Theme</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              HiKids follows your system light/dark preference automatically.
            </p>
          </div>

          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="font-heading font-bold text-destructive">Delete account</p>
            <p className="text-sm text-muted-foreground mt-1">
              Permanently remove your account and sign out. This cannot be undone.
            </p>
            {!confirming ? (
              <button
                onClick={() => setConfirming(true)}
                className="mt-3 squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-destructive text-white font-heading font-bold text-sm hover:opacity-90"
              >
                <Trash2 className="w-4 h-4" /> Delete account
              </button>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-medium">Are you sure? This is permanent.</p>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={busy}
                    className="squish inline-flex items-center gap-2 h-11 px-5 rounded-full bg-destructive text-white font-heading font-bold text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {busy ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    onClick={() => { setConfirming(false); setError(null); }}
                    disabled={busy}
                    className="squish h-11 px-5 rounded-full bg-mist font-heading font-bold text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}