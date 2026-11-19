/**
 * Les entrées « Nos prestations » de l'en-tête, du tiroir mobile et du pied de page.
 *
 * Refonte en-tête/pied du 2026-11-11, d'après la maquette validée par Williams
 * (`_chantier-entete-pied/maquette-entete-pied.html`, branche
 * `chantier/entete-pied-maquette`). Une seule liste, lue par les trois surfaces :
 * l'ordre suit le chemin « on chiffre, on forme, on met en place », puis le
 * coaching et les sites web.
 *
 * 🔑 Les `href` viennent du SSOT `src/content/services.ts` (par identifiant) : une
 * route renommée là-bas suit ici sans retouche. Les LIBELLÉS, eux, sont ceux de la
 * maquette, et non `serviceOfficial()` : le nom officiel « Sites web & SaaS IA »
 * porte « SaaS », mot que la charte proscrit dans l'en-tête et le pied
 * (`entete-pied-refonte.spec.ts` le vérifie). « Coaching IA » est la troncature
 * `navShortFr` déjà employée par l'en-tête.
 *
 * Aucun prix ici : le seul montant de l'en-tête est celui de la Journée IA, lu dans
 * `pricing.ts` par `Header.tsx`.
 */
import { SERVICES, type ServiceId } from "@/content/services";

export type IconePrestation = "audit" | "formations" | "implementation" | "coaching" | "web";

export interface EntreePrestation {
  id: ServiceId;
  href: string;
  labelFr: string;
  labelEn: string;
  descriptionFr: string;
  descriptionEn: string;
  icone: IconePrestation;
}

function hrefDe(id: ServiceId): string {
  const service = SERVICES.find((s) => s.id === id);
  if (!service) throw new Error(`Service inconnu dans la navigation : ${id}`);
  return service.href;
}

export const PRESTATIONS_NAV: readonly EntreePrestation[] = [
  {
    id: "audit",
    href: hrefDe("audit"),
    labelFr: "Audit IA",
    labelEn: "AI audit",
    descriptionFr: "Où vous perdez du temps et de l’argent, chiffré avec vos équipes.",
    descriptionEn: "Where you lose time and money, quantified with your teams.",
    icone: "audit",
  },
  {
    id: "formations",
    href: hrefDe("formations"),
    labelFr: "Formations IA",
    labelEn: "AI training",
    descriptionFr: "Vos équipes formées sur leurs propres dossiers, dans vos locaux.",
    descriptionEn: "Your teams trained on their own files, at your premises.",
    icone: "formations",
  },
  {
    id: "implementation",
    href: hrefDe("implementation"),
    labelFr: "Implémentation IA",
    labelEn: "AI implementation",
    descriptionFr: "Vos tâches répétitives préparées pour vous, chaque jour. Vous validez.",
    descriptionEn: "Your repetitive tasks prepared for you, every day. You approve.",
    icone: "implementation",
  },
  {
    id: "unAUn",
    href: hrefDe("unAUn"),
    labelFr: "Coaching IA",
    labelEn: "AI coaching",
    descriptionFr: "Un dirigeant ou un collaborateur suivi en tête-à-tête.",
    descriptionEn: "A manager or an employee coached one to one.",
    icone: "coaching",
  },
  {
    id: "sitesWeb",
    href: hrefDe("sitesWeb"),
    labelFr: "Sites web IA",
    labelEn: "AI websites",
    descriptionFr: "Votre site, avec un assistant qui répond à vos clients, même le soir.",
    descriptionEn: "Your website, with an assistant that answers your clients, even at night.",
    icone: "web",
  },
];

/**
 * La page qui explique l'obligation de formation à l'IA (AI Act, art. 4).
 *
 * Elle vit aujourd'hui dans la FAQ (`/faq/[slug]`, entrée `ai-act-2026` de
 * `src/content/transversal.ts`). Le jour où la page dédiée annoncée par Williams
 * existe, c'est ce seul `href` qui change.
 */
export const AI_ACT_NAV = {
  href: "/faq/ai-act-2026",
  labelFr: "Former vos équipes à l’IA (AI Act)",
  labelEn: "Train your teams in AI (AI Act)",
  descriptionFr: "Ce que l’article 4 du règlement européen sur l’IA demande aux entreprises.",
  descriptionEn: "What Article 4 of the EU AI regulation requires of companies.",
} as const;
