// Server Component — panneau de réassurance de la home (sécurité / résultats /
// accompagnement).
//
// Refonte Will 2026-08-10 : les 3 signaux étaient posés à plat sur l'ivoire de
// la page, en icône + 2 lignes, sans aucune rupture visuelle — « pas assez
// moderne ». Ils passent dans un panneau mocha pleine largeur.
//
// La mise en forme du panneau vit dans `DarkTriadPanel` (composant partagé,
// extrait le 2026-08-10 pour servir aussi /methodologie). Ce fichier ne porte
// plus que le CONTENU propre à l'accueil.

import { Shield, TrendingUp, Clock } from "lucide-react";

import { DarkTriadPanel } from "@/components/marketing/DarkTriadPanel";

const SIGNALS = [
  {
    Icon: Shield,
    titleFr: "Sécurité & confidentialité",
    titleEn: "Security & confidentiality",
    descFr: "Vos données sont protégées. Votre confidentialité est notre priorité.",
    descEn: "Your data is protected. Confidentiality is our priority.",
  },
  {
    Icon: TrendingUp,
    titleFr: "Résultats mesurables",
    titleEn: "Measurable results",
    descFr: "Des objectifs clairs, des indicateurs précis, un impact concret.",
    descEn: "Clear goals, precise indicators, concrete impact.",
  },
  {
    Icon: Clock,
    titleFr: "Accompagnement dans la durée",
    titleEn: "Long-term support",
    descFr: "Un partenaire fiable, présent à chaque étape de votre croissance.",
    descEn: "A reliable partner at every stage of your growth.",
  },
] as const;

export function TrustSignalsPanel({ isFr }: { isFr: boolean }) {
  return (
    <DarkTriadPanel
      items={SIGNALS.map((s) => ({
        Icon: s.Icon,
        title: isFr ? s.titleFr : s.titleEn,
        description: isFr ? s.descFr : s.descEn,
      }))}
    />
  );
}
