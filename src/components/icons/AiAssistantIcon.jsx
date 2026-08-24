import React from 'react';

// Distinct AI assistant mark: a friendly bot head with a sparkle — deliberately
// unlike the WhatsApp bubble so the two services never look alike.
export default function AiAssistantIcon({ className = 'w-6 h-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <rect x="4" y="8" width="16" height="11" rx="4" />
      <path d="M12 5.5V8" />
      <circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9.2" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.8" cy="13" r="1.1" fill="currentColor" stroke="none" />
      <path d="M9.5 16.4h5" />
      <path d="M2.5 12.5v2M21.5 12.5v2" />
    </svg>
  );
}