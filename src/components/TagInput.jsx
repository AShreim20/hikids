import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

export default function TagInput({ value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setDraft('');
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
        />
        <button type="button" onClick={add} className="grid place-items-center w-12 h-12 rounded-2xl bg-cosmic text-white shrink-0">
          <Plus className="w-5 h-5" />
        </button>
      </div>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 ps-3 pe-1.5 py-1.5 rounded-full bg-cosmic/10 text-cosmic text-sm font-medium">
              {tag}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== tag))} className="grid place-items-center w-5 h-5 rounded-full hover:bg-cosmic/20" aria-label="Remove tag">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}