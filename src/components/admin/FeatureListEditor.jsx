import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, X, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// Dynamic, reorderable editor for a product's Arabic/English Features list
// (short highlight phrases, not full sentences — kept separate from the
// Description field). Drag-and-drop reuses the exact pattern already used
// for the homepage carousel (CarouselList.jsx) and product images
// (ProductImageManager.jsx): a dedicated grip handle starts the drag so the
// row's own text input stays click/type-safe, plus Move up/down buttons
// shown alongside it as a touch-safe fallback — the same reasoning as
// ProductImageManager's (touch-drag can behave inconsistently on some
// mobile browsers), applied here rather than relying on drag alone.
export default function FeatureListEditor({ items, onChange, dir, placeholder, addLabel, droppableId }) {
  const { t } = useLanguage();
  const list = items || [];

  const setAt = (i, value) => onChange(list.map((v, idx) => (idx === i ? value : v)));
  const removeAt = (i) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...list, '']);
  const move = (i, delta) => {
    const target = i + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[i], next[target]] = [next[target], next[i]];
    onChange(next);
  };

  const onDragEnd = (res) => {
    if (!res.destination || res.destination.index === res.source.index) return;
    const next = Array.from(list);
    const [moved] = next.splice(res.source.index, 1);
    next.splice(res.destination.index, 0, moved);
    onChange(next);
  };

  return (
    <div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId={droppableId}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
              {list.map((val, i) => (
                <Draggable key={`${droppableId}-${i}`} draggableId={`${droppableId}-${i}`} index={i}>
                  {(prov, snapshot) => (
                    <div
                      ref={prov.innerRef}
                      {...prov.draggableProps}
                      className={`flex items-center gap-1.5 sm:gap-2 rounded-2xl bg-mist border p-1.5 sm:p-2 ${
                        snapshot.isDragging ? 'border-cosmic shadow-lg' : 'border-transparent'
                      }`}
                    >
                      <button
                        type="button"
                        {...prov.dragHandleProps}
                        className="grid place-items-center w-8 h-8 rounded-full text-muted-foreground hover:bg-card cursor-grab active:cursor-grabbing shrink-0"
                        aria-label={t('admin.dragToReorder')}
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <div className="flex flex-col shrink-0">
                        <button
                          type="button"
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          className="grid place-items-center w-6 h-5 text-muted-foreground disabled:opacity-25"
                          aria-label={t('admin.moveImageBack')}
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(i, 1)}
                          disabled={i === list.length - 1}
                          className="grid place-items-center w-6 h-5 text-muted-foreground disabled:opacity-25"
                          aria-label={t('admin.moveImageForward')}
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        value={val}
                        dir={dir}
                        onChange={(e) => setAt(i, e.target.value)}
                        placeholder={placeholder}
                        className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
                      />
                      <button
                        type="button"
                        onClick={() => removeAt(i)}
                        className="grid place-items-center w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors shrink-0"
                        aria-label={t('admin.delete')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      <button
        type="button"
        onClick={add}
        className="squish mt-2 inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-mist font-heading font-bold text-sm text-foreground/80 hover:bg-accent/20"
      >
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}
