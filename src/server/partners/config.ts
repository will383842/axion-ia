/**
 * config.ts — les drapeaux du canal axionia → Axion Partners.
 *
 * ⚠️ INERTIE TOTALE, règle n°1. Tant que `PARTNERS_SYNC_ENABLED` ne vaut pas
 * EXACTEMENT `"true"`, rien ne se passe : aucune ligne écrite, aucun appel réseau,
 * aucun job posé. Le comportement observable du site est strictement identique à
 * celui d'avant ce lot, et le retour arrière consiste à remettre la variable à
 * `false` — pas un revert, pas une restauration.
 *
 * C'est la doctrine déjà appliquée au canal `crm-sync` (`src/server/crm-sync/config.ts`),
 * et elle vaut d'autant plus ici : le canal Partners porte des montants qui deviennent
 * des commissions dues à des tiers. Un envoi prématuré ne se rattrape pas par un
 * simple correctif de code.
 *
 * 🔑 Les drapeaux sont relus À CHAQUE APPEL, jamais capturés au chargement du module.
 * Une constante figée au chargement se lit très bien et ne se teste pas : le test qui
 * bascule le drapeau entre deux cas devient impossible à écrire, donc il n'est pas
 * écrit, donc l'inertie n'est prouvée par rien.
 */

/** Le drapeau MAÎTRE. Tout passe par lui. */
export function estPartnersSyncActif(): boolean {
  return process.env.PARTNERS_SYNC_ENABLED === "true";
}

/**
 * Le secret partagé du canal. Absent, aucune émission signée n'est possible, donc
 * aucune émission tout court.
 *
 * Rend `null` plutôt qu'une chaîne vide : une chaîne vide est un secret VALIDE pour
 * `createHmac`, qui signerait sans broncher avec une clé nulle. Le type force alors
 * l'appelant à traiter le cas au lieu de le traverser.
 */
export function secretPartners(): string | null {
  const brut = process.env.PARTNERS_SYNC_SECRET?.trim();
  return brut !== undefined && brut.length > 0 ? brut : null;
}

/** L'URL d'ingestion d'Axion Partners. Même règle que le secret. */
export function urlPartners(): string | null {
  const brut = process.env.PARTNERS_SYNC_URL?.trim();
  return brut !== undefined && brut.length > 0 ? brut : null;
}

/**
 * Le nom du producteur, porté par le champ `producer` de l'enveloppe.
 *
 * `partners/ADR-0008` laisse ce champ OUVERT : « aucune exigence du registre n'énumère
 * les producteurs ». Il reste donc une chaîne non vide, et celle-ci nomme le dépôt qui
 * émet — ce qui est le minimum utile pour un récepteur qui en servira plusieurs.
 */
export const PRODUCTEUR = "axionia";
