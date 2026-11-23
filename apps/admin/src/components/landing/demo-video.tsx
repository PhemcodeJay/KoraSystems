"use client";

import { useState } from "react";

/**
 * Demo video player for the /demo page.
 *
 * Renders a 16:9 video container with a branded play-button overlay.
 * Pass a `src` (mp4/webm) or an `embedUrl` (YouTube/Vimeo) — when neither is
 * provided it shows a polished placeholder until a real video is wired up.
 *
 * Example:
 *   <DemoVideo src="/videos/demo.mp4" />
 *   <DemoVideo embedUrl="https://www.youtube.com/embed/VIDEO_ID" />
 */
export function DemoVideo({
  src,
  embedUrl,
  className,
}: {
  /** Direct video file (mp4/webm/ogg). */
  src?: string;
  /** YouTube/Vimeo embed URL. */
  embedUrl?: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  // No real video yet — show a branded placeholder with a play button.
  if (!src && !embedUrl) {
    return (
      <div
        className={className}
        aria-label="Demo video placeholder"
      >
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-ink-200 bg-ink-100 shadow-sm">
          {/* Placeholder thumbnail: subtle brand gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-500/10 to-brand-900/10" />
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => setPlaying(true)}
              aria-label="Watch demo video"
              className="relative z-10 w-14 h-14 rounded-full bg-brand-600 px-3 py-3 shadow-lg hover:bg-brand-700 transition flex items-center justify-center"
            >
              {/* Play triangle */}
              <svg
                className="w-6 h-6 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span className="sr-only">Play demo video</span>
            </button>
          </div>
          <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs text-ink-400 font-medium tracking-wide uppercase">
            <span>Kora Systems — Admin Demo</span>
            <span>2:00 min</span>
          </div>
        </div>
        <p className="mt-3 text-center text-sm text-ink-500">
          Video will appear here once the demo recording is uploaded.
        </p>
      </div>
    );
  }

  // Direct video file.
  if (src) {
    return (
      <div className={className}>
        <video
          autoPlay={playing}
          playsInline
          muted
          controls
          className="w-full rounded-2xl border border-ink-200 bg-ink-100 shadow-sm"
          poster={src.replace(/\.(mp4|webm|ogg)$/i, "-poster.jpg")}
        >
          <source src={src} type="video/mp4" />
          <p className="text-ink-500 text-center mt-4">
            Your browser does not support the video tag.
          </p>
        </video>
      </div>
    );
  }

  // YouTube / Vimeo embed.
  return (
    <div className={className}>
      <iframe
        src={embedUrl}
        title="KoraSystems demo"
        className="w-full aspect-video rounded-2xl border border-ink-200 shadow-sm"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
