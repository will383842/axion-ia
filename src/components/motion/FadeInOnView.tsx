"use client";
// use-client: motion/react requires hooks (useInView) and listens for
// prefers-reduced-motion at runtime.

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

interface FadeInOnViewProps {
  children: React.ReactNode;
  /** Optional delay in ms before the fade-in begins. */
  delay?: number;
  className?: string;
}

// Fade + 8 px upward translate when entering viewport. Disabled entirely
// when prefers-reduced-motion is set (motion/react handles it natively).
export function FadeInOnView({ children, delay = 0, className }: FadeInOnViewProps) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px -10% 0px" }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}
