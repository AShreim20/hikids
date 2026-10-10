// Bilingual (Arabic <-> English) product search used by the shopProducts Edge Function.
//
// Why this exists: the old search was a plain ILIKE on name / name_en / category, so
//  - English words never matched an Arabic category ("puzzle", "cars", "toys" live only in
//    categories.name_en, which products don't carry),
//  - plural / variant forms failed ("cars" vs "Car", سيارات vs سيارة),
//  - Arabic spelling variants failed (أ/ا, ة/ه, ى/ي, tashkeel),
//  - multi-word queries needed the exact phrase to appear.
// Matching is now done in memory over a normalised "haystack" of every searchable field
// in BOTH languages (including the English/Arabic names of the product's categories) and a
// small synonym table, so a customer finds the same products whichever language the site
// or the query is in.

export interface SearchProduct {
  name?: string | null;
  name_en?: string | null;
  description?: string | null;
  description_en?: string | null;
  category?: string | null;
  category_ids?: string[] | null;
  tags?: string[] | null;
  material?: string | null;
  material_en?: string | null;
  features_ar?: string[] | null;
  features_en?: string[] | null;
  product_code?: string | null;
  gender?: string | null;
}

export interface SearchCategory {
  id: string;
  name?: string | null;
  name_en?: string | null;
}

/** lower-case, drop emoji/punctuation, unify Arabic letter variants, remove tashkeel/tatweel, ascii digits. */
export function normalize(input: unknown): string {
  let s = String(input ?? '').toLowerCase();
  s = s.replace(/[ً-ٰٟـ]/g, '');
  s = s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  s = s.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
  s = s.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const isArabic = (w: string) => /[؀-ۿ]/.test(w);

/** Candidate forms of one query word (the word itself, without the Arabic "al-", singular / plural-stripped). */
function wordForms(word: string): string[] {
  const forms = new Set<string>([word]);
  if (isArabic(word)) {
    let w = word;
    for (const p of ['وال', 'بال', 'كال', 'فال', 'لل', 'ال']) {
      if (w.startsWith(p) && w.length - p.length >= 3) { w = w.slice(p.length); forms.add(w); break; }
    }
    for (const sfx of ['ات', 'ون', 'ين', 'ان', 'ه', 'ي']) {
      if (w.endsWith(sfx) && w.length - sfx.length >= 3) forms.add(w.slice(0, -sfx.length));
    }
  } else if (word.length > 3) {
    if (word.endsWith('ies')) forms.add(word.slice(0, -3) + 'y');
    if (word.endsWith('es')) forms.add(word.slice(0, -2));
    if (word.endsWith('s')) forms.add(word.slice(0, -1));
    if (word.endsWith('ing') && word.length > 5) forms.add(word.slice(0, -3));
  }
  return [...forms];
}

// Synonym groups: every term in a group means (roughly) the same thing, in either language.
// Written naturally; normalised at load time.
const GROUPS: string[][] = [
  ['toy', 'toys', 'game', 'games', 'play', 'لعبة', 'العاب', 'ألعاب', 'لعب'],
  ['car', 'cars', 'vehicle', 'vehicles', 'truck', 'trucks', 'سيارة', 'سيارات', 'مركبة', 'مركبات', 'شاحنة'],
  ['doll', 'dolls', 'figure', 'figures', 'barbie', 'دمية', 'دمى', 'عروسة', 'شخصيات', 'شخصية'],
  ['puzzle', 'puzzles', 'brain', 'riddle', 'لغز', 'ألغاز', 'الغاز', 'ذكاء', 'بازل'],
  ['block', 'blocks', 'building', 'build', 'construction', 'lego', 'brick', 'bricks', 'مكعبات', 'مكعب', 'بناء', 'تركيب', 'ليجو'],
  ['magnet', 'magnets', 'magnetic', 'مغناطيس', 'مغناطيسي', 'مغناطيسية', 'مغناطيسيه'],
  ['remote', 'rc', 'control', 'ريموت', 'تحكم', 'كنترول', 'كونترول'],
  ['kitchen', 'cooking', 'cook', 'مطبخ', 'طبخ'],
  ['cashier', 'register', 'supermarket', 'كاشير', 'سوبرماركت', 'بقالة'],
  ['educational', 'education', 'learning', 'learn', 'تعليمي', 'تعليمية', 'تعليم', 'تعلم'],
  ['kid', 'kids', 'child', 'children', 'طفل', 'أطفال', 'اطفال', 'صغار'],
  ['baby', 'toddler', 'infant', 'newborn', 'بيبي', 'رضيع', 'رضع', 'مواليد'],
  ['art', 'arts', 'craft', 'crafts', 'paint', 'painting', 'draw', 'drawing', 'فن', 'فنون', 'الفنون', 'رسم', 'تلوين', 'إبداع', 'ابداع'],
  ['outdoor', 'garden', 'خارجي', 'خارجية', 'حديقة'],
  ['water', 'sand', 'beach', 'ماء', 'مائي', 'مائية', 'رمل', 'شاطئ', 'بحر'],
  ['gift', 'gifts', 'present', 'هدية', 'هدايا'],
  ['electronic', 'electric', 'interactive', 'الكتروني', 'إلكتروني', 'كهربائي', 'تفاعلي', 'تفاعلية'],
  ['sport', 'sports', 'active', 'ball', 'balls', 'رياضة', 'حركة', 'كرة', 'كرات'],
  ['pretend', 'imagination', 'role', 'roleplay', 'تمثيل', 'خيال'],
  ['family', 'group', 'board', 'party', 'عائلي', 'عائلية', 'جماعي', 'جماعية', 'عائلة'],
  ['music', 'musical', 'piano', 'instrument', 'موسيقى', 'موسيقي', 'بيانو', 'آلة'],
  ['train', 'trains', 'قطار'],
  ['gun', 'blaster', 'rifle', 'مسدس', 'بندقية'],
  ['prayer', 'سجادة', 'صلاة', 'صلاه'],
  ['walker', 'مشاية'],
  ['projector', 'projection', 'إسقاط', 'اسقاط', 'ضوئي'],
  ['plush', 'stuffed', 'teddy', 'bear', 'دبدوب', 'دب', 'قطيفة', 'محشو'],
  ['animal', 'animals', 'حيوان', 'حيوانات'],
  ['boy', 'boys', 'ولد', 'أولاد', 'اولاد', 'ذكور'],
  ['girl', 'girls', 'بنت', 'بنات', 'إناث', 'اناث'],
  ['wood', 'wooden', 'خشب', 'خشبي', 'خشبية'],
  ['light', 'lights', 'led', 'ضوء', 'أضواء', 'اضواء', 'انارة', 'إضاءة'],
  ['sound', 'sounds', 'صوت', 'أصوات', 'اصوات'],
  ['bag', 'case', 'carry', 'حقيبة', 'شنطة', 'حقائب'],
  ['set', 'kit', 'طقم', 'مجموعة', 'سيت'],
  ['house', 'home', 'بيت', 'منزل', 'دار'],
  ['castle', 'قلعة'],
  ['table', 'طاولة', 'منضدة'],
  ['swim', 'pool', 'مسبح', 'سباحة'],
  ['bike', 'bicycle', 'scooter', 'دراجة', 'سكوتر', 'عجلة'],
];

const GROUP_INDEX: Map<string, string[]> = (() => {
  const idx = new Map<string, string[]>();
  for (const g of GROUPS) {
    const terms = [...new Set(g.map(normalize).filter(Boolean))];
    for (const t of terms) {
      for (const f of wordForms(t)) {
        const prev = idx.get(f) || [];
        idx.set(f, [...new Set([...prev, ...terms])]);
      }
    }
  }
  return idx;
})();

/** All strings that count as a hit for one query word. */
export function expandWord(word: string): string[] {
  const out = new Set<string>();
  for (const f of wordForms(word)) {
    out.add(f);
    const syn = GROUP_INDEX.get(f);
    if (syn) for (const s of syn) out.add(s);
  }
  return [...out].filter((x) => x.length >= 2);
}

export function parseQuery(q: string): string[][] {
  const words = normalize(q).split(' ').filter((w) => w.length >= 1);
  return words.map(expandWord);
}

interface Indexed { name: string; category: string; rest: string; all: string }

export function indexProduct(p: SearchProduct, catById: Map<string, SearchCategory>, catByName: Map<string, SearchCategory>): Indexed {
  const cats: string[] = [];
  const pushCat = (c?: SearchCategory | null) => { if (c) cats.push(c.name || '', c.name_en || ''); };
  if (p.category) { cats.push(p.category); pushCat(catByName.get(p.category)); }
  for (const id of p.category_ids || []) pushCat(catById.get(id));
  const gender = p.gender === 'male' ? 'boy boys ولد اولاد' : p.gender === 'female' ? 'girl girls بنت بنات' : '';
  const name = normalize(`${p.name || ''} ${p.name_en || ''}`);
  const category = normalize(cats.join(' '));
  const rest = normalize([
    p.description, p.description_en, (p.tags || []).join(' '), p.material, p.material_en,
    (p.features_ar || []).join(' '), (p.features_en || []).join(' '), p.product_code, gender,
  ].filter(Boolean).join(' '));
  return { name, category, rest, all: `${name} ${category} ${rest}` };
}

// Latin terms match whole words (plural -s/-es allowed; terms of 4+ letters may also be a word prefix,
// so "magnet" finds "magnetic" but "car" does not find "carry"/"cartoon"). Arabic terms match as substrings.
const has = (hay: string, v: string) => {
  if (/[^ -]/.test(v)) return v.length < 3 ? ` ${hay} `.includes(` ${v} `) : hay.includes(v);
  for (const w of hay.split(' ')) {
    if (w === v || w === v + 's' || w === v + 'es') return true;
    if (v.length >= 4 && w.startsWith(v)) return true;
  }
  return false;
};

/** 0 = no match. Every query word must match somewhere; name hits score highest. */
export function scoreProduct(ix: Indexed, groups: string[][]): number {
  if (!groups.length) return 1;
  let score = 0;
  for (const variants of groups) {
    let best = 0;
    for (const v of variants) {
      if (has(ix.name, v)) { best = Math.max(best, 6); }
      else if (has(ix.category, v)) { best = Math.max(best, 3); }
      else if (has(ix.rest, v)) { best = Math.max(best, 1); }
      if (best === 6) break;
    }
    if (best === 0) return 0;
    score += best;
  }
  return score;
}
