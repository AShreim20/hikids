import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, ShieldCheck, Leaf, Truck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductExplorer from '@/components/ProductExplorer';

const categories = [
  { name: 'Build & Create', desc: 'Engineers of tomorrow' },
  { name: 'Plush & Soft', desc: 'Friends for life' },
  { name: 'Vehicles & Motion', desc: 'Wheels & wonder' },
  { name: 'Early Years', desc: 'First discoveries' },
  { name: 'Pretend Play', desc: 'Stories unfold' },
  { name: 'Arts & Crafts', desc: 'Invitations to make' },
];

const HERO_IMG =
  'https://media.base44.com/images/public/6a75c91fa5dfe02359c5f127/894c29025_generated_0c6a0938.png';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Product.list('-updated_date', 50)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-10 md:pt-20 pb-24 md:pb-40">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="float-in">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-mist text-foreground/70 text-xs font-medium tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5 text-accent" /> A Gallery of Wonder
              </span>
              <h1 className="mt-6 font-heading font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-[5.2rem] leading-[1.02] tracking-tight text-balance">
                Toys worth<br />growing into.
              </h1>
              <p className="mt-7 text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">
                HiKids is a sanctuary of imagination — premium, sustainably made toys
                curated as masterpieces of childhood development. Order online and
                pay by card or reserve and pay on arrival.
              </p>
              <div className="mt-9 flex flex-wrap gap-4">
                <a
                  href="#explore"
                  className="squish inline-flex items-center gap-2 h-14 px-8 rounded-full bg-cosmic text-white font-heading font-bold shadow-lg shadow-cosmic/30 hover:bg-primary transition-colors"
                >
                  Explore the collection <ArrowRight className="w-5 h-5" />
                </a>
                <a
                  href="#categories"
                  className="squish inline-flex items-center gap-2 h-14 px-8 rounded-full bg-mist text-foreground font-heading font-bold hover:bg-accent hover:text-white transition-colors"
                >
                  Worlds of Play
                </a>
              </div>
            </div>

            <div className="relative float-in">
              <div className="relative aspect-square rounded-[3rem] overflow-hidden bg-mist shadow-[0_40px_80px_-30px_rgba(26,26,30,0.35)]">
                <Image
                  src={HERO_IMG}
                  alt="Modular wooden rocket"
                  fittingType="fill"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 hidden sm:block bg-white rounded-3xl px-6 py-4 shadow-xl">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Featured</p>
                <p className="font-heading font-bold text-lg">Modular Rocket</p>
                <p className="text-cosmic font-extrabold">$64.00</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Promise strip */}
      <section id="promise" className="border-y border-border/60 bg-mist/50">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid sm:grid-cols-3 gap-8">
          {[
            { icon: Leaf, title: 'Sustainably made', desc: 'Sourced wood & safe materials' },
            { icon: ShieldCheck, title: 'Pay your way', desc: 'Card online or cash on delivery' },
            { icon: Truck, title: 'Careful delivery', desc: 'Wrapped like a gift, every time' },
          ].map((p) => (
            <div key={p.title} className="flex items-center gap-4">
              <div className="grid place-items-center w-12 h-12 rounded-2xl bg-white shadow-sm">
                <p.icon className="w-6 h-6 text-cosmic" />
              </div>
              <div>
                <p className="font-heading font-bold">{p.title}</p>
                <p className="text-sm text-muted-foreground">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section id="categories" className="max-w-7xl mx-auto px-5 sm:px-8 py-24 md:py-32">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">Curate by</p>
            <h2 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">Worlds of Play</h2>
          </div>
          <p className="text-muted-foreground max-w-sm">
            Filter by play archetype rather than just age — every toy has a world it belongs to.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {categories.map((c, i) => (
            <a
              key={c.name}
              href="#explore"
              className="group relative overflow-hidden rounded-3xl bg-mist p-6 md:p-8 aspect-[5/3] flex flex-col justify-end squish"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/0 to-cosmic/0 group-hover:from-accent/10 group-hover:to-cosmic/10 transition-all" />
              <h3 className="font-heading font-bold text-xl md:text-2xl">{c.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{c.desc}</p>
              <ArrowRight className="w-5 h-5 mt-3 text-cosmic opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </a>
          ))}
        </div>
      </section>

      {/* Product grid */}
      <ProductExplorer products={products} loading={loading} />

      {/* About */}
      <section id="about" className="max-w-7xl mx-auto px-5 sm:px-8 py-24 md:py-32">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div className="relative aspect-[4/3] rounded-[2.5rem] overflow-hidden bg-mist">
            <Image
              src="https://media.base44.com/images/public/6a75c91fa5dfe02359c5f127/df023ab5e_generated_37f54450.png"
              alt="Stacking Rainbow"
              fittingType="fill"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">Our promise</p>
            <h2 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl leading-tight text-balance">
              Slow toys, made to be treasured.
            </h2>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              We believe a toy should outlast the trend. HiKids partners with makers who
              craft in small batches from sustainable materials — each piece designed to
              be passed down, not thrown away. Every order is wrapped like a gift, and
              you can choose to pay securely online or in person on delivery.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <p className="font-heading font-extrabold text-3xl text-cosmic">200+</p>
                <p className="text-sm text-muted-foreground">Curated toys</p>
              </div>
              <div>
                <p className="font-heading font-extrabold text-3xl text-cosmic">100%</p>
                <p className="text-sm text-muted-foreground">Safe materials</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}