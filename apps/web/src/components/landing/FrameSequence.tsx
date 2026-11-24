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
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${url}`));
    img.src = url;
  });
}

const SCRUB_RESUME_MS = 700;
const DEFAULT_SOUNDTRACK = "/video/aida.mp4";

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
  const drawnIndexRef = useRef(-1);
  const paintRafRef = useRef(0);
  const progressRef = useRef(0);
  const variantRef = useRef<VariantId>("desktop");
  const fitRef = useRef<FrameFit>("cover");
  const manifestRef = useRef<FramesManifest | null>(null);
  const scrubUntilRef = useRef(0);
  const stRef = useRef<ScrollTrigger | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioStateRef = useRef<"idle" | "starting" | "blocked" | "playing">("idle");
  const scrollDrivenRef = useRef(false);
  const mutedRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const [lastFrameSrc, setLastFrameSrc] = useState<string | null>(null);
  const [fit, setFit] = useState<FrameFit>("cover");
  const [bootGen, setBootGen] = useState(0);
  const laidOutRef = useRef(false);

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

  const nearestLoaded = useCallback((wanted: number) => {
    const loaded = loadedRef.current;
    if (loaded.has(wanted)) return wanted;
    let best = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const idx of loaded) {
      const dist = Math.abs(idx - wanted);
      if (dist < bestDist) {
        bestDist = dist;
        best = idx;
      }
    }
    return best;
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
      if (paintRafRef.current) return;
      paintRafRef.current = requestAnimationFrame(() => {
        paintRafRef.current = 0;
        const manifest = manifestRef.current;
        if (!manifest) return;
        const count = manifest.variants[variantRef.current].frameCount;
        const wanted = Math.min(
          count - 1,
          Math.max(0, Math.round(progressRef.current * (count - 1))),
        );
        const idx = nearestLoaded(wanted);
        if (idx >= 0) paint(idx);
      });
    },
    [nearestLoaded, onProgress, paint],
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

      const soundtrack = audioRef.current;
      if (soundtrack) {
        soundtrack.src = manifest.source || DEFAULT_SOUNDTRACK;
        soundtrack.loop = true;
        soundtrack.muted = mutedRef.current;
      }

      const activeVariant = variantRef.current;
      const meta = manifest.variants[activeVariant];
      const count = meta.frameCount;
      const prefix = meta.pathPrefix;
      setLastFrameSrc(frameUrl(prefix, count));

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
          } else {
            const wanted = Math.min(
              count - 1,
              Math.max(0, Math.round(progressRef.current * (count - 1))),
            );
            if (nearestLoaded(wanted) === index0) paint(index0);
          }
        } catch {
          // skip failed frame
        }
      }

      await ingest(0);
      if (cancelled) return;

      if (prefersReducedMotion()) {
        await ingest(count - 1);
        paint(count - 1);
        setReady(true);
        return;
      }

      const stride = 8;
      const coarse: number[] = [];
      for (let i = stride; i < count; i += stride) coarse.push(i);
      if (!coarse.includes(count - 1)) coarse.push(count - 1);
      await Promise.all(coarse.map((i) => ingest(i)));
      if (cancelled) return;

      const rest: number[] = [];
      for (let i = 1; i < count; i++) {
        if (!loadedRef.current.has(i)) rest.push(i);
      }
      const batch = 12;
      for (let i = 0; i < rest.length; i += batch) {
        if (cancelled) return;
        await Promise.all(rest.slice(i, i + batch).map((idx) => ingest(idx)));
      }
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
  }, [bootGen, nearestLoaded, paint, resizeCanvas, schedulePaintFromProgress]);

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

  // Autoplay loop — runs when not scrubbing and pin section is in view.
  // The soundtrack is the clock once the browser allows playback; frames keep
  // advancing on their own until then.
  useEffect(() => {
    if (reduced || !ready) return;
    const manifest = manifestRef.current;
    if (!manifest) return;

    const meta = manifest.variants[variantRef.current];
    const durationSec = Math.max(0.1, (meta.frameCount - 1) / meta.fps);
    let raf = 0;
    let last = performance.now();
    let playGen = 0;

    const seekAudio = (progress: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const target = Math.min(
        Math.max(0, progress) * audio.duration,
        Math.max(0, audio.duration - 0.05),
      );
      if (Math.abs(audio.currentTime - target) > 0.12) {
        audio.currentTime = target;
      }
    };

    const requestPlay = (progress: number) => {
      const audio = audioRef.current;
      if (!audio || audioStateRef.current === "starting" || audioStateRef.current === "blocked")
        return;
      if (!audio.paused && audioStateRef.current === "playing") return;
      const gen = ++playGen;
      audioStateRef.current = "starting";
      seekAudio(progress);
      void audio.play().then(
        () => {
          if (gen === playGen) audioStateRef.current = "playing";
        },
        (error: unknown) => {
          if (gen !== playGen) return;
          const name = error instanceof DOMException ? error.name : "";
          // Pause during a scroll scrub aborts play(); the gesture itself was allowed.
          audioStateRef.current = name === "AbortError" ? "playing" : "blocked";
        },
      );
    };

    const unlock = () => {
      const audio = audioRef.current;
      if (!audio || (!audio.paused && audioStateRef.current === "playing")) return;
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
      const audio = audioRef.current;
      const audioClock =
        audio && !audio.paused && Number.isFinite(audio.duration) && audio.duration > 0;

      if (!pinActive) {
        if (audio && !audio.paused) audio.pause();
      } else if (scrubbing) {
        if (audio && !audio.paused) audio.pause();
      } else if (audioClock && audio) {
        scrollDrivenRef.current = false;
        schedulePaintFromProgress(audio.currentTime / audio.duration);
      } else {
        let next = progressRef.current + dt / durationSec;
        if (next >= 1) next -= Math.floor(next);
        schedulePaintFromProgress(next);
        if (
          audioStateRef.current === "idle" ||
          (audioStateRef.current === "playing" && audio?.paused)
        ) {
          scrollDrivenRef.current = false;
          requestPlay(next);
        }
      }

      raf = requestAnimationFrame(tick);
    };

    requestPlay(progressRef.current);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      audioRef.current?.pause();
      audioStateRef.current = "idle";
    };
  }, [ready, reduced, schedulePaintFromProgress]);

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
          <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden />
        )}
        <audio ref={audioRef} preload="auto" loop hidden muted={muted} />
        {reduced ? null : (
          <button
            type="button"
            onClick={() => {
              setMuted((current) => {
                const next = !current;
                mutedRef.current = next;
                if (audioRef.current) audioRef.current.muted = next;
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
