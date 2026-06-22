/**
 * Banque d'experts INTERNES Axion-IA (refonte templates 2026-06-22).
 *
 * Source des « avis d'expert » (levier AEO/E-E-A-T le plus fort, +41 % de
 * visibilité IA) rendus par `<ArticleExpertQuote>`. Décision Will : experts
 * INTERNES uniquement (jamais d'expert tiers fabriqué par le LLM).
 *
 * GARANTIE ANTI-FABRICATION : le nom + le titre de l'expert sont FIXÉS ici et
 * passés au générateur. Le LLM ne rédige QUE le texte de la prise de position
 * (`expertTake`), jamais le nom. Un nom renvoyé par le LLM qui ne correspond
 * pas à un expert connu est rejeté (`isKnownInternalExpert`). On ne met donc
 * jamais de mots dans la bouche d'une personne fictive ou tierce.
 *
 * Ces personnes ont déjà une entité `Person` (JSON-LD + page `/equipe/<slug>` +
 * LinkedIn `sameAs`) → l'avis d'expert pointe vers une entité réelle et
 * vérifiable, ce qui est exactement ce que valorisent Google/AI Overviews.
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

/** Garde anti-fabrication : le nom correspond-il à un expert interne connu ? */
export function isKnownInternalExpert(name: string): boolean {
  const n = name.trim().toLowerCase();
  return INTERNAL_EXPERTS.some((e) => e.name.toLowerCase() === n);
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
