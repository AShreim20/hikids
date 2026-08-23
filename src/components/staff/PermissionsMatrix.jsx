import React from 'react';
import { Check } from 'lucide-react';
import { PERMISSION_GROUPS } from '@/lib/permissions';

export default function PermissionsMatrix({ value, onChange, disabled }) {
  const toggle = (perm) => {
    if (disabled) return;
    const has = value.includes(perm);
    onChange(has ? value.filter((p) => p !== perm) : [...value, perm]);
  };

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {PERMISSION_GROUPS.map((g) => (
        <div key={g.key} className="rounded-2xl bg-mist/60 p-4">
          <p className="font-heading font-bold text-sm">{g.label}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {g.perms.map((p) => {
              const on = value.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(p)}
                  className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium border transition-colors ${
                    on
                      ? 'bg-cosmic text-white border-cosmic'
                      : 'bg-card text-foreground/70 border-border hover:border-cosmic/50'
                  } disabled:opacity-60`}
                >
                  {on && <Check className="w-3 h-3" />}
                  {p.split('.').pop()}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}