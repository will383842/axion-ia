"use client";
// use-client: requires window scroll listener — must run on the client.

import { useEffect, useRef } from "react";

interface HeaderScrollAwareProps {
  children: React.ReactNode;
}

// Wrapper qui ajoute `data-scrolled="true"` sur le <header> enfant quand
// scrollY dépasse 20px. Permet au Header (Server Component) de styliser
// différemment top vs scrolled via Tailwind variants `[data-scrolled='true']:…`.
// Pas d'état React → pas de re-render, juste mutation DOM directe (perf).
export function HeaderScrollAware({ children }: HeaderScrollAwareProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current?.firstElementChild as HTMLElement | null;
    if (!node) return;

    const apply = () => {
      const scrolled = window.scrollY > 20;
      if (scrolled) node.setAttribute("data-scrolled", "true");
      else node.removeAttribute("data-scrolled");
    };

    apply();
    window.addEventListener("scroll", apply, { passive: true });
    return () => window.removeEventListener("scroll", apply);
  }, []);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
