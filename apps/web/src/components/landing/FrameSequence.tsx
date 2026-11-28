"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { landingCopy } from "../../lib/landing-copy";

gsap.registerPlugin(ScrollTrigger);

type VariantId = "desktop" | "mobile";

export type FramesManifest = {
  source?: string;
  variants: Record<
    VariantId,
    {
      fps: number;
      width: number;
      height: number;
      quality: number;
      frameCount: number;
      pathPrefix: string;
      pattern: string;
    }
  >;
};

function pickVariant(width: number): VariantId {
  return width < 768 ? "mobile" : "desktop";
}

function frameUrl(prefix: string, index1: number): string {
  return `${prefix}${String(index1).padStart(4, "0")}.webp`;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type FrameFit = "cover" | "contain";

const VIDEO_ASPECT = 16 / 9;
/** Cover crops this much of the frame width before we letterbox instead. */
const MAX_WIDTH_CROP = 0.12;

export function computeFrameFit(cssW: number, cssH: number): FrameFit {
  if (!cssW || !cssH) return "cover";
  const scale = Math.max(cssW / VIDEO_ASPECT, cssH);
  const visibleWidth = cssW / scale;
  const widthCrop = 1 - visibleWidth / VIDEO_ASPECT;
  return widthCrop > MAX_WIDTH_CROP ? "contain" : "cover";
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cssW: number,
  cssH: number,
  dpr: number,
  fit: FrameFit,
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih || !cssW || !cssH) return;

  const scale = fit === "contain" ? Math.min(cssW / iw, cssH / ih) : Math.max(cssW / iw, cssH / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cssW - dw) / 2;
  const dy = (cssH - dh) / 2;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.drawImage(img, dx, dy, dw, dh);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

function waitForMedia(video: HTMLVideoElement, ms: number): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      video.removeEventListener("canplaythrough", done);
      video.removeEventListener("error", done);
      resolve();
    };
    const timer = window.setTimeout(done, ms);
    video.addEventListener("canplaythrough", done);
    video.addEventListener("error", done);
  });
}

const SCRUB_RESUME_MS = 700;
/** Fast-start file. The previous upload had ~1MB of empty padding before the first frame. */
const HERO_VIDEO_URL =
  "https://gegmzokhmbxwjonyqmmz.supabase.co/storage/v1/object/public/landing/aida-fast.mp4";
/** Don't reveal the moving picture until this much is buffered. Otherwise a cold cache stutters. */
const START_BUFFER_SEC = 2;

type HeroVisual = "poster" | "video" | "frames";

function bufferedAhead(video: HTMLVideoElement): number {
  const time = video.currentTime || 0;
  for (let i = 0; i < video.buffered.length; i += 1) {
    const start = video.buffered.start(i);
    const end = video.buffered.end(i);
    if (time >= start - 0.05 && time <= end + 0.001) return Math.max(0, end - time);
  }
  return 0;
}

function canStartSmooth(video: HTMLVideoElement): boolean {
  return bufferedAhead(video) >= START_BUFFER_SEC;
}

export function FrameSequence({
  children,
  onProgress,
  onFit,
}: {
  children?: ReactNode;
  onProgress?: (progress: number) => void;
  onFit?: (fit: FrameFit) => void;
}) {
  const pinRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const loadedRef = useRef<Set<number>>(new Set());
  const inflightRef = useRef<Map<number, Promise<HTMLImageElement | null>>>(new Map());
  const drawnIndexRef = useRef(-1);
  const paintRafRef = useRef(0);
  const progressRef = useRef(0);
  const variantRef = useRef<VariantId>("desktop");
  const fitRef = useRef<FrameFit>("cover");
  const manifestRef = useRef<FramesManifest | null>(null);
  const scrubUntilRef = useRef(0);
  const stRef = useRef<ScrollTrigger | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioStateRef = useRef<"idle" | "starting" | "blocked" | "playing">("idle");
  const scrollDrivenRef = useRef(false);
  const soundUnlockedRef = useRef(false);
  const videoFailedRef = useRef(false);
  const mutedRef = useRef(false);
  const visualRef = useRef<HeroVisual>("poster");
  const primedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [visual, setVisual] = useState<HeroVisual>("poster");
  const [posterSrc, setPosterSrc] = useState("/frames/desktop/0001.webp");
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [lastFrameSrc, setLastFrameSrc] = useState<string | null>(null);
  const [fit, setFit] = useState<FrameFit>("cover");
  const [bootGen, setBootGen] = useState(0);
  const laidOutRef = useRef(false);

  const assignVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (!node) return;
    // Muted has to be set before play(), and it must not be a React prop or the
    // next render snaps it back and kills autoplay.
    node.defaultMuted = true;
    node.muted = true;
    node.playsInline = true;
    node.setAttribute("fetchpriority", "high");
  }, []);

  const showVisual = useCallback((next: HeroVisual) => {
    if (visualRef.current === next) return;
    visualRef.current = next;
    setVisual(next);
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const pin = pinRef.current;
    if (!canvas || !pin) return;
    const cssW = pin.clientWidth;
    const cssH = pin.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextW = Math.max(1, Math.floor(cssW * dpr));
    const nextH = Math.max(1, Math.floor(cssH * dpr));
    // Assigning canvas width clears the bitmap even when the size is unchanged.
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
      drawnIndexRef.current = -1;
    }
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }, []);

  // Hold the latest decoded frame at or before the playhead. Jumping ahead to a
  // sparse keyframe is what made the first loops look like a stuttering video.
  const frameAt = useCallback((wanted: number) => {
    const loaded = loadedRef.current;
    if (loaded.has(wanted)) return wanted;
    for (let i = wanted - 1; i >= 0; i--) {
      if (loaded.has(i)) return i;
    }
    return -1;
  }, []);

  const ensureImage = useCallback((index0: number) => {
    const existing = imagesRef.current[index0];
    if (existing) return Promise.resolve(existing);
    const inflight = inflightRef.current.get(index0);
    if (inflight) return inflight;
    const manifest = manifestRef.current;
    if (!manifest) return Promise.resolve(null);
    const prefix = manifest.variants[variantRef.current].pathPrefix;
    const promise = loadImage(frameUrl(prefix, index0 + 1))
      .then((img) => {
        imagesRef.current[index0] = img;
        loadedRef.current.add(index0);
        return img;
      })
      .catch(() => null)
      .finally(() => {
        inflightRef.current.delete(index0);
      });
    inflightRef.current.set(index0, promise);
    return promise;
  }, []);

  const paint = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const pin = pinRef.current;
    if (!canvas || !pin) return;
    const img = imagesRef.current[index];
    if (!img) return;
    if (drawnIndexRef.current === index) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cssW = pin.clientWidth;
    const cssH = pin.clientHeight || window.innerHeight;
    if (!cssW || !cssH) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    drawFrame(ctx, img, cssW, cssH, dpr, fitRef.current);
    drawnIndexRef.current = index;
  }, []);

  const schedulePaintFromProgress = useCallback(
    (progress: number, notify = false) => {
      const clamped = Math.min(1, Math.max(0, progress));
      progressRef.current = clamped;
      if (notify) onProgress?.(clamped);
      // The resting hero is a real <video>. Painting frames under it at 24fps
      // is what stalled the first loops.
      if (!notify && visualRef.current !== "frames") return;
      if (paintRafRef.current) return;
      paintRafRef.current = requestAnimationFrame(() => {
        paintRafRef.current = 0;
        const scrubbing = performance.now() < scrubUntilRef.current && scrollDrivenRef.current;
        if (!scrubbing && visualRef.current !== "frames") return;
        const manifest = manifestRef.current;
        if (!manifest) return;
        const count = manifest.variants[variantRef.current].frameCount;
        const wanted = Math.min(
          count - 1,
          Math.max(0, Math.round(progressRef.current * (count - 1))),
        );
        const loaded = loadedRef.current;
        if (loaded.has(wanted)) {
          showVisual("frames");
          paint(wanted);
        } else if (scrubbing) {
          const video = videoRef.current;
          if (
            video &&
            !videoFailedRef.current &&
            Number.isFinite(video.duration) &&
            video.duration > 0
          ) {
            showVisual("video");
            const target = Math.min(progressRef.current * video.duration, video.duration - 0.05);
            if (Math.abs(video.currentTime - target) > 0.08) video.currentTime = target;
          } else {
            const idx = frameAt(wanted);
            if (idx >= 0) {
              showVisual("frames");
              paint(idx);
            }
          }
        } else {
          const idx = frameAt(wanted);
          if (idx >= 0) paint(idx);
        }

        if (!scrubbing && visualRef.current !== "frames") return;
        let start = scrubbing ? wanted : 0;
        if (!scrubbing) {
          while (start < count && loaded.has(start)) start += 1;
        }
        for (let i = start; i < Math.min(count, start + 6); i++) {
          if (loaded.has(i)) continue;
          void ensureImage(i).then((img) => {
            if (!img) return;
            const stillScrubbing =
              performance.now() < scrubUntilRef.current && scrollDrivenRef.current;
            if (!stillScrubbing && visualRef.current !== "frames") return;
            const current = Math.min(
              count - 1,
              Math.max(0, Math.round(progressRef.current * (count - 1))),
            );
            if (!loadedRef.current.has(current)) return;
            if (stillScrubbing) showVisual("frames");
            paint(current);
          });
        }
      });
    },
    [ensureImage, frameAt, onProgress, paint, showVisual],
  );

  const markScrubbing = useCallback(() => {
    scrubUntilRef.current = performance.now() + SCRUB_RESUME_MS;
  }, []);

  useLayoutEffect(() => {
    resizeCanvas();
    drawnIndexRef.current = -1;
    schedulePaintFromProgress(progressRef.current);
  }, [fit, resizeCanvas, schedulePaintFromProgress]);

  useLayoutEffect(() => {
    setReduced(prefersReducedMotion());

    const syncLayout = () => {
      const nextVariant = pickVariant(window.innerWidth);
      const nextFit = computeFrameFit(window.innerWidth, window.innerHeight);
      const variantChanged = laidOutRef.current && variantRef.current !== nextVariant;
      // ScrollTrigger moves the pinned node into a spacer. Put it back before React
      // commits a different sibling tree, or insertBefore throws NotFoundError.
      if (laidOutRef.current && fitRef.current !== nextFit) {
        stRef.current?.kill(true);
        stRef.current = null;
      }
      variantRef.current = nextVariant;
      fitRef.current = nextFit;
      laidOutRef.current = true;
      setFit((current) => (current === nextFit ? current : nextFit));
      onFit?.(nextFit);
      resizeCanvas();
      drawnIndexRef.current = -1;
      if (variantChanged) setBootGen((current) => current + 1);
    };

    syncLayout();
    window.addEventListener("resize", syncLayout);
    window.addEventListener("orientationchange", syncLayout);
    return () => {
      window.removeEventListener("resize", syncLayout);
      window.removeEventListener("orientationchange", syncLayout);
    };
  }, [onFit, resizeCanvas]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const res = await fetch("/frames/manifest.json", { cache: "force-cache" });
      if (!res.ok) throw new Error("Missing frames manifest");
      const manifest = (await res.json()) as FramesManifest;
      if (cancelled) return;
      manifestRef.current = manifest;

      const activeVariant = variantRef.current;
      const meta = manifest.variants[activeVariant];
      const count = meta.frameCount;
      const prefix = meta.pathPrefix;
      setPosterSrc(frameUrl(prefix, 1));
      setLastFrameSrc(frameUrl(prefix, count));

      const video = videoRef.current;
      if (video && !prefersReducedMotion()) {
        video.loop = true;
        if (!soundUnlockedRef.current) video.muted = true;
        if (video.src !== HERO_VIDEO_URL) video.src = HERO_VIDEO_URL;
        videoFailedRef.current = false;
      }

      imagesRef.current = Array.from({ length: count }, () => null);
      loadedRef.current = new Set();

      async function ingest(index0: number) {
        if (cancelled || loadedRef.current.has(index0)) return;
        try {
          const img = await loadImage(frameUrl(prefix, index0 + 1));
          if (cancelled) return;
          imagesRef.current[index0] = img;
          loadedRef.current.add(index0);
          if (index0 === 0) {
            resizeCanvas();
            paint(0);
            setReady(true);
            return;
          }
          if (visualRef.current !== "frames") return;
          const wanted = Math.min(
            count - 1,
            Math.max(0, Math.round(progressRef.current * (count - 1))),
          );
          if (frameAt(wanted) === index0) paint(index0);
        } catch {
          // skip failed frame
        }
      }

      await ingest(0);
      if (cancelled) return;
      setReady(true);

      if (prefersReducedMotion()) {
        await ingest(count - 1);
        paint(count - 1);
        setReady(true);
        return;
      }

      // Let the single mp4 take the connection first. Fetch the scrub frames as
      // bytes only — turning all 239 into images here decodes them on the main
      // thread and stutters the video for the first few loops.
      if (video && !videoFailedRef.current) {
        await waitForMedia(video, 8000);
        if (cancelled) return;
      }

      const pending = new Set<number>();
      let cursor = 0;
      async function worker() {
        for (;;) {
          if (cancelled) return;
          while (cursor < count && pending.has(cursor)) cursor += 1;
          if (cursor >= count) return;
          const index = cursor;
          cursor += 1;
          pending.add(index);
          try {
            await fetch(frameUrl(prefix, index + 1), { cache: "force-cache" });
          } catch {
            // scrub will retry through loadImage
          }
        }
      }

      await Promise.all([worker(), worker()]);
    }

    void boot().catch(() => {
      // Keep navy background if frames missing during local setup.
    });

    const onResize = () => {
      resizeCanvas();
      drawnIndexRef.current = -1;
      schedulePaintFromProgress(progressRef.current);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      if (paintRafRef.current) cancelAnimationFrame(paintRafRef.current);
    };
  }, [bootGen, frameAt, paint, resizeCanvas, schedulePaintFromProgress]);

  // Pin + scroll scrub
  useEffect(() => {
    if (reduced || !ready) return;
    const pin = pinRef.current;
    if (!pin) return;

    const contained = fitRef.current === "contain";
    const st = ScrollTrigger.create({
      trigger: pin,
      start: contained ? "top bottom" : "top top",
      end: contained ? "bottom top" : "+=250%",
      pin: !contained,
      pinSpacing: !contained,
      scrub: contained ? false : 0.35,
      anticipatePin: contained ? 0 : 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        // Only apply scroll-driven frames while the user is actively scrubbing
        // or while scroll progress is clearly away from the autoplay loop at rest.
        const scrubbing = performance.now() < scrubUntilRef.current;
        if (scrubbing || Math.abs(self.getVelocity()) > 8) {
          markScrubbing();
          scrollDrivenRef.current = true;
          videoRef.current?.pause();
          schedulePaintFromProgress(self.progress, true);
        }
      },
    });
    stRef.current = st;

    const onUserScrollIntent = () => markScrubbing();
    window.addEventListener("wheel", onUserScrollIntent, { passive: true });
    window.addEventListener("touchmove", onUserScrollIntent, { passive: true });
    window.addEventListener("pointerdown", onUserScrollIntent, { passive: true });

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    requestAnimationFrame(refresh);

    return () => {
      window.removeEventListener("wheel", onUserScrollIntent);
      window.removeEventListener("touchmove", onUserScrollIntent);
      window.removeEventListener("pointerdown", onUserScrollIntent);
      window.removeEventListener("load", refresh);
      st.kill();
      stRef.current = null;
    };
  }, [fit, markScrubbing, ready, reduced, schedulePaintFromProgress]);

  // Resting playback is the mp4 itself. Canvas frames are only for scroll scrub,
  // and only if the video never becomes playable.
  useEffect(() => {
    if (reduced || !ready) return;
    const manifest = manifestRef.current;
    if (!manifest) return;

    const meta = manifest.variants[variantRef.current];
    const count = meta.frameCount;
    const durationSec = Math.max(0.1, (count - 1) / meta.fps);
    const startedAt = performance.now();
    let raf = 0;
    let last = performance.now();
    let playGen = 0;
    let wasScrubbing = false;

    const seekVideo = (progress: number) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
      const target = Math.min(
        Math.max(0, progress) * video.duration,
        Math.max(0, video.duration - 0.05),
      );
      if (Math.abs(video.currentTime - target) > 0.12) video.currentTime = target;
    };

    const requestPlay = (progress: number) => {
      const video = videoRef.current;
      if (!video || videoFailedRef.current) return;
      if (!primedRef.current && !canStartSmooth(video)) return;
      if (audioStateRef.current === "starting" || audioStateRef.current === "blocked") return;
      if (!video.paused) {
        audioStateRef.current = "playing";
        return;
      }
      const gen = ++playGen;
      audioStateRef.current = "starting";
      if (!soundUnlockedRef.current) video.muted = true;
      seekVideo(progress);
      void video.play().then(
        () => {
          if (gen === playGen) audioStateRef.current = "playing";
        },
        (error: unknown) => {
          if (gen !== playGen) return;
          const name = error instanceof DOMException ? error.name : "";
          // Pause during a scroll scrub aborts play(); the gesture itself was allowed.
          if (name === "AbortError") {
            audioStateRef.current = "playing";
            return;
          }
          audioStateRef.current = "blocked";
          if (name !== "NotAllowedError") videoFailedRef.current = true;
        },
      );
    };

    const unlock = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-hero-mute]")) return;
      const video = videoRef.current;
      if (!video || videoFailedRef.current) return;
      soundUnlockedRef.current = true;
      video.muted = mutedRef.current;
      if (!video.paused) return;
      audioStateRef.current = "idle";
      requestPlay(progressRef.current);
    };

    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const scrubbing = now < scrubUntilRef.current && scrollDrivenRef.current;
      const st = stRef.current;
      const pinActive = st?.isActive ?? true;
      const video = videoRef.current;
      const videoPlaying = Boolean(
        video &&
        !videoFailedRef.current &&
        !video.paused &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA,
      );
      if (video && canStartSmooth(video)) primedRef.current = true;

      if (!pinActive) {
        if (video && !video.paused) video.pause();
      } else if (scrubbing) {
        wasScrubbing = true;
        if (video && !video.paused) video.pause();
      } else if (
        video &&
        !videoFailedRef.current &&
        primedRef.current &&
        (videoPlaying || canStartSmooth(video))
      ) {
        if (wasScrubbing) {
          wasScrubbing = false;
          audioStateRef.current = "idle";
          seekVideo(progressRef.current);
        }
        if (videoPlaying) showVisual("video");
        scrollDrivenRef.current = false;
        if (video.paused) requestPlay(progressRef.current);
        else if (video.duration > 0) progressRef.current = video.currentTime / video.duration;
      } else if (video && !videoFailedRef.current && now - startedAt < 8000) {
        showVisual("poster");
      } else {
        showVisual("frames");
        wasScrubbing = false;
        let prefix = 0;
        while (prefix < count && loadedRef.current.has(prefix)) prefix += 1;
        let next = progressRef.current + dt / durationSec;
        if (prefix >= count) {
          if (next >= 1) next -= Math.floor(next);
        } else if (prefix > 0) {
          const maxProgress = (prefix - 1) / Math.max(1, count - 1);
          if (next > maxProgress) next = maxProgress;
        } else {
          next = 0;
        }
        schedulePaintFromProgress(next);
      }

      raf = requestAnimationFrame(tick);
    };

    requestPlay(progressRef.current);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      videoRef.current?.pause();
      audioStateRef.current = "idle";
    };
  }, [ready, reduced, schedulePaintFromProgress, showVisual]);

  return (
    <div data-fit={fit} className="group/hero w-full bg-[#070D1F]">
      <div className={fit === "contain" ? "relative z-30 [&_header]:static" : "hidden"}>
        {fit === "contain" ? children : null}
      </div>
      <div
        ref={pinRef}
        className={
          fit === "cover"
            ? "relative h-dvh w-full overflow-hidden bg-[#070D1F]"
            : "relative aspect-video w-full overflow-hidden bg-[#070D1F]"
        }
      >
        {reduced ? (
          lastFrameSrc ? (
            <img src={lastFrameSrc} alt="" className="h-full w-full object-cover" />
          ) : null
        ) : (
          <>
            <video
              ref={assignVideo}
              className={`pointer-events-none absolute inset-0 h-full w-full ${
                fit === "contain" ? "object-contain" : "object-cover"
              } ${visual === "frames" ? "opacity-0" : "opacity-100"}`}
              src={HERO_VIDEO_URL}
              poster={posterSrc}
              playsInline
              loop
              preload="auto"
              aria-hidden
            />
            <img
              src={posterSrc}
              alt=""
              fetchPriority="high"
              className={`pointer-events-none absolute inset-0 h-full w-full ${
                fit === "contain" ? "object-contain" : "object-cover"
              } ${visual === "poster" ? "" : "invisible"}`}
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 block h-full w-full ${visual === "frames" ? "" : "invisible"}`}
              aria-hidden
            />
          </>
        )}
        {reduced ? null : (
          <button
            type="button"
            data-hero-mute
            onClick={() => {
              setMuted((current) => {
                const next = !current;
                mutedRef.current = next;
                soundUnlockedRef.current = true;
                const video = videoRef.current;
                if (video) {
                  video.muted = next;
                  if (!next && video.paused) void video.play();
                }
                return next;
              });
            }}
            aria-pressed={muted}
            aria-label={muted ? landingCopy.sound.unmute : landingCopy.sound.mute}
            className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#070D1F]/45 text-white shadow-card backdrop-blur-md transition hover:bg-[#070D1F]/70 sm:right-8"
          >
            {muted ? (
              <VolumeX className="h-5 w-5" aria-hidden />
            ) : (
              <Volume2 className="h-5 w-5" aria-hidden />
            )}
          </button>
        )}
        {fit === "cover" ? <EdgeFade /> : null}
        {fit === "cover" ? children : null}
      </div>
    </div>
  );
}

function EdgeFade() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#070D1F]/40 via-transparent to-[#070D1F]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#070D1F] to-transparent sm:w-36 lg:w-48" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#070D1F] to-transparent sm:w-36 lg:w-48" />
    </>
  );
}
