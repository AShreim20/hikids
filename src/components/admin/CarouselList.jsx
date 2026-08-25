import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Pencil, Trash2, EyeOff } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { useLanguage } from '@/context/LanguageContext';

// Drag-and-drop reorderable list of homepage carousel slides.
// Only the grip handle initiates a drag, so Edit/Delete stay click-safe.
export default function CarouselList({ items, onReorder, onEdit, onDelete }) {
  const { t, lang } = useLanguage();
  const ar = lang === 'ar';

  const onDragEnd = (res) => {
    if (!res.destination || res.destination.index === res.source.index) return;
    const next = Array.from(items);
    const [moved] = next.splice(res.source.index, 1);
    next.splice(res.destination.index, 0, moved);
    onReorder(next);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="carousel">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps} className="mt-6 space-y-3">
            {items.map((s, index) => (
              <Draggable key={s.id} draggableId={s.id} index={index}>
                {(prov, snapshot) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-3xl bg-card border transition-shadow ${
                      snapshot.isDragging ? 'border-cosmic shadow-2xl' : 'border-border/60'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <button
                        {...prov.dragHandleProps}
                        className="grid place-items-center w-9 h-9 rounded-full bg-mist text-muted-foreground hover:bg-cosmic hover:text-white cursor-grab active:cursor-grabbing"
                        aria-label={ar ? 'اسحب لإعادة الترتيب' : 'Drag to reorder'}
                      >
                        <GripVertical className="w-5 h-5" />
                      </button>
                      <span className="grid place-items-center w-7 h-7 rounded-full bg-cosmic text-white text-xs font-heading font-bold">
                        {index + 1}
                      </span>
                    </div>
                    <div className="w-24 h-16 rounded-2xl overflow-hidden bg-mist shrink-0">
                      <Image src={s.image_url} alt={s.title || 'slide'} fittingType="fill" className="w-full h-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading font-bold truncate">{s.title || (ar ? 'بدون عنوان' : 'Untitled')}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.cta_link ? s.cta_link : '\u00A0'}
                      </p>
                    </div>
                    {s.active === false && (
                      <span className="hidden sm:inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-mist text-xs text-muted-foreground shrink-0">
                        <EyeOff className="w-3.5 h-3.5" /> {ar ? 'مخفية' : 'Hidden'}
                      </span>
                    )}
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => onEdit(s)} className="squish h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-1.5">
                        <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">{t('admin.edit')}</span>
                      </button>
                      <button
                        onClick={() => onDelete(s)}
                        className="squish grid place-items-center w-10 h-10 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
                        aria-label={t('admin.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}