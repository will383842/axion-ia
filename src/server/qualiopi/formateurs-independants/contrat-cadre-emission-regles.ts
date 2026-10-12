/**
 * Formateurs indépendants — RÈGLES de la préparation du contrat-cadre (lots L7b, L7d).
 *
 * Module PUR : ni Prisma, ni horloge, ni réseau. Le service (`contrat-cadre-emission.ts`)
 * lit les faits et demande le verdict ici.
 *
 * 🔑 Ce qu'il garantit :
 *   - aucun contrat sans version ARRÊTÉE (`versions-arretees.ts`), et jamais en dessous
 *     de la version minimale d'un nouvel indépendant ;
 *   - un seul contrat VIVANT par version : une version déjà émise n'est jamais refaite,
 *     et une version signée n'est jamais touchée — une nouvelle version est une NOUVELLE
 *     pièce ;
 *   - un contrat qui attend la contresignature bloque toute nouvelle émission ;
 *   - attestation URSSAF vérifiée (L4b) et contrôle du registre probant sur le SIRET même
 *     que le contrat portera ;
 *   - entreprise individuelle confirmée au registre : un formateur en société n'a pas
 *     encore ses champs (dénomination, forme, capital) en base, le contrat n'est donc pas
 *     préparé par l'outil.
 *
 * L'activité confirmée au registre au moment de la SIGNATURE et de la CONTRESIGNATURE
 * reste vérifiée par la signature (L7c) : préparer le contrat ne la remplace pas.
 */

import type { ContratCadreData } from "@/server/qualiopi/documents/templates/contrat-cadre";

import { etatControle } from "./controle-regles";
import {
  MANQUES_COMPLETS,
  VERSION_MINIMALE_CONTRAT_INDEPENDANT,
  vigilanceProuvee,
  type ControleLu,
  type PieceLueActivation,
  type PreuveVigilanceLue,
} from "./garde-activation-complete";

/** Un contrat-cadre déjà émis pour cette fiche. */
export interface ContratEmisLu {
  readonly id: string;
  readonly numero: string;
  readonly version: number;
  readonly statutSignature: string;
  readonly annuleeAt: Date | null;
  /** Au moins une signature non révoquée (d'une partie quelconque). */
  readonly signatures: number;
  /**
   * Liens de signature encore utilisables (ni révoqués, ni utilisés, ni échus). Une pièce
   * dont un lien circule est « en cours de signature » : elle n'est jamais remplacée en
   * silence (le formateur pourrait signer pendant qu'on l'annule).
   */
  readonly liensActifs?: number;
}

/** Ce que le registre public dit de l'entreprise du SIRET, lu au moment de préparer. */
export type RegistreLu =
  | { readonly lu: false }
  | {
      readonly lu: true;
      readonly siret: string | null;
      readonly active: boolean;
      /** `null` : le registre ne le dit pas. */
      readonly entrepreneurIndividuel: boolean | null;
    };

export interface FaitsEmissionContrat {
  readonly statut: string;
  readonly organismeSousTraitantId: string | null;
  readonly finCollaborationAt: Date | null;
  readonly prenom: string;
  readonly nom: string;
  readonly email: string;
  readonly siret: string | null;
  readonly adresseProfessionnelle: string | null;
  readonly sousTraitantNda: string | null;
  readonly numeroTvaIntracom: string | null;
  readonly contrats: ReadonlyArray<ContratEmisLu>;
  readonly controles: ReadonlyArray<ControleLu>;
  readonly pieces: ReadonlyArray<PieceLueActivation>;
  readonly preuvesVigilance: ReadonlyArray<PreuveVigilanceLue>;
  readonly registre: RegistreLu;
}

export const REFUS_EMISSION = {
  horsPerimetre: "Réservé aux formateurs indépendants en nom propre.",
  fin: MANQUES_COMPLETS.fin,
  version: "Aucune version arrêtée du contrat-cadre ne peut être émise.",
  enAttente:
    "Un contrat-cadre signé par le formateur attend la contresignature : contresignez-le, ou annulez-le avec un motif, avant d'en préparer un autre.",
  dejaEmis:
    "Un contrat-cadre de cette version existe déjà pour ce formateur (s'il est refusé ou périmé, annulez-le avec un motif avant d'en préparer un autre).",
  lienEnCours:
    "Un lien de signature circule encore sur un contrat-cadre précédent : révoquez ce lien ou annulez ce contrat avant d'en préparer un nouveau.",
  vigilance: MANQUES_COMPLETS.vigilance,
  controle: MANQUES_COMPLETS.controle,
  siret: MANQUES_COMPLETS.siret,
  registreMuet:
    "Le registre public n'a pas répondu : l'activité de l'entreprise n'est pas confirmée. Réessayez dans quelques minutes.",
  inactive: "Le registre public ne montre pas l'établissement de ce SIRET comme actif.",
  societe:
    "Ce formateur exerce en société (ou le registre ne dit pas qu'il est entrepreneur individuel) : la dénomination, la forme et le capital ne sont pas en base, le contrat n'est donc pas préparé par l'outil.",
} as const;

/** Statuts d'un contrat qui le rendent encore « vivant » côté émission. */
const SIGNE_PAR_UNE_PARTIE = "partielle";

function siretNormalise(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, "");
}

export type VerdictEmission =
  | {
      readonly ok: true;
      /** Contrats d'une version INFÉRIEURE, vivants et signés par personne : remplacés. */
      readonly aRemplacer: ReadonlyArray<string>;
    }
  | { readonly ok: false; readonly refus: ReadonlyArray<string> };

/**
 * Peut-on préparer le contrat-cadre de version `versionCible` pour cette fiche ?
 * Garde FERMÉE : une exception rend un refus.
 */
export function verdictEmissionContrat(
  f: FaitsEmissionContrat,
  versionCible: number | null,
  maintenant: Date,
  options: {
    /**
     * `dossier` (lot B, M3) : contrat créé dans le dossier, avant la vérification par
     * Axion. L'attestation URSSAF vérifiée et le contrôle « probant » (orange validé)
     * ne sont pas exigés ici — ils le sont à la contresignature (W-4) ; un dernier
     * contrôle ROUGE refuse toujours, et le registre lu à l'instant doit dire actif.
     */
    parcours?: "console" | "dossier";
  } = {},
): VerdictEmission {
  const dossier = options.parcours === "dossier";
  try {
    if (f.statut !== "sous_traitant" || f.organismeSousTraitantId !== null) {
      return { ok: false, refus: [REFUS_EMISSION.horsPerimetre] };
    }
    if (f.finCollaborationAt !== null) return { ok: false, refus: [REFUS_EMISSION.fin] };
    if (
      versionCible === null ||
      !Number.isInteger(versionCible) ||
      versionCible < VERSION_MINIMALE_CONTRAT_INDEPENDANT
    ) {
      return { ok: false, refus: [REFUS_EMISSION.version] };
    }

    const vivants = f.contrats.filter((c) => c.annuleeAt === null);
    const refus: string[] = [];
    if (vivants.some((c) => c.statutSignature === SIGNE_PAR_UNE_PARTIE)) {
      refus.push(REFUS_EMISSION.enAttente);
    }
    if (vivants.some((c) => c.version >= versionCible)) refus.push(REFUS_EMISSION.dejaEmis);
    if (
      vivants.some(
        (c) =>
          c.version < versionCible &&
          c.statutSignature !== "signee" &&
          c.signatures === 0 &&
          (c.liensActifs ?? 0) > 0,
      )
    ) {
      refus.push(REFUS_EMISSION.lienEnCours);
    }

    if (!dossier && !vigilanceProuvee(f.pieces, f.preuvesVigilance, maintenant)) {
      refus.push(REFUS_EMISSION.vigilance);
    }
    const controle = etatControle(f.controles, maintenant);
    if (dossier ? controle.statut === "rouge" || controle.statut === "aucun" : !controle.probant) {
      refus.push(REFUS_EMISSION.controle);
    }

    const siret = siretNormalise(f.siret);
    const dernier = [...f.controles].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    )[0];
    if (!/^\d{14}$/.test(siret) || siretNormalise(dernier?.siret) !== siret) {
      refus.push(REFUS_EMISSION.siret);
    }

    if (!f.registre.lu) {
      refus.push(REFUS_EMISSION.registreMuet);
    } else {
      if (!f.registre.active || siretNormalise(f.registre.siret) !== siret) {
        refus.push(REFUS_EMISSION.inactive);
      }
      if (f.registre.entrepreneurIndividuel !== true) refus.push(REFUS_EMISSION.societe);
    }

    if (refus.length > 0) return { ok: false, refus };
    return {
      ok: true,
      aRemplacer: vivants
        .filter((c) => c.version < versionCible && c.signatures === 0)
        .filter((c) => c.statutSignature !== "signee")
        .map((c) => c.id),
    };
  } catch {
    return { ok: false, refus: [MANQUES_COMPLETS.erreur] };
  }
}

/** Les champs d'Axion propres au contrat-cadre (configuration, jamais inventés). */
export interface ChampsAxionContrat {
  readonly regionDeclaration: string;
  readonly adresseFormateurs: string;
  /** Organisme certificateur Qualiopi ; vide = non imprimé. */
  readonly certificateur: string;
}

/** Les données du contrat-cadre d'un indépendant en nom propre. */
export function donneesContratCadreIndependant(
  f: FaitsEmissionContrat,
  axion: ChampsAxionContrat,
  numero: string,
  dateContrat: string,
): ContratCadreData {
  const nda = (f.sousTraitantNda ?? "").trim();
  const tva = (f.numeroTvaIntracom ?? "").trim();
  const certificateur = axion.certificateur.trim();
  return {
    numero,
    nature: "independant",
    cocontractant: {
      prenomNom: `${f.prenom} ${f.nom}`.replace(/\s+/g, " ").trim(),
      societe: null,
      siret: siretNormalise(f.siret),
      adresse: (f.adresseProfessionnelle ?? "").trim(),
      // Un numéro « en cours » (ou absent) s'imprime « en cours d'obtention » (article 19).
      numeroDeclaration: /^\d{11}$/.test(nda.replace(/\s+/g, "")) ? nda : null,
      tvaIntracom: tva === "" ? null : tva,
      email: f.email.trim(),
    },
    // Toujours donné par un indépendant (annexe 3).
    mandatAutofacturation: true,
    axion: {
      regionDeclaration: axion.regionDeclaration.trim(),
      adresseFormateurs: axion.adresseFormateurs.trim(),
      ...(certificateur !== "" ? { certificateur } : {}),
    },
    dateContrat,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lot L7d — à faire re-signer
// ─────────────────────────────────────────────────────────────────────────────

/** Le contrat en vigueur : la plus haute version CONTRESIGNÉE, non annulée (jamais « la plus récente émise »). */
export function versionEnVigueur(contrats: ReadonlyArray<ContratEmisLu>): number | null {
  const v = contrats
    .filter((c) => c.annuleeAt === null && c.statutSignature === "signee")
    .map((c) => c.version);
  return v.length === 0 ? null : Math.max(...v);
}

/**
 * À faire re-signer : un contrat v3 ou plus en vigueur, mais antérieur à la dernière
 * version arrêtée. Un indépendant sans contrat v3 en vigueur relève de la mise à niveau
 * (L9b), pas d'ici.
 */
export function aFaireResigner(
  contrats: ReadonlyArray<ContratEmisLu>,
  derniere: number | null,
): boolean {
  const v = versionEnVigueur(contrats);
  return (
    derniere !== null && v !== null && v >= VERSION_MINIMALE_CONTRAT_INDEPENDANT && v < derniere
  );
}
