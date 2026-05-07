// Server Component — schéma visuel du hero /centre-aide.
// Variante constellation : 6 thématiques d'aide groupées autour d'un
// centre éditorial (« Trouver une réponse »), avec icône et label par
// thématique. Pattern compact en 2 colonnes (3 cards par côté), évoque
// une arborescence d'aide sans la lourdeur orbital SVG.

import type { ReactNode } from "react";
import {
  HelpCircle,
  Compass,
  ShieldCheck,
  Wallet,
  Sparkles,
  GraduationCap,
  Network,
} from "lucide-react";

export interface HelpHeroSchemaProps {
  isFr: boolean;
  ariaLabel: string;
  className?: string;
}

export function HelpHeroSchema({ isFr, ariaLabel, className }: HelpHeroSchemaProps): ReactNode {
  const topics = isFr
    ? [
        { icon: Compass, label: "Démarrer", detail: "Par où commencer une démarche IA." },
        { icon: ShieldCheck, label: "Souveraineté", detail: "Hébergement UE et données." },
        { icon: Wallet, label: "Coûts & ROI", detail: "Combien ça coûte, ce que ça rapporte." },
        { icon: Sparkles, label: "Cas d'usage", detail: "Ce qu'on peut concrètement faire." },
        { icon: GraduationCap, label: "Formation", detail: "Monter en compétence en interne." },
        { icon: Network, label: "Intégration", detail: "Connecter l'IA à vos outils." },
      ]
    : [
        { icon: Compass, label: "Get started", detail: "Where to begin an AI initiative." },
        { icon: ShieldCheck, label: "Sovereignty", detail: "EU hosting and data handling." },
        { icon: Wallet, label: "Costs & ROI", detail: "What it costs, what it brings in." },
        { icon: Sparkles, label: "Use cases", detail: "What we can actually do." },
        { icon: GraduationCap, label: "Training", detail: "Build skills in-house." },
        { icon: Network, label: "Integration", detail: "Connect AI to your tools." },
      ];

  return (
    <div role="img" aria-label={ariaLabel} className={className ?? "hero-schema"}>
      {/* CENTRE éditorial — Trouver une réponse */}
      <div className="border-terracotta/40 bg-paper shadow-card relative mb-4 rounded-2xl border-2 p-4 text-center sm:p-5">
        <p className="text-terracotta-deep mb-2 text-[10px] font-semibold tracking-[0.18em] uppercase sm:text-[11px]">
          <span
            aria-hidden="true"
            className="bg-terracotta mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
          />
          {isFr ? "Centre d'aide" : "Help center"}
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <HelpCircle aria-hidden="true" className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <p
            className="text-fg text-xl leading-tight font-medium tracking-tight italic sm:text-2xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Trouver une réponse" : "Find an answer"}
          </p>
        </div>
      </div>

      {/* Grille 6 thématiques — 2 cols × 3 rows */}
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {topics.map((t) => {
          const Icon = t.icon;
          return (
            <li
              key={t.label}
              className="border-border-strong bg-paper shadow-subtle flex items-start gap-2.5 rounded-lg border p-3"
            >
              <span className="bg-sand text-fg-soft flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <p className="text-fg text-[13.5px] leading-tight font-bold">{t.label}</p>
                <p className="text-fg-soft mt-0.5 text-[12px] leading-snug">{t.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
