/**
 * config.ts — les verrous et les constantes de la file de sortie vers Axion Partners (INT-T02).
 *
 * Les drapeaux du canal vivent dans `src/server/partners/config.ts` (INT-T01b) et sont relus À
 * CHAQUE APPEL : ce module ne les recopie pas, il les compose.
 *
 * ⚠️ DEUX verrous, et les deux doivent être ouverts pour qu'une seule instruction d'intégration
 * s'exécute (REQ-INT-008) :
 *   1. `PARTNERS_SYNC_ENABLED` vaut EXACTEMENT `"true"` ;
 *   2. on n'est PAS au build — `DATABASE_URL` ne contient pas `stub.invalid` (ADR 0026, contrat
 *      de build d'AGENTS.md). Au build la base est un faux, et le drapeau pourrait y traîner.
 */
import { estPartnersSyncActif, secretPartners, urlPartners } from "@/server/partners/config";

export { secretPartners, urlPartners };

/** Vrai au build GitHub Actions : la base est le stub, rien d'intégration ne doit tourner. */
export function estAuBuild(): boolean {
  return process.env.DATABASE_URL?.includes("stub.invalid") === true;
}

/** LE verrou. Toute fonction de ce dossier qui touche la base ou le réseau commence par lui. */
export function canalPartnersOuvert(): boolean {
  return estPartnersSyncActif() && !estAuBuild();
}

/**
 * Le secret que PARTNERS présente pour relire la file (REQ-INT-012). Un secret DÉDIÉ, distinct de
 * celui qui signe les envois (REQ-SEC-010 : un secret par source) : la fuite de l'un n'ouvre pas
 * l'autre sens.
 *
 * Moins de 32 caractères vaut absent — même plancher que les secrets de Partners (REQ-SEC-028) :
 * un secret court se devine, et une porte dont la serrure se devine est une porte ouverte.
 */
export function secretRelecture(): string | null {
  const brut = process.env.PARTNERS_RELECTURE_SECRET?.trim();
  return brut !== undefined && brut.length >= 32 ? brut : null;
}

/** REQ-INT-009 : huit tentatives au plus. Un 422 abandonne sans les consommer. */
export const PARTNERS_SYNC_MAX_TENTATIVES = 8;

/** REQ-INT-009 : délai d'attente d'un envoi. */
export const PARTNERS_SYNC_DELAI_MS = 10_000;

/** Lignes envoyées par passage du relais. */
export const PARTNERS_SYNC_LOT = 50;

/** Lignes numérotées par passage : une transaction courte, un verrou tenu peu de temps. */
export const PARTNERS_SYNC_LOT_NUMEROTATION = 100;

/**
 * Recul exponentiel plafonné à 6 h : 1 min, 2, 4, 8, 16, 32, 64 min, puis 6 h — la courbe du canal
 * CRM (`crm-sync/config.ts`), qui a fait ses preuves. Partners indisponible une nuit ne fait
 * perdre aucun événement : la file grossit, et cela se voit.
 */
export function delaiAvantNouvelleTentativeMs(tentatives: number): number {
  const base = 60_000 * 2 ** Math.max(0, tentatives - 1);
  return Math.min(base, 6 * 60 * 60 * 1000);
}

/**
 * La clé du verrou consultatif de la numérotation — un entier 64 bits FIXE, propre à cette file.
 * Dérivée une fois de « partners_sync_outbox.sequence » (8 premiers octets de son SHA-256, lus en
 * entier signé gros-boutiste) et écrite en dur : une clé qui changerait entre deux versions en vol
 * laisserait deux relais numéroter en même temps. Le test la recalcule.
 */
export const CLE_VERROU_SEQUENCE = 2_471_267_966_891_182_009n;
