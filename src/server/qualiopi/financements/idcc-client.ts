/**
 * Qualiopi — le contrôle de l'IDCC d'UNE fiche client, de bout en bout
 * (INT-T78-A). Le CALCUL est dans `idcc-controle.ts` (INT-T61-A) ; la LECTURE de
 * l'annuaire est dans `features/dossier-client/recherche-entreprises.ts`, module
 * NEUTRE (arbitrage d'A02, axion-apporteurs #782, 6035040482). Ce module les
 * relie : il lit la fiche, passe le SIREN à l'annuaire, INTERPRÈTE ce qui revient,
 * et range le statut CALCULÉ. Le sens de l'import va de Qualiopi vers le module
 * neutre, jamais l'inverse.
 *
 * Trois règles, toutes d'A02 :
 *  - l'IDCC lu sur l'annuaire est une PROPOSITION (cas F) : il n'est JAMAIS
 *    écrit comme saisie de l'utilisateur ;
 *  - `confirme` n'est jamais calculé : il ne s'écrit que par le geste
 *    « Confirmer l'IDCC », preuve DÉCLARATIVE dont l'auteur est l'administrateur ;
 *  - l'annuaire n'est jamais sur le chemin critique : `indisponible` ou
 *    `introuvable` laisse la fiche et le contrôle INTACTS, et ne valent JAMAIS
 *    « aucun IDCC publié » (ce qui donnerait les cas E ou H). La réponse brute
 *    n'est ni stockée ni journalisée : seul le statut calculé reste.
 *
 * Les bases sont INJECTÉES (fausses bases en test), comme `idcc-controle.ts`.
 */

import { checkSirenFormat } from "@/lib/siret";
import { normaliserIdcc } from "@/server/qualiopi/crm/naf-opco";
import type { ResultatComplementsSiren } from "@/features/dossier-client/recherche-entreprises";
import type { StatutIdcc } from "../../../../prisma/generated/client";
import {
  confirmerIdccParPreuve,
  controlerIdcc,
  enregistrerControleIdcc,
  lireCouplesIdcc,
  listeIdccDuResultat,
  type BaseControleIdcc,
  type CasControleIdcc,
  type LecteurCouplesIdcc,
  type PreuveDeclarative,
} from "./idcc-controle";
import { isOpcoId, type OpcoId } from "./opco-referentiel";

/** La ligne de contrôle (`client_idcc_controles`), telle que ce module la lit. */
export interface LigneClientIdcc {
  readonly controle: {
    readonly statut: StatutIdcc;
    readonly idcc: string | null;
    readonly preuveType: PreuveDeclarative["type"] | null;
    readonly preuveOpco: string | null;
    readonly preuveAuteurId: string | null;
    readonly preuveLe: Date | null;
  } | null;
}

export interface BaseIdccClient extends BaseControleIdcc, LecteurCouplesIdcc {
  client: {
    findUnique(args: { where: { id: string } }): Promise<{
      siren: string | null;
      siret: string | null;
      idcc: string | null;
      opco: string | null;
      nafCode: string | null;
      type: string;
    } | null>;
  };
  /** Ligne de contrôle (INT-T61-A) : statut calculé et preuve déclarative éventuelle. */
  clientIdccControle: {
    findUnique(args: {
      where: { clientId: string };
    }): Promise<NonNullable<LigneClientIdcc["controle"]> | null>;
  };
}

export type MotifNonVerifie =
  | "client_introuvable"
  | "particulier"
  | "siren_invalide"
  | "annuaire_indisponible"
  | "annuaire_introuvable";

export type ResultatVerificationIdcc =
  | {
      readonly ok: true;
      readonly statut: StatutIdcc;
      readonly cas: CasControleIdcc;
      /** IDCC saisi normalisé. */
      readonly idcc: string | null;
      /** IDCC unique publié quand rien n'est saisi : une PROPOSITION, jamais une saisie. */
      readonly idccPropose: string | null;
      readonly change: boolean;
    }
  | { readonly ok: false; readonly motif: MotifNonVerifie };

/** Le SIREN de la fiche : celui de son SIRET quand il est valide, sinon celui qu'elle porte. */
export function sirenDeLaFiche(f: { siren: string | null; siret: string | null }): string | null {
  const duSiret = (f.siret ?? "").replace(/\s+/g, "").slice(0, 9);
  if (checkSirenFormat(duSiret).ok) return duSiret;
  const propre = (f.siren ?? "").replace(/\s+/g, "");
  return checkSirenFormat(propre).ok ? propre : null;
}

function preuveDe(c: NonNullable<LigneClientIdcc["controle"]>): PreuveDeclarative | null {
  if (c.statut !== "confirme") return null;
  if (
    c.preuveType === null ||
    c.idcc === null ||
    c.preuveAuteurId === null ||
    c.preuveLe === null
  ) {
    return null;
  }
  return {
    type: c.preuveType,
    idcc: c.idcc,
    opco: isOpcoId(c.preuveOpco) ? c.preuveOpco : null,
    auteurId: c.preuveAuteurId,
    le: c.preuveLe,
  };
}

/**
 * « Vérifier avec le SIREN » : lit l'annuaire, recalcule, range le statut calculé.
 * Ne lève pas pour une panne de l'annuaire : elle rend un motif, sans rien écrire.
 */
export async function verifierIdccClient(
  db: BaseIdccClient,
  lireComplements: (siren: string) => Promise<ResultatComplementsSiren>,
  clientId: string,
): Promise<ResultatVerificationIdcc> {
  const fiche = await db.client.findUnique({ where: { id: clientId } });
  if (fiche === null) return { ok: false, motif: "client_introuvable" };
  if (fiche.type === "particulier") return { ok: false, motif: "particulier" };

  const siren = sirenDeLaFiche(fiche);
  if (siren === null) return { ok: false, motif: "siren_invalide" };

  const lu = await lireComplements(siren);
  if (!lu.ok) {
    // Ni écriture, ni recalcul : une panne n'est pas une absence de donnée.
    return {
      ok: false,
      motif: lu.motif === "introuvable" ? "annuaire_introuvable" : "annuaire_indisponible",
    };
  }

  const couples = await lireCouplesIdcc(db, fiche.idcc);
  const controle = await db.clientIdccControle.findUnique({ where: { clientId } });
  const resultat = controlerIdcc({
    idccSaisi: fiche.idcc,
    opcoSaisi: isOpcoId(fiche.opco) ? (fiche.opco as OpcoId) : null,
    listeIdcc: listeIdccDuResultat({ complements: lu.complements }),
    naf: fiche.nafCode,
    couples,
    preuve: controle === null ? null : preuveDe(controle),
  });
  // Une confirmation en vigueur tient : `confirme` ne s'écrit que par le geste de
  // confirmation, jamais par un recalcul. Rien à ranger, le statut reste le sien.
  const { change } =
    resultat.statut === "confirme"
      ? { change: false }
      : await enregistrerControleIdcc(db, { clientId, resultat });
  return {
    ok: true,
    statut: resultat.statut,
    cas: resultat.cas,
    idcc: resultat.idcc,
    idccPropose: resultat.idccPropose,
    change,
  };
}

export type ResultatConfirmationIdcc =
  | { readonly ok: true; readonly change: boolean }
  | {
      readonly ok: false;
      readonly motif: "client_introuvable" | "particulier" | "refusee";
      readonly message?: string;
    };

/**
 * « Confirmer l'IDCC » : preuve DÉCLARATIVE, auteur = l'administrateur connecté
 * (fourni par l'ACTION, jamais par un formulaire), date posée par le serveur.
 * Aucun fichier. Un refus de `confirmerIdccParPreuve` rend sa raison.
 */
export async function confirmerIdccClient(
  db: BaseIdccClient,
  input: {
    clientId: string;
    auteurId: string;
    type: string;
    opco?: string | undefined;
    maintenant?: Date;
  },
): Promise<ResultatConfirmationIdcc> {
  const fiche = await db.client.findUnique({ where: { id: input.clientId } });
  if (fiche === null) return { ok: false, motif: "client_introuvable" };
  if (fiche.type === "particulier") return { ok: false, motif: "particulier" };
  const couples = await lireCouplesIdcc(db, fiche.idcc);
  try {
    const { change } = await confirmerIdccParPreuve(db, {
      clientId: input.clientId,
      idccSaisi: fiche.idcc,
      // L'IDCC de la preuve est CELUI DE LA FICHE : on ne confirme que ce qui est saisi.
      preuve: {
        type: input.type,
        idcc: normaliserIdcc(fiche.idcc) ?? "",
        ...(input.opco !== undefined ? { opco: input.opco } : {}),
        auteurId: input.auteurId,
      },
      couples,
      ...(input.maintenant !== undefined ? { maintenant: input.maintenant } : {}),
    });
    return { ok: true, change };
  } catch (err) {
    if (err instanceof Error && err.name === "ConfirmationIdccRefusee") {
      return { ok: false, motif: "refusee", message: err.message };
    }
    throw err;
  }
}
