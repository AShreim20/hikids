import { supabase } from '@/api/supabaseClient';

// Mirrors base44.integrations.Core.UploadFile({ file }) -> { file_url }.
//
// Default call shape (`uploadFile(file)`) is unchanged and used by every
// admin upload (products, categories, hero slides, bundles, the store
// logo) — it lands at the root of the "uploads" bucket exactly as before,
// so no admin call site needed to change for the storage-security fix (see
// supabase/migrations/0022_secure_storage_buckets.sql).
//
// The two customer-facing uploads (product photo reviews, challenge photo
// submissions) pass { bucket: 'customer-uploads', folder, ownerId } so the
// file lands under `<folder>/<ownerId>/<name>` — the RLS policy on that
// bucket only allows a caller to write into a folder matching their own
// auth.uid(), so a customer can never overwrite another customer's upload
// or reach outside their own reviews/challenges path.
export async function uploadFile(file, { bucket = 'uploads', folder, ownerId } = {}) {
  const toUpload = await maybeOptimizeImage(file, bucket);
  const ext = toUpload.name.includes('.') ? toUpload.name.split('.').pop() : '';
  const filename = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
  const path = folder && ownerId ? `${folder}/${ownerId}/${filename}` : filename;
  const { error } = await supabase.storage.from(bucket).upload(path, toUpload, {
    contentType: toUpload.type || file.type || undefined,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { file_url: data.publicUrl };
}

// --- Admin product/store image preprocessing (pre-launch perf batch) -------
//
// Scoped to bucket === 'uploads' (the admin default) only — customer
// review/challenge uploads (bucket: 'customer-uploads') pass through
// completely untouched, unchanged from before this batch.
//
// MAX_UPLOAD_DIMENSION=2400 (longest side) was chosen by measuring the
// actual storefront, not guessed:
//   - ProductGallery's main product-detail image renders at ~576 CSS px on
//     a 1920px-wide desktop viewport -> ~1728px needed at 3x DPR.
//   - The Hero carousel (the widest surface in the app) renders at ~1873
//     CSS px wide on that same viewport.
//   - Every ProductCard grid (Home/Shop/Wishlist/Similar/Deals/Categories)
//     measured 260-390 CSS px wide -> trivial next to either of the above.
// 2400px comfortably covers all of these with DPR headroom, while still
// cutting a 4000x4000+ camera/AI-generated original down to at most
// 2400x2400 (>60% fewer pixels) before compression is even applied.
const MAX_UPLOAD_DIMENSION = 2400;
// 0.86 is a "high quality" WebP/JPEG setting — visually indistinguishable
// from the source for photographic product images, while still
// meaningfully smaller than an uncompressed/near-lossless original. Not
// tuned for minimum file size (that would risk visible artifacts on
// packaging text/labels, which this store's images must keep sharp).
const UPLOAD_QUALITY = 0.86;
// Only formats where re-encoding is safe and beneficial. GIF is excluded
// (animation would collapse to a single frame) and anything non-raster
// (video, etc.) is excluded — both upload completely unchanged, exactly as
// before this batch.
const OPTIMIZABLE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

let webpEncodeSupport;
// Feature-detects canvas.toBlob('image/webp', …) once and caches the
// result — some browsers (older Safari in particular) can decode WebP but
// not encode it, silently substituting PNG if asked. Checked once per page
// load rather than per file.
function supportsWebpEncode() {
  if (!webpEncodeSupport) {
    webpEncodeSupport = new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        canvas.toBlob((blob) => resolve(!!blob && blob.type === 'image/webp'), 'image/webp');
      } catch {
        resolve(false);
      }
    });
  }
  return webpEncodeSupport;
}

function renameExtension(name, ext) {
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
  return `${base}.${ext}`;
}

async function maybeOptimizeImage(file, bucket) {
  if (bucket !== 'uploads') return file;
  if (!OPTIMIZABLE_MIME_TYPES.includes(file.type)) return file;
  try {
    return await resizeAndCompressImage(file);
  } catch (err) {
    // Fail safe: never block or corrupt an upload because preprocessing hit
    // an unexpected error (decode failure, canvas taint, etc.) — upload the
    // original file exactly as it would have gone before this batch.
    console.warn('[uploadFile] image preprocessing failed, uploading original file', err);
    return file;
  }
}

async function resizeAndCompressImage(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    // Never enlarge a small source image — scale only clamps downward.
    const scale = longest > MAX_UPLOAD_DIMENSION ? MAX_UPLOAD_DIMENSION / longest : 1;
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    // WebP supports alpha in both lossy and lossless modes, so PNG
    // transparency survives this conversion without a separate code path.
    const canEncodeWebp = await supportsWebpEncode();
    const outputType = canEncodeWebp ? 'image/webp' : file.type;
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
        outputType,
        UPLOAD_QUALITY
      );
    });

    // Safety net: if re-encoding somehow produced a larger file than the
    // original (can happen with an already-tiny, already-optimized source),
    // keep the original rather than regress it.
    if (blob.size >= file.size) return file;

    const ext = outputType === 'image/webp' ? 'webp' : (file.name.split('.').pop() || 'jpg');
    return new File([blob], renameExtension(file.name, ext), { type: outputType });
  } finally {
    bitmap.close?.();
  }
}
