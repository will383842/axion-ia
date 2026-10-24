/**
 * Banque d'experts INTERNES Axion-IA (refonte templates 2026-06-22).
 *
 * Source des « avis d'expert » (levier AEO/E-E-A-T le plus fort, +41 % de
 * visibilité IA) rendus par `<ArticleExpertQuote>`. Décision Will : experts
 * INTERNES uniquement (jamais d'expert tiers fabriqué par le LLM).
 *
 * GARANTIE ANTI-FABRICATION : le nom + le titre de l'expert sont FIXÉS ici par
 * `buildExpertQuote` et passés au rendu. Le LLM ne rédige QUE le texte de la
 * prise de position (`expertTake`), jamais le nom — un éventuel nom renvoyé par
 * le LLM est purement et simplement IGNORÉ (jamais lu). On ne met donc jamais
 * de mots dans la bouche d'une personne fictive ou tierce.
 *
 * Depuis le 24/10/2026 (lot L3), l'avis n'est plus signé d'une personne mais de
 * « Point de vue d'Axion-IA » (`SIGNATURE_AVIS`) ; `ArticleExpertQuote` n'émet
 * plus de nœud `Person` pour l'avis. Les experts ci-dessous servent au routage
 * du sujet et aux pages /equipe, pas à la signature.
 * Manon a une page dédiée `/equipe/manon` (AuthorProfile) ; Williams a SA page
 * d'autorité `/equipe/williams` (statique, `williams-person.ts`).
 *
 * Doctrine nommage fondateur (cf. `FOUNDER`, lib/brand.ts) : `displayName`
 * (« Williams ») pour l'affichage figcaption ; `name` (= nom complet «
 * Williams Jullin ») pour le nœud Person structuré + le routage. Pour Manon
 * (persona), les deux sont identiques.
 *
 * Extensible : ajouter un expert = une entrée dans `INTERNAL_EXPERTS`.
 * 2026-06-22 : Manon + Williams (d'autres experts plus tard, décision Will).
 */

import { FOUNDER } from "@/lib/brand";

export interface InternalExpert {
  /** Clé stable (= slug page /equipe). */
  readonly key: string;
  /** Nom canonique / structuré (JSON-LD `Person.name`) + clé de routage. */
  readonly name: string;
  /** Nom affiché dans la citation (figcaption). Doctrine `FOUNDER.displayName`. */
  readonly displayName: string;
  /** Fonction affichée (jobTitle). */
  readonly title: string;
  /** Domaines d'expertise — servent au routage déterministe de l'expert. */
  readonly domains: ReadonlyArray<string>;
}

export const INTERNAL_EXPERTS: ReadonlyArray<InternalExpert> = [
  {
    key: "manon",
    name: "Manon",
    displayName: "Manon",
    title: "Experte IA chez Axion-IA",
    domains: [
      "ia",
      "intelligence artificielle",
      "automatisation",
      "agents",
      "formation",
      "contenu",
      "productivite",
      "outils",
      "general",
    ],
  },
  {
    key: "williams",
    // Nom complet = entité structurée (cohérent avec `/equipe/williams#person`) ;
    // displayName = affichage UI. Dérivés du SSOT `FOUNDER`.
    name: FOUNDER.fullName,
    displayName: FOUNDER.displayName,
    title: "Fondateur d'Axion-IA",
    domains: [
      "strategie",
      "dirigeant",
      "transformation",
      "vision",
      "roi",
      "audit",
      "gouvernance",
      "conduite du changement",
    ],
  },
] as const;

const MANON = INTERNAL_EXPERTS.find((e) => e.key === "manon") as InternalExpert;
const WILLIAMS = INTERNAL_EXPERTS.find((e) => e.key === "williams") as InternalExpert;

/**
 * Choisit DÉTERMINISTIQUEMENT l'expert interne le plus pertinent pour un
 * contenu. Williams (fondateur) pour les sujets stratégie / dirigeant / audit /
 * ROI / transformation ou les audiences ETI/grande entreprise ; Manon (experte
 * IA éditoriale) par défaut pour tout le reste.
 */
export function pickInternalExpert(opts: {
  readonly contentType?: string | undefined;
  readonly templateVariant?: string | undefined;
  readonly audienceSize?: string | undefined;
  readonly topic?: string | undefined;
}): InternalExpert {
  const signal =
    `${opts.contentType ?? ""} ${opts.templateVariant ?? ""} ${opts.topic ?? ""}`.toLowerCase();
  const strategicSignal =
    /dirigeant|strateg|audit|transformation|\broi\b|vision|gouvernance|calculator|comit/.test(
      signal,
    );
  const strategicAudience =
    opts.audienceSize === "ETI" || opts.audienceSize === "GRANDE_ENTREPRISE";
  return strategicSignal || strategicAudience ? WILLIAMS : MANON;
}

/**
 * Clé (= slug `/equipe/<key>`) d'un expert à partir de son nom affiché.
 * Sert à relier l'avis d'expert rendu à une entité Person (@id). `null` si le
 * nom n'est pas un expert interne connu → aucun @id émis (jamais d'entité
 * inventée).
 */
export function expertKeyFromName(name: string): string | null {
  const n = name.trim().toLowerCase();
  // Matche le nom canonique OU le displayName : robuste aux valeurs DB historiques
  // (« Williams Jullin ») comme au displayName (« Williams »).
  const found = INTERNAL_EXPERTS.find(
    (e) => e.name.toLowerCase() === n || e.displayName.toLowerCase() === n,
  );
  return found ? found.key : null;
}

/** Expert interne par clé/slug (`null` si inconnu). */
export function expertByKey(key: string): InternalExpert | null {
  return INTERNAL_EXPERTS.find((e) => e.key === key) ?? null;
}

/**
 * Signature des avis d'expert (audit blog/RAG du 24/10/2026, lot L3).
 *
 * Une prise de position écrite par un modèle de langage ne doit JAMAIS porter le
 * nom d'une personne : ce serait mettre des mots dans la bouche de Williams ou
 * de Manon, donc une fausse preuve. L'avis est signé de la marque, au pluriel
 * de voix, et le rendu (`ArticleExpertQuote`) applique la même règle aux
 * anciennes lignes déjà en base, sans les modifier.
 */
export const SIGNATURE_AVIS = {
  name: "Axion-IA",
  title: "Point de vue d'Axion-IA",
} as const;

/**
 * Construit l'`expertQuote` final à partir du texte rédigé par le LLM.
 * La signature est TOUJOURS « Point de vue d'Axion-IA » (jamais une personne,
 * jamais le LLM). L'expert choisi par `pickInternalExpert` reste accepté pour ne
 * pas changer les appels des générateurs : il oriente le sujet, pas la signature.
 * Retourne `undefined` si le texte est vide → le bloc ne se rend pas (CLS=0).
 */
export function buildExpertQuote(
  _expert: InternalExpert,
  take: string | null | undefined,
): { readonly name: string; readonly title: string; readonly text: string } | undefined {
  const text = (take ?? "").trim();
  if (text.length === 0) return undefined;
  return { name: SIGNATURE_AVIS.name, title: SIGNATURE_AVIS.title, text };
}
