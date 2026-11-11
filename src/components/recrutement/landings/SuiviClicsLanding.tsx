"use client";
// use-client: écouteur de clic délégué sur document (suivi des boutons), effet navigateur uniquement

// Mesure des clics sur les boutons des landings apporteurs (événement « Landing CTA Clicked »).
// Un seul écouteur délégué : les sections sont générées depuis les maquettes et ne portent pas de
// gestionnaire de clic. Le placement est lu dans l'adresse du bouton (`?depuis=…`) ou son ancre.
import { useEffect } from "react";

import { trackFunnel } from "@/lib/tracking";

export function SuiviClicsLanding({ landing }: { landing: string }) {
  useEffect(() => {
    const auClic = (e: MouseEvent) => {
      const cible =
        e.target instanceof Element ? e.target.closest("a.btn, a.lien-fl, a.porte") : null;
      if (!(cible instanceof HTMLAnchorElement) || !cible.closest(".lp-app")) return;
      const href = cible.getAttribute("href") ?? "";
      const depuis = /[?&]depuis=([\w-]+)/.exec(href)?.[1];
      const placement = depuis ?? (href.startsWith("#") ? href.slice(1) : "lien");
      trackFunnel("Landing CTA Clicked", { landing, placement });
    };
    document.addEventListener("click", auClic);
    return () => document.removeEventListener("click", auClic);
  }, [landing]);

  return null;
}
