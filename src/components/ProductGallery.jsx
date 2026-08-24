import React, { useEffect, useState } from 'react';
import { Image } from '@/components/ui/image';
import { ZoomIn, X } from 'lucide-react';

// Renders a product's cover image, additional gallery images, and video as a
// single gallery with a thumbnail strip. Images support a hover magnifier on
// desktop and a tap-to-zoom lightbox on every device.
export default function ProductGallery({ product, images }) {
  const override = Array.isArray(images) ? images.filter(Boolean) : null;
  const items = [
    ...(override && override.length > 0
      ? override.map((url) => ({ type: 'image', url }))
      : [
          ...(product.image_url ? [{ type: 'image', url: product.image_url }] : []),
          ...(Array.isArray(product.images) ? product.images.filter(Boolean).map((url) => ({ type: 'image', url })) : []),
        ]),
    ...(product.video_url ? [{ type: 'video', url: product.video_url }] : []),
  ];
  const [active, setActive] = useState(0);
  useEffect(() => { setActive(0); }, [override?.join('|')]);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [lightbox, setLightbox] = useState(null);

  if (items.length === 0) {
    return (
      <div className="relative aspect-square rounded-[2.5rem] overflow-hidden bg-mist float-in" />
    );
  }

  const current = items[Math.min(active, items.length - 1)];
  const isImage = current.type === 'image';

  const handleMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  };

  return (
    <div>
      <div
        className="relative aspect-square rounded-[2.5rem] overflow-hidden bg-mist shadow-[0_30px_70px_-30px_rgba(26,26,30,0.3)] float-in group"
        onMouseEnter={() => isImage && setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={handleMove}
        onClick={() => isImage && setLightbox(current.url)}
      >
        {current.type === 'video' ? (
          <video src={current.url} controls playsInline className="w-full h-full object-cover" />
        ) : (
          <Image
            src={current.url}
            alt={product.name}
            fittingType="fill"
            className={`w-full h-full object-cover transition-transform duration-300 ease-out cursor-zoom-in ${zoom ? 'scale-[1.8]' : 'scale-100'}`}
            style={{ transformOrigin: `${origin.x}% ${origin.y}%` }}
          />
        )}
        {isImage && (
          <div className="absolute top-4 right-4 grid place-items-center w-10 h-10 rounded-full bg-card/85 backdrop-blur-md text-foreground pointer-events-none transition-opacity opacity-80 group-hover:opacity-100">
            <ZoomIn className="w-5 h-5" />
          </div>
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

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm grid place-items-center p-4 sm:p-10 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-5 right-5 grid place-items-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightbox}
            alt={product.name}
            className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}