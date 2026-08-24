import React from 'react';

export default function FormInput({ label, value, onChange, required, type = 'text', placeholder, textarea, className = '' }) {
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
          placeholder={placeholder}
          className="mt-1.5 w-full p-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 resize-none"
        />
      ) : (
        <input
          type={type}
          required={required}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40"
        />
      )}
    </label>
  );
}