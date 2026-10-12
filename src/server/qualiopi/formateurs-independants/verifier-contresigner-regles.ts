/**
 * Écran « Vérifier et contresigner » (W-4, lot L9) — RÈGLES PURES.
 *
 * Cinq blocs à pastille, de haut en bas, et un seul bouton. Le bouton reste
 * grisé tant qu'un bloc est « à faire » ; la raison s'affiche en une ligne
 * (« Pour contresigner, il manque : … »). La MÊME fonction décide du grisé à
 * l'écran et du refus côté serveur : l'écran ne promet jamais ce que le
 * serveur refusera.
 *
 * Module pur : lisible par le composant client comme par l'action.
 */

import type { StatutControle } from "./controle-regles";
import { codeVigilanceBienForme, normaliserCodeVigilance } from "./vigilance";
import { LIBELLE_ATTESTATION_PLUS_TARD } from "./vigilance-seuil";

export type Pastille = "vert" | "orange" | "a_faire" | "rouge" | "neutre";

export type CleBloc = "entreprise" | "nda" | "attestation" | "pieces" | "formations";

export interface Bloc {
  readonly cle: CleBloc;
  readonly titre: string;
  readonly pastille: Pastille;
  readonly detail: string;
}

export interface PieceW4 {
  readonly id: string;
  readonly statutValidation: string;
  readonly fichierPresent: boolean;
}

/** Ce que l'écran lit — calculé côté serveur, sans donnée personnelle sensible. */
export interface FaitsW4 {
  readonly controle: {
    readonly statut: StatutControle;
    readonly dernierAt: Date | null;
    /** Raison de l'orange ou du rouge, déjà en clair. */
    readonly raison: string | null;
    /** Codes du contrôle jugé (`MotifControle`) : ce que la personne a vu. */
    readonly motifs: ReadonlyArray<string>;
  };
  readonly nda: { readonly renseigne: boolean; readonly vuSurListe: boolean };
  /** Attestation URSSAF la plus récente, ou `null` si aucune n'est déposée. */
  readonly attestation: {
    readonly id: string;
    readonly statutValidation: string;
    /** Code relevé au dépôt (`numeroPiece`), s'il est connu : pré-remplit la saisie. */
    readonly code: string | null;
    /** Validée, non échue ET portant sa preuve de vérification. */
    readonly prouvee: boolean;
  } | null;
  /**
   * Lot G1 — le cumul des honoraires HT a atteint le seuil de vigilance : l'attestation
   * est exigée. Absent : OUI (comportement d'avant le lot). Sous le seuil, une attestation
   * déposée reste vérifiable ici, sans bloquer la contresignature.
   */
  readonly vigilanceExigible?: boolean;
  readonly pieces: {
    readonly cv: PieceW4 | null;
    readonly rcPro: PieceW4 | null;
    readonly rib: PieceW4 | null;
  };
  readonly dossier: {
    /** Le CV porte une date d'émission de moins de 24 mois (règle complète, condition 6). */
    readonly cvDate: boolean;
    readonly regimeTva: boolean;
    readonly iban: boolean;
    readonly declarations: boolean;
  };
  readonly habilitationsActives: number;
  /** Le contrat-cadre v3 à contresigner, ou `null`. */
  readonly contrat: {
    readonly id: string;
    readonly numero: string;
    /** `partielle` = signé par le formateur ; `signee` = déjà contresigné. */
    readonly statutSignature: string;
  } | null;
  readonly actif: boolean;
  readonly finCollaboration: boolean;
}

/** Ce que la personne coche à l'écran. */
export interface SaisieW4 {
  /** Code de vérification lu sur l'attestation (à copier sur urssaf.fr). */
  readonly codeAttestation: string;
  readonly attestationAuthentique: boolean;
  readonly piecesVerifiees: boolean;
  readonly formationIds: ReadonlyArray<string>;
  /** « J'ai vérifié » sur un registre orange, avec un motif de la liste. */
  readonly orangeVerifie: boolean;
  readonly motifOrange: string | null;
}

/** Motifs fermés de « J'ai vérifié » (au moins 10 caractères chacun : `validerControleOrange`). */
export const MOTIFS_ORANGE = [
  "Activité de formation exercée sous un code d'activité voisin",
  "Numéro de déclaration en cours d'attribution",
  "Numéro de déclaration vérifié à la main sur la liste publique",
  "Registre momentanément muet, entreprise vérifiée à la main",
] as const;

/** Motifs fermés de « Demander un complément » (F12). */
export const MOTIFS_COMPLEMENT = [
  "l'attestation URSSAF",
  "le CV",
  "le RIB",
  "l'attestation d'assurance RC pro",
  "le numéro de déclaration d'activité",
  "le régime de TVA",
] as const;

export type MotifComplement = (typeof MOTIFS_COMPLEMENT)[number];

const piecePresente = (p: PieceW4 | null): p is PieceW4 =>
  p !== null && p.fichierPresent && p.statutValidation !== "rejete";

const pieceValidee = (p: PieceW4 | null): boolean =>
  p !== null && p.fichierPresent && p.statutValidation === "valide";

function pieceAFaire(f: FaitsW4): boolean {
  const { cv, rcPro, rib } = f.pieces;
  return [cv, rib, ...(piecePresente(rcPro) ? [rcPro] : [])].some((p) => !pieceValidee(p));
}

/** Ce qui manque au dossier lui-même (rien à cocher : un complément à demander). */
function manquesDossier(f: FaitsW4): string[] {
  const m: string[] = [];
  if (!piecePresente(f.pieces.cv)) m.push("le CV");
  else if (!f.dossier.cvDate) m.push("un CV daté de moins de 24 mois");
  if (!piecePresente(f.pieces.rib)) m.push("le RIB");
  if (!f.dossier.iban) m.push("l'IBAN");
  if (!f.dossier.regimeTva) m.push("le régime de TVA");
  if (!f.dossier.declarations) m.push("les déclarations");
  return m;
}

/** Motifs d'orange que le bloc « Numéro de déclaration » couvre quand il est à vérifier. */
export const MOTIFS_ORANGE_NDA: ReadonlyArray<string> = [
  "nda_absent",
  "nda_en_cours",
  "liste_of_muette",
  "nda_non_verifie",
  "nda_hors_liste",
];

/**
 * Les motifs d'orange que « J'ai vérifié » couvre : ceux du contrôle affiché,
 * plus ceux du numéro de déclaration quand son bloc était à vérifier. Un orange
 * relu à la contresignature avec un AUTRE motif n'est jamais validé à l'aveugle.
 */
export function motifsCouverts(f: FaitsW4): ReadonlyArray<string> {
  return [
    ...(f.controle.statut === "orange_a_valider" ? f.controle.motifs : []),
    ...(!f.nda.vuSurListe ? MOTIFS_ORANGE_NDA : []),
  ];
}

/** Motifs codés d'un contrôle qui font dire « entreprise fermée » (F13). */
export function motifRefus(f: FaitsW4): "entreprise fermée" | "numéro introuvable" {
  return f.controle.motifs.some((m) => m === "siren_cesse" || m === "etablissement_ferme")
    ? "entreprise fermée"
    : "numéro introuvable";
}

export const orangeAVerifier = (f: FaitsW4): boolean =>
  f.controle.statut === "orange_a_valider" ||
  (!f.nda.vuSurListe && f.controle.statut !== "orange_valide");

const orangeCoche = (s: SaisieW4): boolean =>
  s.orangeVerifie &&
  s.motifOrange !== null &&
  (MOTIFS_ORANGE as ReadonlyArray<string>).includes(s.motifOrange);

export const attestationCochee = (s: SaisieW4): boolean =>
  s.attestationAuthentique && codeVigilanceBienForme(normaliserCodeVigilance(s.codeAttestation));

const DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

/** Les cinq blocs, dans l'ordre de la maquette. */
export function blocsW4(f: FaitsW4, s: SaisieW4): Bloc[] {
  const c = f.controle;
  const lu = c.dernierAt ? ` · relu le ${DATE.format(c.dernierAt)}` : "";
  const entreprise: Bloc = {
    cle: "entreprise",
    titre: "1 · Entreprise",
    ...(c.statut === "rouge"
      ? {
          pastille: "rouge",
          detail: `${c.raison ?? "Entreprise fermée ou cessée au registre."}${lu}`,
        }
      : c.statut === "vert" || c.statut === "orange_valide"
        ? { pastille: "vert", detail: `Registre : active${lu}` }
        : c.statut === "orange_a_valider"
          ? {
              pastille: orangeCoche(s) ? "vert" : "orange",
              detail: `${c.raison ?? "À contrôler."}${lu}`,
            }
          : { pastille: "neutre", detail: "Relu en direct au moment de contresigner." }),
  };

  const nda: Bloc = {
    cle: "nda",
    titre: "2 · Numéro de déclaration",
    ...(f.nda.vuSurListe
      ? { pastille: "vert", detail: "Sur la liste publique, même numéro d'entreprise." }
      : c.statut === "orange_valide" || orangeCoche(s)
        ? { pastille: "vert", detail: "Vérifié par vous." }
        : {
            pastille: "orange",
            detail: f.nda.renseigne
              ? "Pas encore vu sur la liste publique."
              : "En cours d'attribution.",
          }),
  };

  const a = f.attestation;
  const exigible = f.vigilanceExigible !== false;
  const attestation: Bloc = {
    cle: "attestation",
    titre: "3 · Attestation URSSAF",
    ...(!exigible && (a === null || (!a.prouvee && a.statutValidation !== "en_attente"))
      ? { pastille: "neutre", detail: `Pas exigée : ${LIBELLE_ATTESTATION_PLUS_TARD}.` }
      : !exigible && a !== null && !a.prouvee && !attestationCochee(s)
        ? {
            pastille: "neutre",
            detail: `Déposée sans être exigée (${LIBELLE_ATTESTATION_PLUS_TARD}) : vérifiez-la sur urssaf.fr avec son code si vous le pouvez.`,
          }
        : a === null
          ? { pastille: "rouge", detail: "Pas déposée." }
          : a.prouvee
            ? { pastille: "vert", detail: "Vérifiée sur urssaf.fr." }
            : a.statutValidation !== "en_attente"
              ? {
                  pastille: "rouge",
                  detail: "Refusée ou échue : une nouvelle attestation est à déposer.",
                }
              : {
                  pastille: attestationCochee(s) ? "vert" : "a_faire",
                  detail: "À vérifier sur urssaf.fr avec son code.",
                }),
  };

  const md = manquesDossier(f);
  const pieces: Bloc = {
    cle: "pieces",
    titre: "4 · Pièces",
    ...(md.length > 0
      ? { pastille: "rouge", detail: `Manque : ${md.join(", ")}.` }
      : !pieceAFaire(f)
        ? { pastille: "vert", detail: "Pièces vérifiées." }
        : {
            pastille: s.piecesVerifiees ? "vert" : "a_faire",
            detail: piecePresente(f.pieces.rcPro) ? "CV · RC pro · RIB" : "CV · RIB",
          }),
  };

  const nbFormations = f.habilitationsActives + s.formationIds.length;
  const formations: Bloc = {
    cle: "formations",
    titre: "5 · Formations qu'il anime",
    pastille: nbFormations > 0 ? "vert" : "a_faire",
    detail:
      nbFormations > 0
        ? `${nbFormations} formation${nbFormations > 1 ? "s" : ""}.`
        : "Rien n'est coché d'office.",
  };

  return [entreprise, nda, attestation, pieces, formations];
}

/**
 * Ce qui manque pour contresigner, dans l'ordre des blocs. Vide = bouton actif.
 * Le serveur appelle la même fonction avant tout geste.
 */
export function manquesPourContresigner(f: FaitsW4, s: SaisieW4): string[] {
  if (f.finCollaboration) return ["une collaboration en cours"];
  const m: string[] = [];
  if (
    f.contrat === null ||
    (f.contrat.statutSignature !== "partielle" && f.contrat.statutSignature !== "signee")
  ) {
    m.push("le contrat signé par le formateur");
  }
  if (f.controle.statut === "rouge") m.push("une entreprise active au registre");
  else if (orangeAVerifier(f) && !orangeCoche(s)) m.push("la vérification du registre");

  const a = f.attestation;
  // Lot G1 : sous le seuil de vigilance, l'attestation ne manque jamais.
  if (f.vigilanceExigible !== false) {
    if (a === null || (!a.prouvee && a.statutValidation !== "en_attente")) {
      m.push("l'attestation URSSAF");
    } else if (!a.prouvee && !attestationCochee(s)) {
      m.push("l'attestation vérifiée");
    }
  }

  const md = manquesDossier(f);
  if (md.length > 0) m.push(...md);
  else if (pieceAFaire(f) && !s.piecesVerifiees) m.push("les pièces vérifiées");

  if (f.habilitationsActives + s.formationIds.length === 0) m.push("au moins une formation");
  return m;
}

/** La ligne sous le bouton grisé. */
export function raisonGrise(manques: ReadonlyArray<string>): string {
  return manques.length === 0 ? "" : `Pour contresigner, il manque : ${manques.join(" · ")}.`;
}

/** « Refuser le dossier » n'est proposé que sur un registre rouge (F13). */
export function refusPossible(f: FaitsW4): boolean {
  return f.controle.statut === "rouge" && !f.actif;
}
