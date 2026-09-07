import React, { useState } from 'react';
import { Image } from '@/components/ui/image';

const FOCAL_TO_OBJECT_POSITION = { left: 'left center', center: 'center center', right: 'right center' };

// `autoPlay` (the attribute) only actually starts playback if `muted` is
// already true on the element at the exact moment the browser checks it —
// a well-known gap in how React applies JSX props to a freshly-created
// <video>, which on a genuinely fresh page load can leave the element
// sitting fully loaded (readyState 4) but paused. Forcing `.muted = true`
// then calling `.play()` from the ref callback closes that gap; a play()
// that's still refused (rare, muted video is broadly allowed to autoplay)
// is swallowed since there's no UI depending on the promise.
const autoplayRef = (el) => {
  if (!el) return;
  el.muted = true;
  el.play?.().catch(() => {});
};

// Renders one slide's media — image or video, Desktop or Mobile — never both
// at once (avoids downloading two Hero assets, a video especially, on the
// same slide). `isMobileViewport` is resolved synchronously by the caller
// (not via an effect) so the very first paint already picks the right one —
// no flash, no double-fetch.
//
// Uploaded Hero media lives in Supabase Storage, not the Wix media hosts the
// shared <Image> component optimizes for, so it always takes that
// component's plain-<img> fallback path — which doesn't add object-fit
// itself, hence the explicit `object-cover` class here.
export default function HeroSlideMedia({ slide, isMobileViewport, eager, onVideoEnded }) {
  const [videoFailed, setVideoFailed] = useState(false);
  const hasMobileMedia = !!slide.mobile_image_url;
  const useMobile = isMobileViewport && hasMobileMedia;
  const url = useMobile ? slide.mobile_image_url : slide.image_url;
  const type = useMobile ? (slide.mobile_media_type || slide.media_type) : slide.media_type;
  const objectPosition = FOCAL_TO_OBJECT_POSITION[slide.focal_position] || 'center center';

  if (type === 'video' && url && !videoFailed) {
    // The Hero frame's shape (16:5 desktop / 4:5 mobile / fixed tablet) is a
    // fixed DISPLAY ratio, unrelated to whatever ratio the uploaded video
    // actually is (typically 16:9) — so the video is never allowed to
    // stretch or crop-to-fill that frame. Two layers, same <video> src:
    //   - a `cover`+blurred layer behind, filling the frame edge-to-edge
    //     with no black bars (decorative, hidden from a11y/hit-testing)
    //   - the real `contain` video on top, fully visible, never cropped
    // Both autoplay/mute/loop identically off the same URL (a second
    // request the browser serves from cache, not a real re-download), so
    // they start together and drift is imperceptible once blurred.
    return (
      <div className="absolute inset-0 overflow-hidden">
        <video
          ref={autoplayRef}
          key={`${url}-bg`}
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl brightness-75"
          style={{ objectPosition }}
          src={url}
          autoPlay
          muted
          loop
          playsInline
          preload={eager ? 'auto' : 'metadata'}
          aria-hidden="true"
          tabIndex={-1}
        />
        <video
          ref={autoplayRef}
          key={`${url}-fg`}
          className="absolute inset-0 w-full h-full object-contain"
          src={url}
          autoPlay
          muted
          // A video driving "advance when it finishes" must actually finish —
          // looping it would mean 'ended' never fires. Only loop when nothing
          // is listening for that (i.e. the slide uses its own configured
          // Slide Duration instead), so it stays visually alive during the
          // wait rather than freezing on its last frame.
          loop={!onVideoEnded}
          playsInline
          // The first visible slide's video should be ready as soon as
          // possible; later slides only fetch enough to know their own
          // dimensions/poster until they're actually shown.
          preload={eager ? 'auto' : 'metadata'}
          onError={() => setVideoFailed(true)}
          onEnded={onVideoEnded}
        />
      </div>
    );
  }

  return (
    <Image
      key={url}
      src={videoFailed ? null : url}
      alt={slide.title || ''}
      fittingType="fill"
      className="absolute inset-0 w-full h-full object-cover"
      style={{ objectPosition }}
      loading={eager ? 'eager' : 'lazy'}
      fetchpriority={eager ? 'high' : undefined}
    />
  );
}
