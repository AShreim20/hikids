import React from 'react';

const LOGO_URL =
  'https://media.base44.com/images/public/6a75c91fa5dfe02359c5f127/7971fd204_HiKidsLogo.webp';

export default function Logo({ className = 'h-10 w-auto' }) {
  return <img src={LOGO_URL} alt="HiKids" className={className} />;
}