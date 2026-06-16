import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion, animate } from "framer-motion";

// A calm ease-out (no overshoot/bounce) used across the site.
export const EASE = [0.22, 1, 0.36, 1];

// Variants for a staggered group: parent orchestrates, children fade-up.
export const groupVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

// Single element that fades up as it enters the viewport (once).
export function Reveal({
  children,
  as = "div",
  delay = 0,
  y = 24,
  amount = 0.2,
  style,
  className,
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as] || motion.div;
  if (reduce) {
    const Plain = as;
    return (
      <Plain style={style} className={className}>
        {children}
      </Plain>
    );
  }
  return (
    <Tag
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

// Container that staggers its <RevealChild> children in as the group enters.
export function RevealGroup({ children, as = "div", amount = 0.2, style, className }) {
  const reduce = useReducedMotion();
  const Tag = motion[as] || motion.div;
  if (reduce) {
    const Plain = as;
    return (
      <Plain style={style} className={className}>
        {children}
      </Plain>
    );
  }
  return (
    <Tag
      className={className}
      style={style}
      variants={groupVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </Tag>
  );
}

export function RevealChild({ children, as = "div", style, className }) {
  const reduce = useReducedMotion();
  const Tag = motion[as] || motion.div;
  if (reduce) {
    const Plain = as;
    return (
      <Plain style={style} className={className}>
        {children}
      </Plain>
    );
  }
  return (
    <Tag className={className} style={style} variants={itemVariants}>
      {children}
    </Tag>
  );
}

// Counts a number up from 0 to `value` when it scrolls into view.
export function CountUp({ value, duration = 1.2, format = (v) => Math.round(v) }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
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
    return () => controls.stop();
  }, [inView, value, reduce, duration, numeric]);

  if (!numeric) return <span ref={ref}>{value}</span>;
  return <span ref={ref}>{format(display)}</span>;
}
