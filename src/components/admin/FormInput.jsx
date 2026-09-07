import React from 'react';

import { isLtrInputType } from '@/lib/textDirection';

// `dir` forces the field's text direction. Pass "ltr" for English-only fields
// (barcodes, SKUs, URLs, the *_en translations) so they don't inherit the
// page's RTL direction in Arabic; email/number/url/tel types get it
// automatically. Leave it unset for Arabic fields.
export default function FormInput({ label, value, onChange, required, type = 'text', placeholder, textarea, className = '', readOnly, dir }) {
  const resolvedDir = dir ?? (isLtrInputType(type) ? 'ltr' : undefined);
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-foreground/80">
        {label}{required && <span className="text-accent"> *</span>}
      </span>
      {textarea ? (
        <textarea
          value={value}
          onChange={onChange}
          rows={3}
          readOnly={readOnly}
          placeholder={placeholder}
          dir={resolvedDir}
          className="mt-1.5 w-full p-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 resize-none"
        />
      ) : (
        <input
          type={type}
          required={required}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          placeholder={placeholder}
          dir={resolvedDir}
          className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
        />
      )}
    </label>
  );
}
