/**
 * Mots-clés dont la CIBLE a été retirée du positionnement (2026-08-30, PR #895 :
 * le site s'adresse aux PME, ETI et grands groupes).
 *
 * Pourquoi ils restent dans le corpus, et pourquoi on les DÉPRIORISE au lieu de
 * les supprimer : chaque seed porte une `urlCible` vers une page qui reste EN
 * LIGNE (`/fr/audit/tpe-1-jour`, `/fr/formations/tpe-artisan`, `/fr/faq/*-tpe`,
 * `/fr/ressources/roi-ia-tpe`…). Les retirer orphelinerait l'inventaire qui
 * relie ces URL à une intention de recherche, et la console de stratégie
 * (`keyword-strategy`) cesserait de les voir. Le volume de recherche sur « TPE »
 * est réel ; ce n'est pas lui qu'on retire, c'est la production AUTOMATIQUE de
 * nouveaux articles sur cette cible.
 *
 * Le problème concret qu'on ferme : le sélecteur puise dans ce corpus pour
 * choisir le sujet du prochain article, pendant que `brand/brand-voice.ts` écrit
 * désormais « PME, ETI et grands groupes ». Sans ce filtre, le pipeline produit
 * un « audit IA pour TPE » rédigé avec une voix qui dit l'inverse.
 *
 * ⚠️ CE QUI N'EST PAS DÉPRIORISÉ : « artisan » et « commerçant » seuls.
 * L'arbitrage retire le PALIER de taille (1-9 salariés), pas le métier : un
 * artisan qui est une PME reste un client, et la copie du site en garde
 * volontairement des centaines de mentions (« PME artisanales », « PME du BTP,
 * commerçants et professions libérales »). Le prédicat ne porte donc que sur des
 * marqueurs de TAILLE. 17 termes `artisan`/`commerçant` restent pleinement
 * prioritaires.
 */
import { ALL_KEYWORD_SEEDS } from "./master";

/**
 * Marqueurs de TAILLE d'entreprise retirés du positionnement.
 *
 * Plusieurs écritures de la même cible : un motif unique ne prouverait que
 * l'absence de la forme qu'il a nommée. `\b` suffit ici — tous ces marqueurs
 * sont ASCII, contrairement aux formes accentuées du corps de texte.
 */
export const TAILLE_RETIREE_RE =
  /\btpe\b|micro-?entreprise|auto-?entrepreneur|tr[eè]s petite entreprise|entrepreneur individuel/i;

/** Un terme vise-t-il une taille d'entreprise retirée du positionnement ? */
export function ciblUneTailleRetiree(term: string): boolean {
  return TAILLE_RETIREE_RE.test(term);
}

/**
 * Termes dépriorisés, DÉRIVÉS du corpus — jamais écrits à la main.
 *
 * Une liste recopiée deviendrait muette au prochain mot-clé ajouté, et
 * personne ne s'en apercevrait : le sélecteur continuerait de rendre du vert.
 */
export const TERMES_DEPRIORISES: readonly string[] = Object.freeze(
  ALL_KEYWORD_SEEDS.map((s) => s.keyword).filter((t) => ciblUneTailleRetiree(t)),
);
