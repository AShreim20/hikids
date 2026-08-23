import React, { useState } from 'react';
import { Image } from '@/components/ui/image';

// Renders a product's cover image, additional gallery images, and video as a
// single gallery with a thumbnail strip.
export default function ProductGallery({ product }) {
  const items = [
    ...(product.image_url ? [{ type: 'image', url: product.image_url }] : []),
    ...(Array.isArray(product.images) ? product.images.filter(Boolean).map((url) => ({ type: 'image', url })) : []),
    ...(product.video_url ? [{ type: 'video', url: product.video_url }] : []),
  ];
  const [active, setActive] = useState(0);

  if (items.length === 0) {
    return (
      <div className="relative aspect-square rounded-[2.5rem] overflow-hidden bg-mist float-in" />
    );
  }

  const current = items[Math.min(active, items.length - 1)];

  return (
    <div>
      <div className="relative aspect-square rounded-[2.5rem] overflow-hidden bg-mist shadow-[0_30px_70px_-30px_rgba(26,26,30,0.3)] float-in">
        {current.type === 'video' ? (
          <video src={current.url} controls playsInline className="w-full h-full object-cover" />
        ) : (
          <Image src={current.url} alt={product.name} fittingType="fill" className="w-full h-full object-cover" />
        )}
      </div>

      {items.length > 1 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`relative shrink-0 w-20 h-20 rounded-2xl overflow-hidden bg-mist border-2 transition-all ${
                i === active ? 'border-cosmic' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              {it.type === 'video' ? (
                <video src={it.url} className="w-full h-full object-cover" muted />
              ) : (
                <Image src={it.url} alt="" fittingType="fill" className="w-full h-full" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}