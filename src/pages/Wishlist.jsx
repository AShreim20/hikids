import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { Image } from '@/components/ui/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';

export default function Wishlist() {
  const { items, remove } = useWishlist();
  const { addItem } = useCart();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:py-20">
        <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">Saved for later</p>
        <h1 className="mt-2 font-display font-semibold text-4xl md:text-6xl leading-tight">Your wishlist</h1>
        <p className="mt-3 text-muted-foreground max-w-lg">
          {items.length} item(s) you've set your heart on.
        </p>

        {items.length === 0 ? (
          <div className="mt-16 rounded-[2.5rem] border border-dashed border-border bg-mist/50 p-12 md:p-20 text-center">
            <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-white shadow-sm">
              <Heart className="w-7 h-7 text-accent" />
            </div>
            <h2 className="mt-6 font-heading font-extrabold text-2xl">No favorites yet</h2>
            <p className="mt-2 text-muted-foreground">Tap the heart on any toy to save it here for later.</p>
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold hover:bg-primary transition-colors"
            >
              Explore the collection <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {items.map((p) => (
              <div
                key={p.id}
                className="group rounded-[2rem] bg-card border border-border/60 overflow-hidden flex flex-col transition-all duration-500 hover:-translate-y-1.5 hover:shadow-[0_30px_70px_-28px_rgba(26,26,30,0.35)]"
              >
                <Link to={`/product/${p.id}`} className="relative aspect-square overflow-hidden bg-mist">
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fittingType="fill"
                    className="w-full h-full transition-transform duration-700 group-hover:scale-105"
                  />
                </Link>
                <div className="p-5 flex flex-col flex-1">
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                  <Link
                    to={`/product/${p.id}`}
                    className="mt-1 font-display font-semibold text-lg leading-tight hover:text-cosmic line-clamp-2"
                  >
                    {p.name}
                  </Link>
                  <p className="mt-2 font-heading font-extrabold text-xl text-cosmic">
                    ${(p.price || 0).toFixed(2)}
                  </p>
                  <div className="mt-auto pt-4 flex items-center gap-2">
                    <button
                      onClick={() => addItem(p, 1)}
                      className="squish flex-1 h-11 rounded-full bg-cosmic text-white font-heading font-bold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-primary transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4" /> Add
                    </button>
                    <button
                      onClick={() => remove(p.id)}
                      className="squish grid place-items-center w-11 h-11 rounded-full bg-mist text-foreground hover:bg-destructive hover:text-white transition-colors"
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}