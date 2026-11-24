"use client";

import { useCallback, useState } from "react";
import { FrameSequence, type FrameFit } from "../components/landing/FrameSequence";
import { LandingCta } from "../components/landing/LandingCta";
import { LandingHeader } from "../components/landing/LandingHeader";
import { ScrollHint } from "../components/landing/LandingOverlays";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [heroFit, setHeroFit] = useState<FrameFit>("cover");

  const onProgress = useCallback((value: number) => {
    if (value > 0.02) setScrolled(true);
  }, []);

  const onFit = useCallback((next: FrameFit) => {
    setHeroFit((current) => (current === next ? current : next));
  }, []);

  return (
    <div data-hero={heroFit} className="overflow-x-clip bg-[#F6F7FB] text-primary">
      <FrameSequence onProgress={onProgress} onFit={onFit}>
        <LandingHeader overlay={heroFit === "cover"} />
        {heroFit === "cover" ? <ScrollHint hidden={scrolled} /> : null}
      </FrameSequence>
      <LandingCta />
    </div>
  );
}
