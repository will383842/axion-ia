// LE PÉRIMÈTRE CLIENT — qu'est-ce qu'une « demande » quand on compte des ventes ?
//
// ── Le défaut que ce module ferme (2026-09-19) ────────────────────────────
// La table `submissions` reçoit TOUT ce qui arrive par le site : demandes
// d'audit ou de devis, rapports du simulateur, mais aussi candidatures
// d'apporteurs, messages de presse, propositions de partenariat, et la
// corbeille. Le cockpit « Demandes » les comptait toutes comme des prospects :
// un candidat apporteur qui abandonnait à l'écran 1 gonflait l'entonnoir
// commercial au même titre qu'une entreprise qui demande un devis.
//
// Le chiffre « Demandes » BAISSE donc avec ce module, et c'est voulu : il ne
// compte plus que des gens susceptibles d'acheter.
//
// ── La règle, et pourquoi elle se lit dans cet ordre ──────────────────────
//   1. une ligne en corbeille n'est pas une demande ;
//   2. un dossier apporteur n'en est pas une non plus, même si un jour sa
//      ligne changeait de `type` ;
//   3. un `type` autre que `contact` (audit, devis qualifié, intervention…)
//      vient d'un formulaire commercial : il est client par construction ;
//   4. un `contact` n'est client que si son `unifiedType` le dit — un message
//      /contact sans `unifiedType` (ancien formulaire) ne l'est pas : on ne
//      sait pas ce qu'il demande, et le compter gonflerait le chiffre.
//
// SOURCE UNIQUE : tout écran qui compte des demandes de clients l'importe,
// jamais ne la recopie. Une liste recopiée à la main finit toujours par
// diverger — et la divergence ne se voit qu'en comparant deux chiffres.

import { TYPE_GROUPS } from "@/lib/schemas/unified-contact-schema";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";

/**
 * Les `unifiedType` qui désignent un client ou un prospect.
 *
 * - `TYPE_GROUPS.projet` : le groupe « Projet IA pour mon entreprise » du
 *   formulaire unifié (audit, mise en œuvre, formation, un-à-un, devis) ;
 * - `support_client` : quelqu'un qui est DÉJÀ client ;
 * - `simulateur_roi` : le rapport du simulateur, posé par
 *   `features/roi-report/actions.ts` avec `type: contact`.
 */
export const PERIMETRE_CLIENT = [
  ...TYPE_GROUPS.projet,
  "support_client",
  "simulateur_roi",
] as const;

export type TypeClient = (typeof PERIMETRE_CLIENT)[number];

const ENSEMBLE_CLIENT: ReadonlySet<string> = new Set(PERIMETRE_CLIENT);

/** Ce qu'il faut lire d'une submission pour décider. `deletedAt` absent = pas en corbeille. */
export interface LigneDemande {
  readonly type: string;
  readonly details: unknown;
  readonly deletedAt?: Date | null;
}

function unifiedTypeDe(details: unknown): string | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) return undefined;
  const v = (details as Record<string, unknown>)["unifiedType"];
  return typeof v === "string" ? v : undefined;
}

/** Vrai si la submission est une demande de client ou de prospect. */
export function estDemandeClient(r: LigneDemande): boolean {
  if (r.deletedAt) return false;
  if (estApporteur(r.details)) return false;
  if (r.type !== "contact") return true;
  const u = unifiedTypeDe(r.details);
  return u !== undefined && ENSEMBLE_CLIENT.has(u);
}
