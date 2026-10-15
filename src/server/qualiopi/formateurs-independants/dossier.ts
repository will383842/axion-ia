/**
 * Formateurs indépendants — DONNÉES du dossier en ligne à jeton (lot L5, 05 E7, 08 §4 E1).
 *
 * Seule porte entre le lien personnel et la fiche `Trainer` :
 *   - `lireDossierParLien` : interrupteur `dossier_en_ligne` ALLUMÉ, lien bien formé, fiche
 *     d'un formateur indépendant ouverte, dossier en cours, jeton valide à la version
 *     d'accès courante et non échu. Tout le reste → `null` (la même page neutre) ;
 *   - les écritures : TOUTES conditionnelles (`updateMany` sur l'identifiant ET la version
 *     d'accès ET l'état modifiable) : un lien révoqué entre la lecture et l'écriture
 *     n'écrit rien.
 *
 * 🔴 Interrupteur absent ou illisible = ÉTEINT : aucune page, aucune écriture (position sûre).
 * 🔴 L'IBAN n'est jamais relu en clair ni réaffiché ; il ne se saisit qu'AVANT l'envoi du
 *    dossier (un changement ultérieur passe par une demande validée).
 * 🔴 Journal : identifiants seulement (UUID), jamais de nom, d'IBAN, de SIRET ni de code.
 *
 * Rendu à la demande : la base factice du build (`stub.invalid`) rend `null` partout.
 */

import "server-only";

import type { DossierFormateurStatut, Prisma } from "../../../../prisma/generated/client";

import { empreinteIban, ibanNormalise } from "@/lib/iban-empreinte";
import { encryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/server/journal/journaliser";
import {
  alerteAntivirusLimitee,
  chiffrerPieceAuRepos,
  controlerPiece,
} from "@/server/pieces/depot-controle";

import {
  DECLARATIONS_FORMATEUR,
  DECLARATIONS_VERSION,
  estPieceDossier,
  manquesDuDossier,
  type EtatDossier,
  type PieceDossier,
  type RegimeTvaDossier,
} from "./dossier-regles";
import { nomPropre } from "./depot";
import { estPieceArchivee } from "./gardes";
import { lireDrapeauEnvoi } from "./interrupteurs";
import { lireEtatsInterrupteurs } from "./interrupteurs-etat";
import { jetonDossierFormateurValide, lienDossierFormateurBienForme } from "./jeton-dossier";
import { ACTION_DEPOT_FORMATEUR, finValiditeVigilance } from "./vigilance";

/** États où le formateur complète encore son dossier. */
const MODIFIABLES: ReadonlyArray<DossierFormateurStatut> = ["en_cours", "a_completer"];

/** Réponses de la candidature qui préremplissent l'écran, sans rien écrire (05 E7). */
const REPONSE_CODE_POSTAL = "Code postal";
const REPONSE_SIRET = "Numéro SIRET";
const REPONSE_NUMERO_DECLARATION = "Numéro de déclaration d'activité";

export type EtatPage = "modifiable" | "a_verifier";

export interface PieceVue {
  readonly type: PieceDossier;
  readonly statut: "deposee" | "conforme" | "a_retransmettre";
  readonly motif: string | null;
  readonly nomFichier: string;
}

export interface DossierVue {
  readonly id: string;
  readonly accesVersion: number;
  readonly etat: EtatPage;
  readonly statut: DossierFormateurStatut;
  /** L'IBAN est-il déjà envoyé (dossier déjà parti une fois) : plus saisissable ici. */
  readonly ibanFige: boolean;
  readonly prenom: string;
  readonly nom: string;
  readonly email: string;
  readonly telephone: string | null;
  readonly codePostalPro: string | null;
  readonly siret: string | null;
  /**
   * V1-A-11 — l'adresse professionnelle de la fiche (celle que le contrat imprime).
   * Demandée à l'étape 2 quand le registre ne la donne pas (diffusion partielle).
   */
  readonly adressePro?: string | null;
  readonly nda: string | null;
  readonly regimeTva: RegimeTvaDossier | null;
  readonly ibanSaisi: boolean;
  readonly codeUrssafSaisi: boolean;
  readonly pieces: ReadonlyArray<PieceVue>;
  /** Préremplissage depuis la candidature (jamais écrit sans validation). */
  readonly suggestions: {
    readonly codePostal: string | null;
    readonly siret: string | null;
    readonly nda: string | null;
  };
}

const SELECTION = {
  id: true,
  statut: true,
  prenom: true,
  nom: true,
  email: true,
  telephone: true,
  accesVersion: true,
  dossierStatut: true,
  dossierEnvoyeAt: true,
  finCollaborationAt: true,
  organismeSousTraitantId: true,
  codePostalPro: true,
  siret: true,
  adresseProfessionnelle: true,
  sousTraitantNda: true,
  regimeTvaHonoraires: true,
  ibanEmpreinte: true,
  candidatureOrigine: { select: { answers: true } },
  documents: {
    where: { archiveAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      statutValidation: true,
      rejetMotif: true,
      numeroPiece: true,
      contenu: { select: { nomOriginal: true } },
    },
  },
} as const satisfies Prisma.TrainerSelect;

type Ligne = Prisma.TrainerGetPayload<{ select: typeof SELECTION }>;

function reponse(answers: unknown, cle: string): string | null {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return null;
  const v = (answers as Record<string, unknown>)[cle];
  return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 40) : null;
}

function vue(t: Ligne, etat: EtatPage): DossierVue {
  // La pièce la plus récente de chaque type fait foi (les remplacées sont archivées).
  const pieces: PieceVue[] = [];
  let codeUrssafSaisi = false;
  for (const d of t.documents) {
    if (!estPieceDossier(d.type) || pieces.some((p) => p.type === d.type)) continue;
    // Ancienne marque d'archivage (lot S1) : la pièce n'est plus active.
    if (estPieceArchivee(d.rejetMotif)) continue;
    pieces.push({
      type: d.type,
      statut:
        d.statutValidation === "valide"
          ? "conforme"
          : d.statutValidation === "rejete"
            ? "a_retransmettre"
            : "deposee",
      motif: d.statutValidation === "rejete" ? (d.rejetMotif ?? null) : null,
      nomFichier: d.contenu?.nomOriginal ?? "document",
    });
    if (d.type === "attestation_vigilance_urssaf") codeUrssafSaisi = !!d.numeroPiece;
  }
  const answers = t.candidatureOrigine?.answers ?? null;
  const ndaSuggere = reponse(answers, REPONSE_NUMERO_DECLARATION);
  return {
    id: t.id,
    accesVersion: t.accesVersion,
    etat,
    statut: t.dossierStatut!,
    ibanFige: t.dossierEnvoyeAt !== null && t.ibanEmpreinte !== null,
    prenom: t.prenom,
    nom: t.nom,
    email: t.email,
    telephone: t.telephone,
    codePostalPro: t.codePostalPro,
    siret: t.siret,
    adressePro: t.adresseProfessionnelle,
    nda: t.sousTraitantNda,
    regimeTva: t.regimeTvaHonoraires,
    ibanSaisi: t.ibanEmpreinte !== null,
    codeUrssafSaisi,
    pieces,
    suggestions: {
      codePostal: reponse(answers, REPONSE_CODE_POSTAL),
      siret: reponse(answers, REPONSE_SIRET),
      nda: ndaSuggere && /^[\d\s.]+$/.test(ndaSuggere) ? ndaSuggere : null,
    },
  };
}

/** L'interrupteur `dossier_en_ligne` est-il allumé ? Lecture en échec : non. */
export async function dossierEnLigneOuvert(): Promise<boolean> {
  return lireDrapeauEnvoi(await lireEtatsInterrupteurs(), "dossier_en_ligne");
}

/**
 * Le dossier de ce lien, ou `null` (page neutre). Ne lève jamais : une base injoignable
 * vaut « lien inconnu ».
 */
export async function lireDossierParLien(
  id: string,
  jeton: string,
  maintenant: Date = new Date(),
): Promise<DossierVue | null> {
  if (!lienDossierFormateurBienForme(id, jeton)) return null;
  if (process.env.DATABASE_URL?.includes("stub.invalid")) return null;
  try {
    if (!(await dossierEnLigneOuvert())) return null;
    const t = await prisma.trainer.findUnique({
      where: { id: id.toLowerCase() },
      select: SELECTION,
    });
    if (!t) return null;
    if (t.statut !== "sous_traitant") return null;
    if (t.finCollaborationAt !== null || t.organismeSousTraitantId !== null) return null;
    if (t.dossierStatut === null) return null;
    if (jetonDossierFormateurValide(t.id, t.accesVersion, jeton, maintenant)) {
      if (MODIFIABLES.includes(t.dossierStatut)) return vue(t, "modifiable");
      if (t.dossierStatut === "a_verifier") return vue(t, "a_verifier");
      return null;
    }
    // Le lien révoqué PAR L'ENVOI (version précédente) montre encore « Dossier reçu », en
    // lecture seule : aucune écriture n'est possible (`gardeEcriture` exige la version
    // courante et un état modifiable ; les actions exigent l'état « modifiable »).
    if (
      t.dossierStatut === "a_verifier" &&
      t.accesVersion >= 1 &&
      jetonDossierFormateurValide(t.id, t.accesVersion - 1, jeton, maintenant)
    ) {
      return vue(t, "a_verifier");
    }
    return null;
  } catch {
    return null;
  }
}

/** La clause commune de toute écriture : même fiche, même version d'accès, modifiable. */
function gardeEcriture(d: Pick<DossierVue, "id" | "accesVersion">): Prisma.TrainerWhereInput {
  return {
    id: d.id,
    accesVersion: d.accesVersion,
    statut: "sous_traitant",
    finCollaborationAt: null,
    organismeSousTraitantId: null,
    dossierStatut: { in: [...MODIFIABLES] },
  };
}

export type ResultatEcriture = { ok: true } | { ok: false; message: string };

const LIEN_PERIME: ResultatEcriture = {
  ok: false,
  message: "Ce lien n'est plus valable. Demandez-en un nouveau en répondant à notre e-mail.",
};

/** Étape 1 : téléphone et code postal professionnel. */
export async function enregistrerVous(
  d: DossierVue,
  v: { telephone: string | null; codePostalPro: string },
): Promise<ResultatEcriture> {
  const r = await prisma.trainer.updateMany({
    where: gardeEcriture(d),
    data: { telephone: v.telephone, codePostalPro: v.codePostalPro },
  });
  return r.count === 1 ? { ok: true } : LIEN_PERIME;
}

export interface Activite {
  siret: string;
  nda: string;
  regimeTva: RegimeTvaDossier;
  /** IBAN saisi, déjà validé (SEPA) ; `null` = inchangé. */
  iban: string | null;
  /**
   * V1-A-11 — adresse professionnelle saisie, déjà validée ; absente ou `null` = inchangée.
   * Écrite SEULEMENT avec `sansAdresseAuRegistre` : sinon le registre fait foi.
   */
  adressePro?: string | null;
  /** Le registre, rejugé côté serveur, ne donne pas l'adresse (diffusion partielle). */
  sansAdresseAuRegistre?: boolean;
}

/** Étape 2 : SIRET, numéro de déclaration, régime de TVA et, avant l'envoi, l'IBAN. */
export async function enregistrerActivite(d: DossierVue, a: Activite): Promise<ResultatEcriture> {
  const data: Prisma.TrainerUpdateManyMutationInput = {
    siret: a.siret,
    sousTraitantNda: a.nda,
    regimeTvaHonoraires: a.regimeTva,
    ...(a.sansAdresseAuRegistre === true && a.adressePro
      ? { adresseProfessionnelle: a.adressePro }
      : {}),
  };
  const where = gardeEcriture(d);
  if (a.iban !== null) {
    if (d.ibanFige) {
      return {
        ok: false,
        message:
          "Votre IBAN est déjà enregistré. Pour le changer, écrivez-nous : nous le vérifierons avant tout virement.",
      };
    }
    const empreinte = empreinteIban(a.iban);
    if (empreinte === null) {
      return {
        ok: false,
        message: "Votre IBAN n'a pas pu être enregistré. Réessayez dans quelques minutes.",
      };
    }
    // Chiffré `enc:v2:`, lié à la fiche ; clé exigée (lève sans clé : jamais en clair).
    data.iban = encryptPii(ibanNormalise(a.iban), {
      aad: `trainer:${d.id}:iban`,
      cleExigee: true,
    });
    data.ibanEmpreinte = empreinte;
    // L'IBAN ne se saisit qu'avant l'envoi : la clause l'exige aussi en base.
    where.dossierEnvoyeAt = null;
  }
  const r = await prisma.trainer.updateMany({ where, data });
  return r.count === 1 ? { ok: true } : LIEN_PERIME;
}

// Antivirus muet : une alerte au plus par quart d'heure (garde du dépôt commun, FAC-6),
// sans donnée personnelle.
const alerteAntivirus = alerteAntivirusLimitee(() => {
  void import("@sentry/nextjs")
    .then((S) =>
      S.captureMessage("formateur-dossier : pièce refusée, antivirus muet", {
        level: "warning",
        tags: { service: "formateur-dossier", etape: "depot-piece" },
      }),
    )
    .catch(() => undefined);
});

/** Minuit UTC du jour : une date de pièce, jamais une heure. */
function debutDuJourUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Étape 3 : une pièce, contrôlée (FAC-6), chiffrée au repos, l'ancienne archivée. */
export async function deposerPiece(
  d: DossierVue,
  p: {
    type: PieceDossier;
    nomFichier: string;
    octets: Uint8Array;
    dateEmission: Date | null;
  },
): Promise<ResultatEcriture> {
  const controle = await controlerPiece(p.nomFichier, p.octets, {
    alerterAntivirusIndisponible: () => alerteAntivirus.alerter(),
  });
  if (!controle.ok) return controle;
  const octets = chiffrerPieceAuRepos(p.octets);
  const maintenant = new Date();
  const ok = await prisma.$transaction(async (tx) => {
    // Relu DANS la transaction : un lien révoqué entre-temps n'écrit rien.
    const encore = await tx.trainer.updateMany({
      where: gardeEcriture(d),
      data: { updatedAt: maintenant },
    });
    if (encore.count !== 1) return "perime" as const;
    // Une pièce déjà VÉRIFIÉE ne se remplace pas ici (jamais deux pièces actives du type).
    const verifiee = await tx.trainerDocument.findFirst({
      where: { trainerId: d.id, type: p.type, archiveAt: null, statutValidation: "valide" },
      select: { id: true, rejetMotif: true },
    });
    if (verifiee && !estPieceArchivee(verifiee.rejetMotif)) return "verifiee" as const;
    // La pièce remplacée est ARCHIVÉE, jamais supprimée (une pièce validée ne se remplace pas).
    await tx.trainerDocument.updateMany({
      where: {
        trainerId: d.id,
        type: p.type,
        archiveAt: null,
        statutValidation: { not: "valide" },
      },
      data: { archiveAt: maintenant, archiveMotif: "remplacee_par_le_formateur" },
    });
    const doc = await tx.trainerDocument.create({
      data: {
        trainerId: d.id,
        type: p.type,
        hashSha256: controle.sha256,
        // V1-A-6 — le CV transmis dans le dossier est le CV ACTUEL de la personne : il est
        // daté de sa transmission. Sans date, la règle du CV de moins de 24 mois (W-4,
        // contresignature, activation) le tenait pour non daté, donc jamais probant.
        dateEmission: p.dateEmission ?? (p.type === "cv" ? debutDuJourUtc(maintenant) : null),
        dateExpiration:
          p.type === "attestation_vigilance_urssaf" && p.dateEmission
            ? finValiditeVigilance(p.dateEmission)
            : null,
        contenu: {
          create: {
            octets,
            taille: octets.length,
            sha256: controle.sha256,
            mime: controle.typeMime,
            nomOriginal: nomPropre(p.nomFichier),
          },
        },
      },
      select: { id: true },
    });
    // Trace de création « déposée par le formateur » : lue par la validation (L4b).
    await journaliser(
      tx,
      {
        action: ACTION_DEPOT_FORMATEUR,
        targetType: "TrainerDocument",
        targetId: doc.id,
        changes: { type: p.type, trainerId: d.id },
        session: null,
      },
      { exiger: true },
    );
    return "ok" as const;
  });
  if (ok === "verifiee") {
    return { ok: false, message: "Cette pièce est déjà vérifiée : rien à renvoyer." };
  }
  return ok === "ok" ? { ok: true } : LIEN_PERIME;
}

/** Étape 3 : le code de sécurité de l'attestation URSSAF, sur la pièce déposée. */
export async function enregistrerCodeUrssaf(
  d: DossierVue,
  code: string,
): Promise<ResultatEcriture> {
  const ok = await prisma.$transaction(async (tx) => {
    // Verrou de ligne (même ordre que le dépôt) : pas de course avec un remplacement.
    const encore = await tx.trainer.updateMany({
      where: gardeEcriture(d),
      data: { updatedAt: new Date() },
    });
    if (encore.count !== 1) return false;
    const r = await tx.trainerDocument.updateMany({
      where: {
        trainerId: d.id,
        type: "attestation_vigilance_urssaf",
        archiveAt: null,
        statutValidation: "en_attente",
      },
      data: { numeroPiece: code },
    });
    return r.count > 0;
  });
  return ok
    ? { ok: true }
    : { ok: false, message: "Ajoutez d'abord votre attestation URSSAF, puis son code." };
}

/**
 * Étape 4 : l'ENVOI du dossier. Les déclarations sont datées et versionnées ; le dossier
 * passe « à vérifier » et la version d'accès est incrémentée : le lien envoyé ne modifie
 * plus rien (révocation à l'envoi, 08 §4 E1).
 */
export async function envoyerDossier(
  d: DossierVue,
  entreprise: { readonly bloquante: boolean },
  maintenant: Date,
): Promise<ResultatEcriture> {
  const iso = maintenant.toISOString();
  const declarations = Object.fromEntries(DECLARATIONS_FORMATEUR.map((x) => [x.cle, iso]));
  const r = await prisma.$transaction(async (tx) => {
    // Verrou de ligne d'abord (même ordre que le dépôt et le code), puis RELECTURE : les
    // manques se calculent sur l'état en base, jamais sur l'instantané de la page.
    const verrou = await tx.trainer.updateMany({
      where: gardeEcriture(d),
      data: { updatedAt: maintenant },
    });
    if (verrou.count !== 1) return LIEN_PERIME;
    const t = await tx.trainer.findUnique({ where: { id: d.id }, select: SELECTION });
    if (!t) return LIEN_PERIME;
    const v = vue(t, "modifiable");
    const manques = manquesDuDossier(etatDuDossier(v, entreprise.bloquante));
    if (manques.length > 0) {
      return { ok: false, message: `Pour envoyer, il manque : ${manques.join(" · ")}.` } as const;
    }
    const e = await tx.trainer.updateMany({
      where: gardeEcriture(d),
      data: {
        declarations,
        declarationsVersion: DECLARATIONS_VERSION,
        declarationsAt: maintenant,
        dossierStatut: "a_verifier",
        dossierEnvoyeAt: maintenant,
        accesVersion: { increment: 1 },
      },
    });
    if (e.count !== 1) return LIEN_PERIME;
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.dossier_envoye",
        targetType: "Trainer",
        targetId: d.id,
        changes: { declarationsVersion: DECLARATIONS_VERSION },
        session: null,
      },
      { exiger: true },
    );
    return { ok: true } as const;
  });
  return r;
}

/** L'état utile aux règles (manques, étape) depuis la vue du dossier. */
export function etatDuDossier(v: DossierVue, entrepriseBloquante: boolean): EtatDossier {
  return {
    codePostalPro: v.codePostalPro,
    siret: v.siret,
    nda: v.nda,
    regimeTva: v.regimeTva,
    ibanSaisi: v.ibanSaisi,
    piecesDeposees: v.pieces.filter((p) => p.statut !== "a_retransmettre").map((p) => p.type),
    codeUrssafSaisi: v.codeUrssafSaisi,
    entrepriseBloquante,
  };
}

/**
 * La personne dit qu'elle n'a pas de SIRET à son nom (portage, coopérative, hors de France,
 * pas encore d'entreprise) : une trace au journal pour la console, sans rien d'autre.
 */
export async function signalerSituation(
  d: DossierVue,
  situation: "portage_ou_cooperative" | "hors_france" | "sans_entreprise",
): Promise<void> {
  await journaliser(prisma, {
    action: "qualiopi.formateur.dossier_situation",
    targetType: "Trainer",
    targetId: d.id,
    changes: { situation },
    session: null,
  });
}
