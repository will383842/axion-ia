// Droits RGPD d'un FORMATEUR INDÉPENDANT (lot L16a, ADR 0066) : export art. 15 et
// effacement art. 17. Module à part, calque de `rgpd-reseau-apporteur.ts`.
//
// 🔴 LIVRÉ ÉTEINT. Tant que l'interrupteur `formateurs.dossier_en_ligne` n'est pas
// allumé, les deux routes se comportent comme aujourd'hui (la fiche `Trainer` reste
// une exception déclarée). L'allumage du dossier en ligne exige ce lot en ligne
// (ordre d'allumage n° 4) : c'est le dossier qui fait entrer des pièces et un IBAN.
//
// Règles :
// · l'IBAN n'est JAMAIS rendu en entier, même à la personne (4 premiers et
//   4 derniers signes) ;
// · une pièce sort sans ses octets ni son adresse de stockage ;
// · RIEN n'est supprimé : ni la fiche `Trainer` (missions, relevés, preuves de
//   vigilance, autofactures), ni une pièce, ni ses octets. L'effacement est une
//   PSEUDONYMISATION, posée par un administrateur, jamais déclenchée seule.

import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { cleSetting, lireValeur } from "@/server/qualiopi/formateurs-independants/interrupteurs";

/** Marqueur d'effacement (même valeur que `rgpd-erase.ts`). */
const EFFACE = "[erased-rgpd-art17]";

export type EtatDroitsFormateur = "actif" | "eteint" | "illisible";

/**
 * L'interrupteur `dossier_en_ligne` : absent ou illisible en VALEUR = éteint ;
 * base injoignable = `illisible` (l'effacement le dit, il ne se déclare pas fait).
 */
export async function etatDroitsFormateur(): Promise<EtatDroitsFormateur> {
  try {
    const ligne = await prisma.setting.findUnique({
      where: { key: cleSetting("dossier_en_ligne") },
      select: { value: true },
    });
    return lireValeur("dossier_en_ligne", ligne?.value).valeur === true ? "actif" : "eteint";
  } catch {
    return "illisible";
  }
}

async function droitsFormateurActifs(): Promise<boolean> {
  return (await etatDroitsFormateur()) === "actif";
}

/** « FR76 •••• •••• 0189 » : jamais l'IBAN entier. */
export function masquerIbanFormateur(clair: string | null | undefined): string | null {
  if (typeof clair !== "string") return null;
  const s = clair.replace(/\s+/g, "").toUpperCase();
  if (s.length < 8) return "••••";
  return `${s.slice(0, 4)} •••• •••• ${s.slice(-4)}`;
}

function ibanLisibleMasque(trainerId: string, iban: string | null): string | null {
  if (iban === null || iban === "") return null;
  try {
    return masquerIbanFormateur(decryptPii(iban, { aad: `trainer:${trainerId}:iban` }));
  } catch {
    return "enregistré (illisible)";
  }
}

const SELECT_FICHE = {
  id: true,
  prenom: true,
  nom: true,
  email: true,
  telephone: true,
  statut: true,
  siret: true,
  sousTraitantNda: true,
  adresseProfessionnelle: true,
  adressePersonnelle: true,
  codePostalPro: true,
  region: true,
  regionsIntervention: true,
  dateNaissance: true,
  lieuNaissance: true,
  numeroTvaIntracom: true,
  regimeTvaHonoraires: true,
  mandatAutofacturationSigneAt: true,
  mandatAutofacturationRevoqueAt: true,
  iban: true,
  dossierStatut: true,
  dossierOuvertAt: true,
  dossierEnvoyeAt: true,
  declarations: true,
  declarationsAt: true,
  sousTraitantContratSigneAt: true,
  activationValideeAt: true,
  actif: true,
  finCollaborationAt: true,
} as const;

/**
 * Égalité STRICTE : la colonne est `citext` (casse ignorée par la base). Jamais
 * `mode: "insensitive"`, qui passe par un motif où `_` est un joker.
 */
function ficheIndependante(email: string) {
  return { email, statut: "sous_traitant" as const };
}

export interface ExportFormateurIndependant {
  readonly identite: {
    readonly prenom: string;
    readonly nom: string;
    readonly email: string;
    readonly telephone: string | null;
    readonly adresseProfessionnelle: string | null;
    readonly adressePersonnelle: string | null;
    readonly codePostal: string | null;
    readonly region: string | null;
    readonly regionsIntervention: ReadonlyArray<string>;
    readonly dateNaissance: Date | null;
    readonly lieuNaissance: string | null;
  };
  readonly entreprise: {
    readonly siret: string | null;
    readonly numeroDeclarationActivite: string | null;
    readonly numeroTvaIntracom: string | null;
    readonly regimeTva: string | null;
  };
  /** Masqué : jamais l'IBAN entier. */
  readonly iban: string | null;
  readonly dossier: {
    readonly statut: string | null;
    readonly ouvertLe: Date | null;
    readonly envoyeLe: Date | null;
    readonly declarations: unknown;
    readonly declarationsLe: Date | null;
  };
  readonly relation: {
    readonly contratSigneLe: Date | null;
    readonly activeLe: Date | null;
    readonly mandatAutofacturationSigneLe: Date | null;
    readonly mandatAutofacturationRevoqueLe: Date | null;
    readonly actif: boolean;
    readonly finLe: Date | null;
  };
  readonly pieces: ReadonlyArray<{
    readonly type: string;
    readonly statut: string;
    readonly emiseLe: Date | null;
    readonly expireLe: Date | null;
    readonly deposeeLe: Date;
  }>;
  readonly controlesRegistre: ReadonlyArray<{
    readonly le: Date;
    readonly verdict: string;
    readonly source: string;
  }>;
  readonly verificationsVigilance: ReadonlyArray<{
    readonly le: Date;
    readonly resultat: string;
    readonly attestationDu: Date | null;
    readonly valableJusquau: Date | null;
  }>;
}

/** Export art. 15 ; `null` si éteint ou si aucune fiche d'indépendant ne porte l'adresse. */
export async function exporterFormateurIndependantPour(
  email: string,
): Promise<ExportFormateurIndependant | null> {
  if (!(await droitsFormateurActifs())) return null;
  const t = await prisma.trainer.findFirst({
    where: ficheIndependante(email),
    select: SELECT_FICHE,
  });
  if (!t) return null;
  const [pieces, controles, preuves] = await Promise.all([
    prisma.trainerDocument.findMany({
      where: { trainerId: t.id },
      select: {
        type: true,
        statutValidation: true,
        dateEmission: true,
        dateExpiration: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.verificationRegistreSousTraitance.findMany({
      where: { trainerId: t.id },
      select: { verifieAt: true, verdict: true, source: true },
      orderBy: { verifieAt: "asc" },
    }),
    prisma.preuveVigilance.findMany({
      where: { trainerId: t.id },
      select: { verifieeAt: true, resultat: true, dateAttestation: true, dateFinValidite: true },
      orderBy: { verifieeAt: "asc" },
    }),
  ]);
  return {
    identite: {
      prenom: t.prenom,
      nom: t.nom,
      email: t.email,
      telephone: t.telephone,
      adresseProfessionnelle: t.adresseProfessionnelle,
      adressePersonnelle: t.adressePersonnelle,
      codePostal: t.codePostalPro,
      region: t.region,
      regionsIntervention: t.regionsIntervention,
      dateNaissance: t.dateNaissance,
      lieuNaissance: t.lieuNaissance,
    },
    entreprise: {
      siret: t.siret,
      numeroDeclarationActivite: t.sousTraitantNda,
      numeroTvaIntracom: t.numeroTvaIntracom,
      regimeTva: t.regimeTvaHonoraires,
    },
    iban: ibanLisibleMasque(t.id, t.iban),
    dossier: {
      statut: t.dossierStatut,
      ouvertLe: t.dossierOuvertAt,
      envoyeLe: t.dossierEnvoyeAt,
      declarations: t.declarations,
      declarationsLe: t.declarationsAt,
    },
    relation: {
      contratSigneLe: t.sousTraitantContratSigneAt,
      activeLe: t.activationValideeAt,
      mandatAutofacturationSigneLe: t.mandatAutofacturationSigneAt,
      mandatAutofacturationRevoqueLe: t.mandatAutofacturationRevoqueAt,
      actif: t.actif,
      finLe: t.finCollaborationAt,
    },
    pieces: pieces.map((p) => ({
      type: p.type,
      statut: p.statutValidation,
      emiseLe: p.dateEmission,
      expireLe: p.dateExpiration,
      deposeeLe: p.createdAt,
    })),
    controlesRegistre: controles.map((c) => ({
      le: c.verifieAt,
      verdict: c.verdict,
      source: c.source,
    })),
    verificationsVigilance: preuves.map((p) => ({
      le: p.verifieeAt,
      resultat: p.resultat,
      attestationDu: p.dateAttestation,
      valableJusquau: p.dateFinValidite,
    })),
  };
}

// ─── Effacement art. 17 ─────────────────────────────────────────────────────

const COMPTES_LIEN = {
  statements: true,
  feeLines: true,
  missionsFormateur: true,
  sessionFormateurs: true,
  documentsGeneres: true,
  preuvesVigilance: true,
  // Sessions animées, coachings, émargements signés ou contresignés : la
  // prestation a eu lieu, même sans ligne `SessionFormateur`.
  sessionsAnimees: true,
  coachingSessions: true,
  signaturesRecueillies: true,
  emargementContresignatures: true,
} as const;

interface FicheLien {
  readonly sousTraitantContratSigneAt: Date | null;
  readonly activationValideeAt: Date | null;
  readonly mandatAutofacturationSigneAt: Date | null;
  readonly _count: Readonly<Record<keyof typeof COMPTES_LIEN, number>>;
}

/**
 * Un lien contractuel impose de CONSERVER l'identité (art. 17(3)(b)) : contrat
 * signé, mandat d'autofacturation, activation, missions, sessions animées,
 * coachings, émargements, relevés, autofactures, pièces générées, ou
 * vigilance vérifiée (conservée 5 ans après la fin).
 */
export function aUnLienContractuel(f: FicheLien): boolean {
  if (
    f.sousTraitantContratSigneAt !== null ||
    f.activationValideeAt !== null ||
    f.mandatAutofacturationSigneAt !== null
  ) {
    return true;
  }
  return Object.values(f._count).some((n) => n > 0);
}

/**
 * Pièces qu'une OBLIGATION LÉGALE impose de garder telles quelles, en toutes
 * circonstances : contrats, preuves de vigilance (art. L.8222-1 et D.8222-5),
 * pièces de la vérification du sous-traitant (Qualiopi ind. 27). Elles restent
 * INTACTES : ni masquées, ni modifiées, contenu compris.
 */
const PIECES_LEGALES: ReadonlySet<string> = new Set([
  "contrat_travail",
  "dpae",
  "contrat_sous_traitance",
  "attestation_vigilance_urssaf",
  "kbis_avis_sirene",
  "nda_sous_traitant",
  "recepisse_declaration_activite",
  "attestation_qualiopi",
  "assurance_rc_pro",
]);

/**
 * Avec un lien contractuel, s'y ajoutent les preuves de compétence (Qualiopi
 * ind. 21-22, pour les missions faites) et le RIB (support des paiements).
 */
const PIECES_LEGALES_SI_LIEN: ReadonlySet<string> = new Set(["diplome", "certification", "rib"]);

/** Une pièce que la loi impose de garder intacte. Les autres sont MASQUÉES, jamais supprimées. */
export function pieceAObligationDeConservation(type: string, lienContractuel: boolean): boolean {
  return PIECES_LEGALES.has(type) || (lienContractuel && PIECES_LEGALES_SI_LIEN.has(type));
}

/** Confirmation que l'administrateur doit saisir, mot pour mot. */
export const CONFIRMATION_EFFACEMENT_FORMATEUR = "EFFACER";

/** Motif posé sur une pièce masquée : la pièce est conservée, jamais supprimée. */
export const MOTIF_MASQUAGE_ART17 = `${EFFACE} pièce masquée, conservée`;

export interface EffacementFormateurResult {
  readonly formateur: "eteint" | "illisible" | "aucun" | "efface" | "conserve_obligation_legale";
  /** Pièces sans obligation de conservation, masquées par ce passage. */
  readonly piecesMasquees: number;
  /** Pièces légales laissées intactes. */
  readonly piecesLegalesIntactes: number;
}

/** Ligne de journal écrite dans la transaction de l'effacement. */
export interface LigneJournalEffacement {
  readonly adminUserId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly changes: never;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

/**
 * Effacement art. 17 d'un formateur indépendant, par PSEUDONYMISATION.
 *
 * 🔴 AUCUNE SUPPRESSION. Ni la fiche, ni une pièce, ni les octets d'une pièce :
 * - pièces légales ({@link pieceAObligationDeConservation}) : intactes ;
 * - autres pièces (CV, « autre »…) : conservées, MASQUÉES par `archiveAt` /
 *   `archiveMotif` (la pièce et son contenu restent en base) ;
 * - sans lien contractuel : les champs d'identité de la fiche sont remplacés
 *   par le marqueur ; avec un lien, l'identité de facturation est conservée
 *   (art. 17(3)(b)) et seul le téléphone est retiré ;
 * - les accès du formateur sont révoqués (`accesVersion`).
 *
 * Réservé à l'administrateur (l'action console porte la garde et la
 * confirmation) ; rien ne l'appelle seul. Le journal est écrit dans la MÊME
 * transaction, sans donnée personnelle : identifiant de la fiche et comptes.
 */
export async function effacerFormateurIndependant(
  trainerId: string,
  options: {
    /** Identifiant (UUID) de l'administrateur qui pose le geste. */
    readonly acteurId: string;
    readonly journal: (r: EffacementFormateurResult) => Promise<LigneJournalEffacement>;
  },
): Promise<EffacementFormateurResult> {
  const etat = await etatDroitsFormateur();
  // `illisible` est rendu tel quel : jamais déclaré fait en silence.
  if (etat !== "actif") return { formateur: etat, piecesMasquees: 0, piecesLegalesIntactes: 0 };
  return prisma.$transaction(async (tx): Promise<EffacementFormateurResult> => {
    // Lu DANS la transaction : le lien contractuel est jugé sur l'état écrit.
    const t = await tx.trainer.findFirst({
      where: { id: trainerId, statut: "sous_traitant" },
      select: {
        id: true,
        sousTraitantContratSigneAt: true,
        activationValideeAt: true,
        mandatAutofacturationSigneAt: true,
        _count: { select: COMPTES_LIEN },
      },
    });
    if (!t) return { formateur: "aucun", piecesMasquees: 0, piecesLegalesIntactes: 0 };
    const lien = aUnLienContractuel(t);
    const pieces = await tx.trainerDocument.findMany({
      where: { trainerId: t.id },
      select: { id: true, type: true, archiveAt: true },
    });
    const legales = pieces.filter((p) => pieceAObligationDeConservation(p.type, lien));
    const aMasquer = pieces
      .filter((p) => !pieceAObligationDeConservation(p.type, lien) && p.archiveAt === null)
      .map((p) => p.id);
    const masquees =
      aMasquer.length === 0
        ? 0
        : (
            await tx.trainerDocument.updateMany({
              where: { id: { in: aMasquer }, archiveAt: null },
              data: {
                archiveAt: new Date(),
                archiveParId: options.acteurId,
                archiveMotif: MOTIF_MASQUAGE_ART17,
              },
            })
          ).count;

    if (lien) {
      await tx.trainer.update({
        where: { id: t.id },
        data: { telephone: null, accesVersion: { increment: 1 } },
      });
    } else {
      await tx.trainer.update({
        where: { id: t.id },
        data: {
          prenom: EFFACE,
          nom: EFFACE,
          // Par l'IDENTIFIANT de la fiche : une même adresse effacée deux fois
          // (recandidature) ne heurte jamais l'unicité de `trainers.email`.
          email: `erased:${t.id}@erased.local`,
          emailHash: null,
          telephone: null,
          iban: null,
          ibanEmpreinte: null,
          siret: null,
          // Le numéro de TVA d'une entreprise individuelle contient son SIREN.
          numeroTvaIntracom: null,
          sousTraitantNda: null,
          region: null,
          adresseProfessionnelle: null,
          adressePersonnelle: null,
          codePostalPro: null,
          communeInsee: null,
          geoLat: null,
          geoLng: null,
          dateNaissance: null,
          lieuNaissance: null,
          // Les adresses de pièces (`cvUrl`, capture du registre, attestation
          // RC pro) ne sont PAS touchées : une pièce n'est jamais retirée.
          accesVersion: { increment: 1 },
        },
      });
    }
    const r: EffacementFormateurResult = {
      formateur: lien ? "conserve_obligation_legale" : "efface",
      piecesMasquees: masquees,
      piecesLegalesIntactes: legales.length,
    };
    await tx.activityLog.create({ data: await options.journal(r) });
    return r;
  });
}

/**
 * Pour la route d'effacement en libre-service : SIGNALE qu'une fiche de
 * formateur indépendant porte l'adresse, sans rien modifier. L'effacement de
 * la fiche est un geste d'administrateur ({@link effacerFormateurIndependant}).
 */
export async function formateurIndependantASignalerPour(
  email: string,
): Promise<"eteint" | "illisible" | "aucun" | "a_traiter_par_administrateur"> {
  const etat = await etatDroitsFormateur();
  if (etat !== "actif") return etat;
  try {
    const t = await prisma.trainer.findFirst({
      where: ficheIndependante(email),
      select: { id: true },
    });
    return t ? "a_traiter_par_administrateur" : "aucun";
  } catch {
    return "illisible";
  }
}

/**
 * Candidatures à NE PAS supprimer (W5 I-11) : celles d'où vient la fiche d'un
 * formateur sous lien contractuel — elles fondent la relation. Éteint = aucune.
 */
export async function candidaturesAConserverPour(email: string): Promise<ReadonlySet<string>> {
  if (!(await droitsFormateurActifs())) return new Set();
  const t = await prisma.trainer.findFirst({
    where: ficheIndependante(email),
    select: {
      candidatureId: true,
      candidatures: { select: { id: true } },
      sousTraitantContratSigneAt: true,
      activationValideeAt: true,
      mandatAutofacturationSigneAt: true,
      _count: { select: COMPTES_LIEN },
    },
  });
  if (!t || !aUnLienContractuel(t)) return new Set();
  const ids = new Set(t.candidatures.map((c) => c.id));
  if (t.candidatureId) ids.add(t.candidatureId);
  return ids;
}
