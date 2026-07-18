import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInView, useReducedMotion, animate } from "framer-motion";

// A calm ease-out (no overshoot/bounce) used across the site.
export const EASE = [0.22, 1, 0.36, 1];
const EASE_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";

// Longest stagger tail for a RevealGroup; keeps long articles from feeling
// sluggish while still reading as a cascade.
const MAX_STAGGER_DELAY = 0.96;

/*
 * Scroll reveals are an enhancement over an already-visible default: elements
 * render visible, and only the ones that start below the fold are hidden (in a
 * pre-paint layout effect, so nothing flashes). An IntersectionObserver then
 * plays a CSS transition the moment any part of the element scrolls near the
 * viewport. Compared to JS-driven animation this survives throttled/hidden
 * renderers, works for elements taller than the viewport, and degrades to
 * plain visible content without JS.
 */
function useReveal() {
  const ref = useRef(null);
  // "visible" (no animation) | "hidden" (below fold, waiting) | "shown" (animate in)
  const [phase, setPhase] = useState("visible");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Hidden/headless renderers freeze the animation timeline, which would
    // leave gated content invisible; skip the entrance and show everything.
    if (document.visibilityState === "hidden") return;
    // Anything already on screen at mount stays visible; no entrance.
    if (el.getBoundingClientRect().top <= window.innerHeight - 60) return;

    setPhase("hidden");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setPhase("shown");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -60px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return [ref, phase];
}

function revealStyle(phase, { y = 30, duration = 0.7, delay = 0 } = {}) {
  if (phase === "hidden") return { opacity: 0, transform: `translateY(${y}px)` };
  if (phase === "shown")
    return {
      opacity: 1,
      transform: "translateY(0px)",
      transition: `opacity ${duration}s ${EASE_CSS} ${delay}s, transform ${duration}s ${EASE_CSS} ${delay}s`,
    };
  return null;
}

// Single element that fades up as it enters the viewport (once). Headlines pass
// a larger y (40) and longer duration (0.8) for a more dramatic "arrival".
export function Reveal({
  children,
  as = "div",
  delay = 0,
  y = 30,
  duration = 0.7,
  style,
  className,
}) {
  const [ref, phase] = useReveal();
  const Tag = as;
  const anim = revealStyle(phase, { y, duration, delay });
  return (
    <Tag ref={ref} className={className} style={anim ? { ...style, ...anim } : style}>
      {children}
    </Tag>
  );
}

// Container that staggers its <RevealChild> children in as the group enters.
export function RevealGroup({ children, as = "div", stagger = 0.12, style, className }) {
  const [ref, phase] = useReveal();
  const Tag = as;
  let i = 0;
  const kids = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === RevealChild) {
      return React.cloneElement(child, {
        _phase: phase,
        _delay: Math.min(i++ * stagger, MAX_STAGGER_DELAY),
      });
    }
    return child;
  });
  return (
    <Tag ref={ref} className={className} style={style}>
      {kids}
    </Tag>
  );
}

export function RevealChild({
  children,
  as = "div",
  style,
  className,
  _phase = "visible",
  _delay = 0,
}) {
  const Tag = as;
  const anim = revealStyle(_phase, { delay: _delay });
  return (
    <Tag className={className} style={anim ? { ...style, ...anim } : style}>
      {children}
    </Tag>
  );
}

// Mount entrance for above-the-fold hero elements. CSS-driven (keyframes in
// index.css) and skipped entirely when the document loads hidden or the user
// prefers reduced motion, so content is never gated on an animation playing.
export function FadeUp({
  children,
  as = "div",
  delay = 0,
  x = 0,
  y,
  duration = 0.7,
  style,
  className,
}) {
  const [animate] = useState(
    () =>
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const Tag = as;
  const offsetY = y ?? (x ? 0 : 18);
  const anim = animate
    ? {
        "--enter-x": `${x}px`,
        "--enter-y": `${offsetY}px`,
        animation: `prism-enter ${duration}s ${EASE_CSS} ${delay}s both`,
      }
    : null;
  return (
    <Tag className={className} style={anim ? { ...style, ...anim } : style}>
      {children}
    </Tag>
  );
}

// Counts a number up from 0 to `value` when it scrolls into view.
export function CountUp({ value, duration = 1.2, format = (v) => Math.round(v) }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: "some" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);
  const numeric = typeof value === "number" && !Number.isNaN(value);

  useEffect(() => {
    if (!numeric) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(v),
    });
    // rAF can be throttled to a standstill in background/hidden renderers;
    // guarantee the final value lands by wall clock regardless.
    const settle = setTimeout(() => {
      controls.stop();
      setDisplay(value);
    }, duration * 1000 + 400);
    return () => {
      controls.stop();
      clearTimeout(settle);
    };
  }, [inView, value, reduce, duration, numeric]);

  if (!numeric) return <span ref={ref}>{value}</span>;
  return <span ref={ref}>{format(display)}</span>;
}
