// Page de remerciement (lot S2) : elle affiche le merci ELLE-MÊME (la route d'envoi ne fait que
// rediriger, 303). Même réponse que l'envoi ait créé une demande, rejoué un jeton ou écarté une
// adresse opposée : rien ne dit lequel. Éteinte → 404.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageGuideReseauActive } from "@/server/guides-reseau/config";
import { TEXTES_PAGE_GUIDE as T } from "../textes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Merci — Axion-IA",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function MerciGuide() {
  if (!pageGuideReseauActive()) notFound();
  return (
    <>
      <h1 className="text-[28px] leading-tight font-semibold">{T.merciTitre}</h1>
      <p className="mt-4 text-[17px] leading-relaxed">{T.merciCorps}</p>
    </>
  );
}
