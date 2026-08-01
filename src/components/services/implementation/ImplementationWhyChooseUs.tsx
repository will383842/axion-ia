/**
 * ImplementationWhyChooseUs — « Pourquoi travailler avec nous » : 4 raisons en
 * cartes statiques (zéro JS, best Web Vitals). Calqué sur AuditWhyChooseUs.
 * Raisons originales et VÉRIDIQUES (pas de chiffres inventés).
 *
 * Server Component pur, zéro JS. Aucun prix. Tokens uniquement. FR canonique —
 * EN = miroir (locale 301→FR, règle Will 2026-05-16).
 */

import type { ReactNode } from "react";
import {
  Code2,
  Unlock,
  Workflow,
  ShieldCheck,
  MapPin,
  ScrollText,
  ServerCog,
  FileCode2,
  type LucideIcon,
} from "lucide-react";
import { Section } from "@/components/layout/Section";

interface Reason {
  readonly icon: LucideIcon;
  readonly titleFr: string;
  readonly titleEn: string;
  readonly bodyFr: string;
  readonly bodyEn: string;
}

const REASONS: ReadonlyArray<Reason> = [
  {
    icon: Code2,
    titleFr: "Du vrai code, à vous",
    titleEn: "Real code, yours",
    bodyFr:
      "Pas de no-code fragile (Zapier, Make, n8n) : du code sur-mesure, livré dans vos comptes et votre infrastructure. Si vous nous quittez, tout continue de tourner.",
    bodyEn:
      "No brittle no-code (Zapier, Make, n8n): custom code, delivered into your accounts and infrastructure. If you leave us, everything keeps running.",
  },
  {
    icon: Unlock,
    titleFr: "Sans abonnement",
    titleEn: "No subscription",
    bodyFr:
      "Vous payez une fois, c'est à vous. Aucune redevance ne tourne en arrière-plan, aucune maintenance imposée.",
    bodyEn: "You pay once, it's yours. No fee runs in the background, no imposed maintenance.",
  },
  {
    icon: Workflow,
    titleFr: "Toute la chaîne IA",
    titleEn: "The whole AI chain",
    bodyFr:
      "De l'audit à l'implémentation jusqu'au suivi : un seul interlocuteur qui maîtrise toute la chaîne, du diagnostic à l'exécution.",
    bodyEn:
      "From audit to implementation to follow-up: a single partner who masters the whole chain, from diagnosis to delivery.",
  },
  {
    icon: ShieldCheck,
    titleFr: "Sur-mesure & robuste",
    titleEn: "Custom & robust",
    bodyFr:
      "Branché sur vos outils existants (CRM, ERP, e-mail), conçu pour durer. On vise la fiabilité, pas le bricolage qui casse au premier imprévu.",
    bodyEn:
      "Wired into your existing tools (CRM, ERP, email), built to last. We aim for reliability, not tinkering that breaks at the first hiccup.",
  },
];

const PILLS: ReadonlyArray<{ icon: LucideIcon; fr: string; en: string }> = [
  { icon: ServerCog, fr: "Hébergement UE", en: "EU hosting" },
  { icon: ScrollText, fr: "Conforme RGPD & AI Act", en: "GDPR & AI Act ready" },
  { icon: MapPin, fr: "Partout en France", en: "Across France" },
  { icon: FileCode2, fr: "Code & doc livrés", en: "Code & docs delivered" },
];

export interface ImplementationWhyChooseUsProps {
  readonly isFr: boolean;
}

export function ImplementationWhyChooseUs({ isFr }: ImplementationWhyChooseUsProps): ReactNode {
  return (
    <Section
      tone="halo-warm"
      eyebrow={isFr ? "Pourquoi nous choisir" : "Why choose us"}
      title={isFr ? "Quatre raisons" : "Four reasons"}
      titleEm={
        isFr ? "de nous confier votre implémentation" : "to trust us with your implementation"
      }
      titleTail="."
      description={
        isFr
          ? "Ce qui nous distingue d'une agence classique comme d'un assemblage no-code : du code qui vous appartient, sans abonnement, et toute la chaîne IA maîtrisée de bout en bout."
          : "What sets us apart from a classic agency and from a no-code stack alike: code you own, no subscription, and the whole AI chain mastered end to end."
      }
    >
      <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
        {REASONS.map((r, idx) => {
          const Icon = r.icon;
          return (
            <li
              key={r.titleFr}
              className="bg-paper border-border shadow-subtle hover:border-terracotta/50 hover:shadow-card flex h-full flex-col rounded-3xl border p-6 transition sm:p-7"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="bg-terracotta-soft text-terracotta-deep flex h-12 w-12 items-center justify-center rounded-2xl">
                  <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <span
                  aria-hidden="true"
                  // 🔴 `/40` donnait le rose e0b2a2 sur blanc, soit 1,89:1 — sous le seuil
                  // AA de 3:1 applicable au texte large (32 px). `aria-hidden` masque
                  // le numéro aux lecteurs d'écran mais ne le retire pas de l'écran :
                  // le contraste reste dû à tous ceux qui le voient. `/70` mesure
                  // 3,30:1 et garde l'effet estompé.
                  className="text-terracotta/70 text-3xl font-medium tabular-nums"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="text-fg text-lg leading-tight font-semibold tracking-tight">
                {isFr ? r.titleFr : r.titleEn}
              </h3>
              <p className="text-fg-soft mt-3 text-[14px] leading-relaxed">
                {isFr ? r.bodyFr : r.bodyEn}
              </p>
            </li>
          );
        })}
      </ul>

      {/* Barre de réassurance */}
      <ul className="mt-12 flex list-none flex-wrap justify-center gap-3 p-0">
        {PILLS.map((p) => {
          const Icon = p.icon;
          return (
            <li
              key={p.fr}
              className="border-terracotta/30 bg-paper text-terracotta-deep inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-semibold"
            >
              <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
              {isFr ? p.fr : p.en}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
