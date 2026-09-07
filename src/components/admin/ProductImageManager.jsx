import React, { useRef, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, X, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { uploadFile } from '@/lib/uploadFile';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { useLanguage } from '@/context/LanguageContext';

// Unified, order-preserving product image manager. `images` is one flat,
// ordered array of URLs — index 0 is always the product's main image. The
// caller (ProductFormFields) is the only place that folds the product's
// `image_url` + `images[]` columns into this single array and splits it back
// apart before saving, so the schema and every storefront call site that
// reads `image_url`/`images[]` keep working unchanged.
export default function ProductImageManager({ images, onChange }) {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const list = images || [];

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    setUploading(true);
    try {
      // allSettled — a single bad file must not drop the others (spec: "Keep
      // all successfully uploaded images attached").
      const results = await Promise.allSettled(files.map((f) => uploadFile(f)));
      const uploaded = results.filter((r) => r.status === 'fulfilled').map((r) => r.value.file_url);
      const failed = results.length - uploaded.length;
      if (uploaded.length) onChange([...list, ...uploaded]);
      if (failed) {
        toast({
          title: ar ? `تعذّر رفع ${failed} من الصور` : `${failed} image${failed > 1 ? 's' : ''} failed to upload`,
          variant: 'destructive',
        });
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // OS-level file drag: only react when the drag payload is actually files
  // (not, say, text or one of our own Draggable thumbnails being reordered —
  // @hello-pangea/dnd drives that with pointer/touch sensors, not the native
  // HTML5 drag events, so the two never collide).
  const isFileDrag = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
  const onDragOver = (e) => { if (isFileDrag(e)) { e.preventDefault(); setDragOver(true); } };
  const onDrop = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const onDragEnd = (res) => {
    if (!res.destination || res.destination.index === res.source.index) return;
    const next = Array.from(list);
    const [moved] = next.splice(res.source.index, 1);
    next.splice(res.destination.index, 0, moved);
    onChange(next);
  };

  const remove = (idx) => onChange(list.filter((_, i) => i !== idx));

  // Non-drag fallback for reordering (buttons, not pointer-tracked) — keeps
  // reordering usable if touch drag ever behaves inconsistently on a given
  // mobile browser. Swaps with the neighboring slot; index 0 stays the rule
  // for "main image", same as a drag-driven reorder.
  const move = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const next = Array.from(list);
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`mt-2 rounded-2xl border-2 border-dashed p-3 transition-colors ${
        dragOver ? 'border-cosmic bg-cosmic/5' : 'border-border'
      }`}
    >
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="product-images" direction="horizontal">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="flex flex-wrap gap-3">
              {list.map((url, i) => (
                <Draggable key={`${i}-${url}`} draggableId={`${i}-${url}`} index={i} isDragDisabled={uploading}>
                  {(prov, snapshot) => (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      className={`relative w-20 h-20 rounded-2xl overflow-hidden bg-mist border-2 select-none [-webkit-touch-callout:none] ${
                        snapshot.isDragging ? 'border-cosmic shadow-xl z-10' : 'border-transparent'
                      }`}
                    >
                      {/* Drag handle covers only the image, not the remove
                          button, so tapping/clicking X never starts a drag.
                          -webkit-touch-callout:none stops iOS Safari's
                          long-press "Save Image" menu from hijacking the same
                          press-and-hold gesture that starts a touch drag. */}
                      <div {...prov.dragHandleProps} className="absolute inset-0 cursor-grab active:cursor-grabbing">
                        <Image src={url} alt={`product-${i}`} fittingType="fill" draggable={false} className="w-full h-full pointer-events-none" />
                        {i === 0 && (
                          <span className="absolute bottom-0 inset-x-0 bg-cosmic/90 text-white text-[9px] leading-tight font-heading font-bold text-center py-1">
                            {t('admin.mainImage')}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="absolute top-1 end-1 z-10 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white"
                        aria-label={t('admin.delete')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {/* Button fallback for reordering — works the same on
                          every device regardless of how well touch-drag
                          behaves on a given mobile browser. start-/end- flip
                          correctly for RTL; the chevrons rotate with them. */}
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={uploading}
                          className="absolute top-1/2 -translate-y-1/2 start-1 z-10 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white disabled:opacity-40"
                          aria-label={t('admin.moveImageBack')}
                        >
                          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
                        </button>
                      )}
                      {i < list.length - 1 && (
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={uploading}
                          className="absolute top-1/2 -translate-y-1/2 end-1 z-10 grid place-items-center w-6 h-6 rounded-full bg-black/60 text-white disabled:opacity-40"
                          aria-label={t('admin.moveImageForward')}
                        >
                          <ChevronRight className="w-4 h-4 rtl:rotate-180" />
                        </button>
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="squish w-20 h-20 rounded-2xl border-2 border-dashed border-border grid place-items-center text-muted-foreground hover:border-cosmic hover:text-cosmic disabled:opacity-60"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
              </button>
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => addFiles(e.target.files)} className="hidden" />
      <p className="mt-2 text-xs text-muted-foreground">{t('admin.dropImagesHere')}</p>
    </div>
  );
}
