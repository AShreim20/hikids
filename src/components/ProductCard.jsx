import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useCart } from '@/context/CartContext';

export default function ProductCard({ product, large = false }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <Link
      to={`/product/${product.id}`}
      className={`group block float-in`}
    >
      <div
        className={`relative overflow-hidden rounded-[2rem] bg-mist ${
          large ? 'aspect-[4/5] md:aspect-[4/4.5]' : 'aspect-[4/5]'
        } shadow-[0_18px_50px_-20px_rgba(26,26,30,0.25)] transition-transform duration-500 group-hover:-translate-y-2`}
      >
        <Image
          src={product.image_url}
          alt={product.name}
          fittingType="fill"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <button
          onClick={handleAdd}
          className={`absolute bottom-4 right-4 squish grid place-items-center gap-2 rounded-full shadow-lg transition-all duration-300 ${
            added
              ? 'bg-accent text-white w-auto px-5'
              : 'bg-white text-foreground w-12 h-12 hover:bg-cosmic hover:text-white'
          }`}
        >
          {added ? (
            <span className="text-xs font-bold whitespace-nowrap px-1">Added!</span>
          ) : (
            <ShoppingBag className="w-5 h-5" />
          )}
        </button>
      </div>

      <div className="px-1 pt-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
          {product.category}
        </p>
        <h3 className="mt-1 font-heading font-bold text-lg leading-tight">
          {product.name}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ages {product.age_range}
        </p>
        <p className="mt-2 font-heading font-extrabold text-xl">
          ${product.price.toFixed(2)}
        </p>
      </div>
    </Link>
  );
}