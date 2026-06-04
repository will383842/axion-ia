// Slot-filling produit + classification d'intention (T-37, doc 16 §4/§5a, G-6).
//
// Extrait DÉTERMINISTE-ment d'un message en langage naturel les critères de
// recherche (prix, durée, nb de personnes, sujet/outil, format, vertical, tri,
// audience) et classe l'INTENTION. Mémorise les slots déjà donnés (multi-tours)
// → ne re-demande jamais un critère déjà fourni (« et en présentiel ? » garde
// le reste). Extraction déterministe (regex + dictionnaires) pour les indices
// structurés ; l'orchestrateur (T-07) peut compléter par un appel LLM Sonnet
// (D-LLM-TIER) sur les cas ambigus — non requis pour les cas courants.
//
// SUBJECT_SYNONYMS : extension ADDITIVE (ne modifie pas intervention-subject-mapping.ts,
// consommé par les formulaires) — mappe les outils/sujets cités vers un sujet canonique.

import type { RechercherOffresInput } from "@/server/chatbot/tools/rechercher-offres";

/** Slots de recherche (sur-ensemble de RechercherOffresInput, persistés en conversation). */
export type SearchSlots = RechercherOffresInput;

export type ChatIntent =
  | "recherche_offre"
  | "explication"
  | "comparaison"
  | "rdv"
  | "lead"
  | "hors_sujet";

export interface ExtractionResult {
  readonly slots: SearchSlots;
  readonly intent: ChatIntent;
}

/** Outils/sujets → sujet canonique (catalogue : seul « claude » a des offres dédiées). */
export const SUBJECT_SYNONYMS: Readonly<Record<string, string>> = {
  "claude.ai": "claude",
  claude: "claude",
  anthropic: "claude",
  chatgpt: "chatgpt",
  "chat gpt": "chatgpt",
  gpt: "chatgpt",
  openai: "chatgpt",
  copilot: "copilot",
  gemini: "gemini",
  mistral: "mistral",
  midjourney: "midjourney",
};

const NBSP = /[  ]/g;

/** « 1 000 » / « 1000 » / « 1 500 » → 1000 / 1500. */
function parseFrenchInt(raw: string): number {
  return parseInt(raw.replace(NBSP, " ").replace(/\s/g, ""), 10);
}

const AMOUNT = "(\\d[\\d \\u00a0\\u202f]*\\d|\\d)";

function extractPrice(msg: string): { prixMin?: number; prixMax?: number } {
  const out: { prixMin?: number; prixMax?: number } = {};

  const between = msg.match(
    new RegExp(
      `entre\\s+${AMOUNT}\\s*(?:€|euros?|k€?)?\\s+et\\s+${AMOUNT}\\s*(?:€|euros?|k€?)?`,
      "i",
    ),
  );
  if (between) {
    const a = parseFrenchInt(between[1]!);
    const b = parseFrenchInt(between[2]!);
    out.prixMin = Math.min(a, b);
    out.prixMax = Math.max(a, b);
    return out;
  }

  const max = msg.match(
    new RegExp(
      `(?:moins de|max(?:imum)?|jusqu['’]?à|pas plus de|sous (?:les|la barre de)?|budget (?:de |max(?:imum)? )?|≤|<)\\s*${AMOUNT}\\s*(?:€|euros?)?`,
      "i",
    ),
  );
  if (max) out.prixMax = parseFrenchInt(max[1]!);

  const min = msg.match(
    new RegExp(
      `(?:à partir de|plus de|minimum|au moins|dès|≥|>)\\s*${AMOUNT}\\s*(?:€|euros?)?`,
      "i",
    ),
  );
  if (min) out.prixMin = parseFrenchInt(min[1]!);

  // Montant nu suivi de €/euros (budget implicite) si rien d'autre capté.
  if (out.prixMin === undefined && out.prixMax === undefined) {
    const bare = msg.match(new RegExp(`${AMOUNT}\\s*(?:€|euros?)`, "i"));
    if (bare) out.prixMax = parseFrenchInt(bare[1]!);
  }
  return out;
}

function extractEffectif(msg: string): number | undefined {
  const m = msg.match(
    /(\d+)\s*(?:personnes?|pers\b|salari[ée]s?|collaborateurs?|participants?|employ[ée]s?)/i,
  );
  if (m) return parseInt(m[1]!, 10);
  if (
    /\b(en\s+)?individuel|\b1[\s-]?to[\s-]?1\b|tête[\s-]à[\s-]tête|un dirigeant|une personne|seul/i.test(
      msg,
    )
  ) {
    return 1;
  }
  return undefined;
}

function extractDureeMaxJours(msg: string): number | undefined {
  const jours = msg.match(/(\d+)\s*(?:jours?|journ[ée]es?)/i);
  if (jours) return parseInt(jours[1]!, 10);
  if (/demi[\s-]?journ[ée]e/i.test(msg)) return 0.5;
  const heures = msg.match(/(\d+)\s*(?:h\b|heures?)/i);
  if (heures) return parseInt(heures[1]!, 10) / 8; // 1 j ≈ 8 h
  if (/\bune journ[ée]e\b/i.test(msg)) return 1;
  return undefined;
}

function extractSujet(msg: string): string | undefined {
  const lower = msg.toLowerCase();
  // tester d'abord les clés longues (claude.ai avant claude).
  for (const key of Object.keys(SUBJECT_SYNONYMS).sort((a, b) => b.length - a.length)) {
    if (lower.includes(key)) return SUBJECT_SYNONYMS[key];
  }
  return undefined;
}

function extractFormat(msg: string): "presentiel" | "distanciel" | "mixte" | undefined {
  if (/mixte|hybride/i.test(msg)) return "mixte";
  if (/distanciel|à distance|a distance|visio|en ligne|en distanciel/i.test(msg))
    return "distanciel";
  if (/pr[ée]sentiel|sur site|sur place/i.test(msg)) return "presentiel";
  return undefined;
}

function extractVertical(msg: string): SearchSlots["vertical"] {
  if (/\baudit/i.test(msg)) return "audit";
  if (
    /site web|site internet|saas|plateforme|application web|codage|développement web|developpement web/i.test(
      msg,
    )
  )
    return "sites-web";
  if (
    /impl[ée]mentation|impl[ée]menter|d[ée]ployer|projet ia|automatisation|int[ée]gration/i.test(
      msg,
    )
  )
    return "implementation";
  if (
    /coaching|un[\s-]à[\s-]un|un a un|accompagnement individuel|1[\s-]?to[\s-]?1|individuel/i.test(
      msg,
    )
  )
    return "un-a-un";
  if (
    /formation|former|se former|atelier|apprendre|monter en comp[ée]tence|interventions?/i.test(msg)
  )
    return "formation";
  return undefined;
}

function extractAudience(msg: string): SearchSlots["audience"] {
  if (/\beti\b|entreprise de taille interm/i.test(msg)) return "eti";
  if (/\bpme\b/i.test(msg)) return "pme";
  if (/\btpe\b|très petite|tres petite|petite entreprise/i.test(msg)) return "tpe";
  if (/grande entreprise|grand groupe|grand compte|grandes entreprises/i.test(msg))
    return "grande-entreprise";
  return undefined;
}

function extractTri(msg: string): SearchSlots["tri"] {
  if (
    /moins ch[eè]re?s?|pas ch[eè]re?|le plus [ée]conomique|le plus abordable|le plus accessible|prix le plus bas/i.test(
      msg,
    )
  )
    return "prix_asc";
  if (/le plus cher|haut de gamme|premium|le plus complet|prix le plus [ée]lev/i.test(msg))
    return "prix_desc";
  return undefined;
}

function classifyIntent(msg: string, slots: SearchSlots): ChatIntent {
  const m = msg.toLowerCase();
  if (
    /\brdv\b|rendez[\s-]?vous|réserver|reserver|prendre (un )?(rdv|appel)|caler (un )?(appel|créneau)|disponibilit/i.test(
      m,
    )
  )
    return "rdv";
  if (
    /devis|rappelez[\s-]?moi|contactez[\s-]?moi|laisse(r)? mes coordonn|mon (e[\s-]?mail|téléphone|num[ée]ro)/i.test(
      m,
    )
  )
    return "lead";
  if (
    /comparer|comparaison|compare[rz]?\b|diff[ée]rence entre|\bvs\b|versus|lequel choisir|que(l|lle)? choisir|quoi choisir|quelle diff/i.test(
      m,
    )
  )
    return "comparaison";
  if (
    /c['’]est quoi|qu['’]est[\s-]?ce que|en quoi consiste|expli(que|quez|cation)|comment (ça|ca|se|fonctionne|marche)|pourquoi|à quoi (sert|ça sert)|définition|c['’]est combien/i.test(
      m,
    )
  )
    return "explication";
  // Des slots de recherche présents → recherche d'offre.
  const hasSearchSignal =
    slots.prixMin !== undefined ||
    slots.prixMax !== undefined ||
    slots.effectif !== undefined ||
    slots.dureeMaxJours !== undefined ||
    slots.vertical !== undefined ||
    slots.sujet !== undefined ||
    slots.format !== undefined ||
    slots.tri !== undefined;
  if (hasSearchSignal) return "recherche_offre";
  return "hors_sujet";
}

/** Fusionne `previous` (slots déjà donnés) avec ceux extraits du message (nouveau gagne). */
function mergeSlots(previous: SearchSlots | undefined, fresh: SearchSlots): SearchSlots {
  const merged: SearchSlots = { ...(previous ?? {}) };
  for (const [k, v] of Object.entries(fresh)) {
    if (v !== undefined) (merged as Record<string, unknown>)[k] = v;
  }
  return merged;
}

/**
 * Extrait les slots de recherche + classe l'intention d'un message.
 * `previous` : slots déjà collectés dans la conversation (multi-tours).
 */
export function extractSlots(message: string, previous?: SearchSlots): ExtractionResult {
  const msg = message.normalize("NFC");

  const fresh: SearchSlots = {};
  const { prixMin, prixMax } = extractPrice(msg);
  if (prixMin !== undefined) fresh.prixMin = prixMin;
  if (prixMax !== undefined) fresh.prixMax = prixMax;
  const effectif = extractEffectif(msg);
  if (effectif !== undefined) fresh.effectif = effectif;
  const dureeMaxJours = extractDureeMaxJours(msg);
  if (dureeMaxJours !== undefined) fresh.dureeMaxJours = dureeMaxJours;
  const sujet = extractSujet(msg);
  if (sujet !== undefined) fresh.sujet = sujet;
  const format = extractFormat(msg);
  if (format !== undefined) fresh.format = format;
  const vertical = extractVertical(msg);
  if (vertical !== undefined) fresh.vertical = vertical;
  const audience = extractAudience(msg);
  if (audience !== undefined) fresh.audience = audience;
  const tri = extractTri(msg);
  if (tri !== undefined) fresh.tri = tri;

  const slots = mergeSlots(previous, fresh);
  const intent = classifyIntent(msg, slots);
  return { slots, intent };
}
