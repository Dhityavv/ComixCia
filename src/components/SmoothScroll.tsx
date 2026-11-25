'use client';

import { useEffect, useState } from 'react';
import { ReactLenis, useLenis } from 'lenis/react';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function ScrollTriggerSync() {
  useLenis(() => {
    ScrollTrigger.update();
  });

  useEffect(() => {
    ScrollTrigger.refresh();
  }, []);

  return null;
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [enableLenis, setEnableLenis] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const isMobileOrLowEnd =
        window.innerWidth < 1024 ||
        (typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 8) <= 4) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setEnableLenis(!isMobileOrLowEnd);
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  if (!enableLenis) {
    return <>{children}</>;
  }

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.12,
        duration: 0.85,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.2,
      }}
    >
      <ScrollTriggerSync />
      {children}
    </ReactLenis>
  );
}
