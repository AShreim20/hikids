import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Minus, Plus, ShoppingBag, ShieldCheck, Leaf, Star } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setLoading(true);
    base44.entities.Product.get(id)
      .then(setProduct)
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="w-8 h-8 border-4 border-mist border-t-cosmic rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-3xl mx-auto px-5 py-32 text-center">
          <h1 className="font-heading font-extrabold text-3xl">Toy not found</h1>
          <p className="mt-3 text-muted-foreground">This piece may have wandered off.</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            <ArrowLeft className="w-4 h-4" /> Back to collection
          </Link>
        </div>
      </div>
    );
  }

  const addToCart = () => {
    addItem(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-7xl mx-auto px-5 sm:px-8 pt-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 grid lg:grid-cols-2 gap-10 lg:gap-16">
        <div className="relative aspect-square rounded-[2.5rem] overflow-hidden bg-mist shadow-[0_30px_70px_-30px_rgba(26,26,30,0.3)] float-in">
          <Image src={product.image_url} alt={product.name} fittingType="fill" className="w-full h-full object-cover" />
        </div>

        <div className="float-in">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            {product.category}
          </p>
          <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl leading-tight">
            {product.name}
          </h1>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${i < Math.round(product.rating || 0) ? 'fill-accent text-accent' : 'text-border'}`}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">{product.rating?.toFixed(1)} · Ages {product.age_range}</span>
          </div>

          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            {product.description}
          </p>

          <p className="mt-8 font-heading font-extrabold text-4xl">${product.price.toFixed(2)}</p>

          {/* Materiality bar */}
          <div className="mt-8 rounded-3xl bg-mist p-6">
            <div className="flex items-center gap-2 text-sm font-heading font-bold">
              <Leaf className="w-4 h-4 text-cosmic" /> The Feel
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{product.material}</p>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center rounded-full bg-mist">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid place-items-center w-12 h-12 rounded-full hover:bg-white"
                aria-label="Decrease"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center font-heading font-bold">{qty}</span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="grid place-items-center w-12 h-12 rounded-full hover:bg-white"
                aria-label="Increase"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <span className="text-sm text-muted-foreground">{product.stock} in stock</span>
          </div>
        </div>
      </div>

      {/* Sticky add-to-cart bar */}
      <div className="sticky bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="hidden sm:block">
            <p className="font-heading font-bold">{product.name}</p>
            <p className="text-sm text-muted-foreground">${product.price.toFixed(2)} · {qty} item(s)</p>
          </div>
          <div className="flex flex-1 sm:flex-initial gap-3">
            <button
              onClick={addToCart}
              className="squish flex-1 sm:w-auto h-14 px-6 rounded-full bg-mist text-foreground font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-accent hover:text-white transition-colors"
            >
              <ShoppingBag className="w-5 h-5" /> {added ? 'Added to cart' : 'Add to cart'}
            </button>
            <button
              onClick={() => { addItem(product, qty); navigate('/checkout'); }}
              className="squish flex-1 sm:w-auto h-14 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors"
            >
              Buy now
            </button>
          </div>
        </div>
      </div>

      <div className="pb-32">
        <Footer />
      </div>
    </div>
  );
}