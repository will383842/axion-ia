/**
 * Messages des gabarits d'articles (S2) : un fichier par gabarit et par langue
 * (`src/messages/gabarits/<code>.<langue>.json`) + `commun`, fusionnés sous
 * l'espace de noms `articleGabarits` par `request.ts`. Chaque PR de gabarit
 * n'écrit que dans ses propres fichiers (aucun conflit sur `fr.json`/`en.json`).
 * Serveur seulement : l'espace de noms n'est pas dans NAMESPACES_CLIENT.
 */
export const CODES_MESSAGES_GABARITS = [
  "commun",
  "analyse",
  "guide",
  "comparatif",
  "selection",
  "cas",
  "definition",
  "faq",
  "chiffres",
] as const;

export type CodeMessagesGabarits = (typeof CODES_MESSAGES_GABARITS)[number];

export const ESPACE_MESSAGES_GABARITS = "articleGabarits";

type LangueGabarits = "fr" | "en";

const CHARGEURS: Record<
  LangueGabarits,
  Record<CodeMessagesGabarits, () => Promise<{ default: Record<string, unknown> }>>
> = {
  fr: {
    commun: () => import("../messages/gabarits/commun.fr.json"),
    analyse: () => import("../messages/gabarits/analyse.fr.json"),
    guide: () => import("../messages/gabarits/guide.fr.json"),
    comparatif: () => import("../messages/gabarits/comparatif.fr.json"),
    selection: () => import("../messages/gabarits/selection.fr.json"),
    cas: () => import("../messages/gabarits/cas.fr.json"),
    definition: () => import("../messages/gabarits/definition.fr.json"),
    faq: () => import("../messages/gabarits/faq.fr.json"),
    chiffres: () => import("../messages/gabarits/chiffres.fr.json"),
  },
  en: {
    commun: () => import("../messages/gabarits/commun.en.json"),
    analyse: () => import("../messages/gabarits/analyse.en.json"),
    guide: () => import("../messages/gabarits/guide.en.json"),
    comparatif: () => import("../messages/gabarits/comparatif.en.json"),
    selection: () => import("../messages/gabarits/selection.en.json"),
    cas: () => import("../messages/gabarits/cas.en.json"),
    definition: () => import("../messages/gabarits/definition.en.json"),
    faq: () => import("../messages/gabarits/faq.en.json"),
    chiffres: () => import("../messages/gabarits/chiffres.en.json"),
  },
};

/** `{ articleGabarits: { commun: {…}, analyse: {…}, … } }` pour la langue demandée. */
export async function chargerMessagesGabarits(
  locale: string,
): Promise<Record<string, Record<string, unknown>>> {
  const langue: LangueGabarits = locale === "en" ? "en" : "fr";
  const entrees = await Promise.all(
    CODES_MESSAGES_GABARITS.map(
      async (code) => [code, (await CHARGEURS[langue][code]()).default] as const,
    ),
  );
  return { [ESPACE_MESSAGES_GABARITS]: Object.fromEntries(entrees) };
}
