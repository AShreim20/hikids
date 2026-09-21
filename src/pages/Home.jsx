import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Recommendations from '@/components/Recommendations';
import HeroCarousel from '@/components/HeroCarousel';
import Newsletter from '@/components/Newsletter';
import WorldOfPlay from '@/components/home/WorldOfPlay';
import TrustBenefits from '@/components/home/TrustBenefits';
import HomepageDealsSection from '@/components/home/HomepageDealsSection';
import MobileHome from '@/components/home/MobileHome';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Home() {
  const isMobile = useIsMobile();
  // Phone (<768px): simplified homepage. Tablet/desktop render the original sections below, untouched.
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <MobileHome />
        <div className="pb-4"><Footer /></div>
      </div>
    );
  }

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

      {/* Deals & Offers — hides itself entirely when there are no active
          discounts right now. */}
      <HomepageDealsSection />

      <Newsletter />
      <Footer />
    </div>
  );
}
