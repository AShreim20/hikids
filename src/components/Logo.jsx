import React from 'react';

const LOGO_URL =
'https://media.base44.com/images/public/6a75c91fa5dfe02359c5f127/d7ed46244_1000016311-removebg-preview.png';

export default function Logo({ className = 'h-10 w-auto' }) {
  return <img src="https://media.base44.com/images/public/6a75c91fa5dfe02359c5f127/d7ed46244_1000016311-removebg-preview.png" alt="HiKids" className={className} />;
}