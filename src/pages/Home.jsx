import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Recommendations from '@/components/Recommendations';
import HeroCarousel from '@/components/HeroCarousel';
import Newsletter from '@/components/Newsletter';
import WorldOfPlay from '@/components/home/WorldOfPlay';
import TrustBenefits from '@/components/home/TrustBenefits';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero carousel */}
      <HeroCarousel />

      {/* Trust / benefits strip */}
      <TrustBenefits />

      {/* Categories */}
      <WorldOfPlay />

      {/* Recommendations */}
      <Recommendations />

      <Newsletter />
      <Footer />
    </div>
  );
}
