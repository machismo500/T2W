"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

/**
 * Animates a number from its previous value to the new `value`. Only animates
 * when the element is actually on-screen, to avoid surprise jumps on tab focus.
 */
export function CountUp({ value, duration = 1200, format, className }: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const fromRef = useRef(0);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    const run = () => {
      if (hasAnimatedRef.current && value === fromRef.current) return;
      const from = fromRef.current;
      const to = value;
      if (from === to) {
        setDisplay(to);
        return;
      }
      const start = performance.now();
      let raf = 0;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - t, 3);
        const next = Math.round(from + (to - from) * eased);
        setDisplay(next);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      hasAnimatedRef.current = true;
      fromRef.current = to;
      return () => cancelAnimationFrame(raf);
    };

    // Use IntersectionObserver so the count only triggers when visible
    let rafCleanup: (() => void) | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            rafCleanup = run() ?? undefined;
            observer.disconnect();
          }
        });
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      rafCleanup?.();
    };
  }, [value, duration]);

  return <span ref={ref} className={className}>{format ? format(display) : display.toLocaleString()}</span>;
}
