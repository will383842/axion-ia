/**
 * Qualiopi — neutralise, AU RENDU, ce que des contenus EN BASE disent de la
 * certification d'Axion-IA.
 *
 * Constat du 14/10/2026 (audit initial le 16/10, certification NON obtenue) :
 * des articles de blog générés, les FAQ qui en sont extraites et une offre
 * d'emploi affirmaient — ou niaient — la certification Qualiopi d'Axion-IA. Ces
 * textes vivent en base (`Article.body`, `Article.faqJson`, `knowledge_entries`,
 * `JobOffer.bodyFr`) : ils ne peuvent pas lire l'interrupteur, et la base de
 * production n'est pas à modifier pour cela.
 *
 * On les réécrit donc au moment du rendu, côté serveur, comme
 * `prefixerLiensInternes` réécrit les liens. Deux familles de règles :
 *
 *   - les AFFIRMATIONS (« gardien de notre certification », « Vérifier sur page
 *     Tarifs » dans la ligne « Certification Qualiopi »…) dépendent de
 *     l'interrupteur : interrupteur éteint → variante neutre et vraie ;
 *     interrupteur allumé → texte d'origine, sans autre changement ;
 *   - les NÉGATIONS (« Axion-IA n'est pas certifié Qualiopi ») sont neutralisées
 *     DANS LES DEUX ÉTATS : vraies aujourd'hui, elles deviendraient fausses le
 *     jour du certificat. La variante retenue ne parle pas du statut d'Axion-IA.
 *
 * Les phrases purement informatives sur le dispositif (« la mobilisation de
 * l'OPCO nécessite un organisme certifié ») ne sont pas touchées.
 *
 * Chaque règle cible une formulation RELEVÉE en ligne, pas un vocabulaire : un
 * motif large réécrirait des phrases qu'on n'a pas lues.
 */

import { isQualiopiCertificationObtenue } from "@/server/qualiopi/config/flag";

/** Apostrophe telle qu'elle peut sortir de la base ou du sanitizer. */
const APOS = "(?:'|’|&#39;|&#x27;|&apos;)";

interface Regle {
  readonly motif: RegExp;
  readonly remplacement: string;
  /** `true` : la règle s'applique même interrupteur allumé (négation datée). */
  readonly toujours: boolean;
}

const REGLES: ReadonlyArray<Regle> = [
  // ── Négations (neutralisées dans les deux états) ──────────────────────────
  // /fr/blog/alternatives-formation-ia-nanterre — encadré « À noter ».
  {
    motif:
      /Axion-IA est un cabinet de conseil opérationnel, non un organisme de formation certifi[ée] Qualiopi\./g,
    remplacement: "Axion-IA est un cabinet de conseil opérationnel.",
    toujours: true,
  },
  // Même article — question de FAQ (corps, FAQ de l'article, /fr/faq).
  {
    motif: new RegExp(
      `Axion-IA n${APOS}est pas certifi[ée] Qualiopi, ce qui exclut la prise en charge directe par les OPCO ou le CPF pour nos programmes\\.`,
      "g",
    ),
    remplacement:
      "La prise en charge par un OPCO dépend de la certification Qualiopi de l'organisme qui dispense la formation ; le CPF n'est pas mobilisable pour nos programmes.",
    toujours: true,
  },
  // Même article — tableau comparatif, colonne Axion-IA.
  {
    motif:
      /(<strong>Financement OPCO<\/strong>\s*<\/td>\s*<td>)\s*⚠️ Non \(hors Qualiopi\)\s*(<\/td>)/g,
    remplacement: "$1⚠️ Nous consulter$2",
    toujours: true,
  },

  // ── Affirmations (reviennent quand l'interrupteur est allumé) ────────────
  // /fr/blog/formation-ia-saint-denis-comparatif-axion-ia-vs-generalistes —
  // tableau comparatif, ligne « Certification Qualiopi », colonne Axion-IA.
  {
    motif:
      /(<td>\s*Certification Qualiopi\s*<\/td>\s*<td>)\s*Vérifier sur <a\b[^>]*>\s*page Tarifs\s*<\/a>\s*(<\/td>)/g,
    remplacement: "$1En cours$2",
    toujours: false,
  },
  // /fr/blog/formation-ia-tourcoing-top-10 — Axion-IA se classant parmi les
  // organismes « sérieux », la phrase le dit certifié.
  {
    motif:
      /(à condition que le prestataire soit certifi[ée] Qualiopi), ce qui est la règle pour tout organisme sérieux\./g,
    remplacement: "$1.",
    toujours: false,
  },
  // /fr/carrieres/responsable-qualite-qualiopi — tutoiement (seed) et
  // vouvoiement (offre servie).
  {
    motif: /être la gardienne ou le gardien de notre certification Qualiopi/g,
    remplacement: "porter notre démarche de certification Qualiopi jusqu'à son obtention",
    toujours: false,
  },
];

function neutraliserTexte(texte: string, certifie: boolean): string {
  let sortie = texte;
  for (const { motif, remplacement, toujours } of REGLES) {
    if (certifie && !toujours) continue;
    motif.lastIndex = 0;
    sortie = sortie.replace(motif, remplacement);
  }
  return sortie;
}

function estObjetSimple(valeur: unknown): valeur is Record<string, unknown> {
  if (valeur === null || typeof valeur !== "object") return false;
  const proto = Object.getPrototypeOf(valeur);
  return proto === Object.prototype || proto === null;
}

/**
 * Parcourt une valeur chargée de la base (chaîne, tableau, objet simple) et
 * réécrit ses chaînes. Les autres valeurs (dates, décimaux Prisma…) sont rendues
 * telles quelles, par référence.
 *
 * @param certifie valeur de `isQualiopiCertificationObtenue()` — passée en
 *   paramètre pour que la règle se teste sans variable d'environnement.
 */
export function neutraliserAffirmationsQualiopi<T>(valeur: T, certifie: boolean): T {
  if (typeof valeur === "string") return neutraliserTexte(valeur, certifie) as T;
  if (Array.isArray(valeur)) {
    return valeur.map((v: unknown) => neutraliserAffirmationsQualiopi(v, certifie)) as T;
  }
  if (estObjetSimple(valeur)) {
    const copie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur)) {
      copie[cle] = neutraliserAffirmationsQualiopi(v, certifie);
    }
    return copie as T;
  }
  return valeur;
}

/** Même chose, l'interrupteur lu au moment de l'appel (rendu serveur). */
export function neutraliserSelonInterrupteur<T>(valeur: T): T {
  return neutraliserAffirmationsQualiopi(valeur, isQualiopiCertificationObtenue());
}
