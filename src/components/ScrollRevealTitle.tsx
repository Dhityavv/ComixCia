'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ScrollRevealTitleProps {
  text: string;
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

export function ScrollRevealTitle({
  text,
  as = 'h2',
  className = '',
}: ScrollRevealTitleProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const words = text.trim().split(/\s+/);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mm = gsap.matchMedia();
    mm.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        normal: '(prefers-reduced-motion: no-preference)',
      },
      (context) => {
        const reduceMotion = context.conditions?.reduceMotion;
        const wordEls = el.querySelectorAll<HTMLElement>('.sr-word');
        if (!wordEls.length) return;

        if (reduceMotion) {
          gsap.set(wordEls, { yPercent: 0, autoAlpha: 1 });
          return;
        }

        gsap.fromTo(
          wordEls,
          { yPercent: 100, autoAlpha: 0 },
          {
            yPercent: 0,
            autoAlpha: 1,
            duration: 0.55,
            ease: 'power3.out',
            stagger: 0.045,
            clearProps: 'transform',
            scrollTrigger: {
              trigger: el,
              start: 'top 92%',
              once: true,
            },
          }
        );
      }
    );

    return () => {
      mm.revert();
    };
  }, [text]);

  const Tag = as;

  return (
    <Tag ref={containerRef} className={className}>
      {words.map((word, idx) => (
        <span key={`${word}-${idx}`} className="inline-block overflow-hidden align-bottom mr-[0.26em] last:mr-0">
          <span className="sr-word inline-block will-change-transform">{word}</span>
        </span>
      ))}
    </Tag>
  );
}
