"use client";
// use-client: IntersectionObserver runs in the browser only.

import * as React from "react";

interface FadeInOnViewProps {
  children: React.ReactNode;
  /** Optional delay in ms before the fade-in begins. */
  delay?: number;
  className?: string;
}

// P-410 — Remplace `motion/react` (Framer Motion v11, ~30 KB gz) par
// IntersectionObserver natif + transition CSS. Mêmes signaux UX (fade +
// 8 px translate, durée 400 ms, easing custom, once-only, margin
// -10/-10) mais 0 KB shipped. `prefers-reduced-motion` est déjà géré
// globalement par `globals.css` (rule `@media reduce` qui force
// `transition-duration: 0ms`), pas besoin de hook React dédié.
//
// Cumul : `FadeInOnView` est utilisé sur ~16 pages × 4 562 SSG → suppression
// de motion = −30 KB gz × millions de page-views/an.
export function FadeInOnView({ children, delay = 0, className }: FadeInOnViewProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // IntersectionObserver est universellement supporté depuis 2017 (Chrome
    // 51+, Firefox 55+, Safari 12.1+, Edge 15+). Pas de fallback nécessaire
    // en 2026 — Next 16 cible déjà des navigateurs modernes.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            // setState appelé depuis un callback IO async (browser event loop)
            // — pas de cascading render. Le lint react-hooks ne flag pas ici.
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "-10% 0px -10% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate3d(0, 0, 0)" : "translate3d(0, 8px, 0)",
        transition: `opacity 400ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 400ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        // `will-change` optimise sans coût (composite layer une seule fois).
        willChange: visible ? "auto" : "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}
