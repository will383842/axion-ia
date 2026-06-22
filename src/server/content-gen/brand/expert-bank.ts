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
 * Désambiguïsation d'entité : l'avis d'expert émet un nœud `Person` (@id
 * `/equipe/<key>#person`, worksFor Organization) — voir `ArticleExpertQuote`.
 * Manon a une page dédiée `/equipe/manon` (AuthorProfile) ; Williams est le
 * fondateur (nœud Person dans l'Organization). Une page `/equipe/williams`
 * dédiée reste à créer (photo/bio réelles requises) pour compléter l'entité.
 *
 * Extensible : ajouter un expert = une entrée dans `INTERNAL_EXPERTS`.
 * 2026-06-22 : Manon + Williams (d'autres experts plus tard, décision Will).
 */

export interface InternalExpert {
  /** Clé stable (= slug page /equipe). */
  readonly key: string;
  /** Nom affiché tel quel dans la citation (figcaption). */
  readonly name: string;
  /** Fonction affichée (jobTitle). */
  readonly title: string;
  /** Domaines d'expertise — servent au routage déterministe de l'expert. */
  readonly domains: ReadonlyArray<string>;
}

export const INTERNAL_EXPERTS: ReadonlyArray<InternalExpert> = [
  {
    key: "manon",
    name: "Manon",
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
    name: "Williams Jullin",
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
  const found = INTERNAL_EXPERTS.find((e) => e.name.toLowerCase() === n);
  return found ? found.key : null;
}

/**
 * Construit l'`expertQuote` final à partir d'un expert choisi + le texte rédigé
 * par le LLM. Le nom/titre viennent TOUJOURS de la banque (jamais du LLM).
 * Retourne `undefined` si le texte est vide → le bloc ne se rend pas (CLS=0).
 */
export function buildExpertQuote(
  expert: InternalExpert,
  take: string | null | undefined,
): { readonly name: string; readonly title: string; readonly text: string } | undefined {
  const text = (take ?? "").trim();
  if (text.length === 0) return undefined;
  return { name: expert.name, title: expert.title, text };
}
