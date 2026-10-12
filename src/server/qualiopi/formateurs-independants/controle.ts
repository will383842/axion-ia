/**
 * Formateurs indépendants — CONTRÔLE REGISTRE et sa PREUVE (lot L4, ADR 0066
 * étape 6 et (i)).
 *
 * Trois écrivains, tous en AJOUT SEUL dans `verifications_registre_sous_traitance`
 * (triggers `…_ajout_seul` / `…_pas_de_truncate`, `socle-objets-sql.ts`) :
 * - `controlerRegistreFormateur` : interroge, juge (`controle-regles.ts`),
 *   inscrit une ligne À CHAQUE contrôle — vert, orange ou rouge ;
 * - `validerControleOrange` : un administrateur valide un orange par une
 *   NOUVELLE ligne, aux dates du contrôle validé (K-2) ;
 * - `passerControleRegistrePeriodique` : recontrôle les actifs de plus de
 *   25 jours (K-4), ÉTEINT tant que `controle_registre_periodique` n'est pas
 *   allumé.
 *
 * 🔑 Le registre est un PORT (`SourceRegistre`) : ce module ne recrée aucun
 * client HTTP. Le branchement sur le registre des entreprises commun (lot
 * FAC-5) se fait chez l'appelant. Une source qui lève vaut « muette ».
 *
 * Module neutre (ni `server-only`, ni Next) : le worker peut l'importer.
 * Aucune variable d'environnement lue au chargement.
 */

import { createHash } from "node:crypto";

import type { PrismaClient, VerdictRegistre } from "../../../../prisma/generated/client";

import { journaliser } from "@/server/journal/journaliser";

import {
  SOURCE_VALIDATION_ORANGE,
  aRecontroler,
  dansLaPlageDuPassage,
  jugerControleRegistre,
  normaliserNda,
  type FaitsEntreprise,
  type FaitsListeOF,
  type MotifControle,
} from "./controle-regles";
import { cleSetting, lireValeur } from "./interrupteurs";

/** Port vers le registre des entreprises et la liste publique des OF. */
export interface SourceRegistre {
  /** `null` = muet. Peut lever : traité comme muet. */
  lireEntreprise(siret: string): Promise<FaitsEntreprise | null>;
  /** `null` = muet. Peut lever : traité comme muet. */
  lireListeOF(siren: string, nda: string): Promise<FaitsListeOF | null>;
}

type Db = Pick<
  PrismaClient,
  | "trainer"
  | "verificationRegistreSousTraitance"
  | "activityLog"
  | "setting"
  | "$transaction"
  | "$executeRaw"
>;

/** Source inscrite sur une ligne de contrôle par interrogation. */
export const SOURCE_REGISTRE = "registre_entreprises+liste_of";

async function silencieux<T>(appel: () => Promise<T | null>): Promise<T | null> {
  try {
    return await appel();
  } catch {
    return null;
  }
}

/**
 * Sérialisation CANONIQUE (clés triées à toute profondeur, `undefined` retirés) :
 * `jsonb` réordonne les clés, donc l'empreinte se recalcule sur ce qui est en
 * base en re-sérialisant de la même façon.
 */
export function jsonCanonique(valeur: unknown): string {
  return JSON.stringify(valeur, (_cle, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>)
            .filter(([, x]) => x !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : v,
  );
}

function empreinte(canonique: string): string {
  return createHash("sha256").update(canonique).digest("hex");
}

/**
 * Ne garde que les champs du contrat `FaitsEntreprise` : un adaptateur bavard
 * (dirigeants, adresse) ne fait jamais entrer de donnée personnelle dans la preuve.
 */
function faitsRetenus(e: FaitsEntreprise | null): FaitsEntreprise | null {
  if (e === null) return null;
  return {
    siren: e.siren,
    etatAdministratif: e.etatAdministratif,
    naf: e.naf,
    etablissement:
      e.etablissement === null
        ? null
        : { siret: e.etablissement.siret, ouvert: e.etablissement.ouvert },
  };
}

function listeRetenue(l: FaitsListeOF | null): FaitsListeOF | null {
  return l === null ? null : { ndaDuSiren: [...l.ndaDuSiren], sirenDuNda: l.sirenDuNda };
}

type ClientVerrou = { $executeRaw: Db["$executeRaw"] };

/**
 * Verrou consultatif par formateur, pris en tête de chaque transaction qui
 * inscrit une ligne : « vérifier le dernier contrôle puis écrire » reste atomique.
 */
async function verrouFormateur(tx: ClientVerrou, trainerId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`controle_registre:${trainerId}`}))`;
}

export type ResultatControle =
  | {
      readonly ok: true;
      readonly verdict: VerdictRegistre;
      readonly motifs: ReadonlyArray<MotifControle>;
      /** Le SIRET effectivement interrogé et inscrit dans la preuve (`null` : absent ou invalide). */
      readonly siret: string | null;
    }
  | { readonly ok: false; readonly raison: "introuvable" | "hors_perimetre" };

/**
 * Contrôle un formateur indépendant et inscrit la preuve.
 *
 * `verifieParId` = l'administrateur qui relance le contrôle ; `null` pour le
 * passage périodique. Salariés et dirigeants : hors périmètre, rien n'est écrit.
 */
export async function controlerRegistreFormateur(
  db: Db,
  source: SourceRegistre,
  p: { trainerId: string; verifieParId: string | null; maintenant: Date },
): Promise<ResultatControle> {
  const t = await db.trainer.findUnique({
    where: { id: p.trainerId },
    select: { id: true, statut: true, siret: true, sousTraitantNda: true },
  });
  if (t === null) return { ok: false, raison: "introuvable" };
  if (t.statut !== "sous_traitant") return { ok: false, raison: "hors_perimetre" };

  const siret = (t.siret ?? "").replace(/\s+/g, "");
  const siretValide = /^\d{14}$/.test(siret);
  const entreprise = siretValide ? await silencieux(() => source.lireEntreprise(siret)) : null;
  const nda = normaliserNda(t.sousTraitantNda);
  const siren = entreprise?.siren ?? (siretValide ? siret.slice(0, 9) : null);
  const listeOF =
    nda !== null && siren !== null ? await silencieux(() => source.lireListeOF(siren, nda)) : null;

  const v = jugerControleRegistre({
    siret: siretValide ? siret : null,
    nda: t.sousTraitantNda,
    entreprise,
    listeOF,
  });
  const canonique = jsonCanonique({
    entreprise: faitsRetenus(entreprise),
    listeOF: listeRetenue(listeOF),
    motifs: v.motifs,
  });

  await db.$transaction(async (tx) => {
    await verrouFormateur(tx, t.id);
    await tx.verificationRegistreSousTraitance.create({
      data: {
        trainerId: t.id,
        verifieAt: p.maintenant,
        verdict: v.verdict,
        source: SOURCE_REGISTRE,
        siren: siren !== null && /^\d{9}$/.test(siren) ? siren : null,
        siret: siretValide ? siret : null,
        numeroDeclarationActivite: nda,
        reponseSource: JSON.parse(canonique) as never,
        reponseSha256: empreinte(canonique),
        motif: v.motifs.length > 0 ? v.motifs.join(",") : null,
        verifieParId: p.verifieParId,
      },
    });
    // Seule la LECTURE de la liste publique vaut « numéro vérifié » (09-SÉCURITÉ a).
    if (v.ndaSurLaListe && v.verdict !== "rouge") {
      await tx.trainer.update({ where: { id: t.id }, data: { ndaVerifieListeAt: p.maintenant } });
    }
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.controle_registre",
        targetType: "Trainer",
        targetId: t.id,
        changes: { verdict: v.verdict, motifs: v.motifs },
        session: p.verifieParId ? { userId: p.verifieParId } : null,
      },
      { exiger: true },
    );
  });

  return { ok: true, verdict: v.verdict, motifs: v.motifs, siret: siretValide ? siret : null };
}

export type ResultatValidation =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly raison: "motif" | "introuvable" | "pas_orange" | "pas_le_dernier";
    };

/** Motif d'au moins 10 caractères : « ok » ne documente rien. */
const MOTIF_MIN = 10;

/**
 * Valide un contrôle ORANGE (K-2) : nouvelle ligne `orange`, source
 * {@link SOURCE_VALIDATION_ORANGE}, à la DATE du contrôle validé et signée de
 * son auteur. Un rouge ne se valide jamais ; seul le DERNIER contrôle du
 * formateur se valide.
 *
 * Réservé à l'appelant habilité (`habiliter_formateur`) : ce module ne lit pas
 * la session.
 */
export async function validerControleOrange(
  db: Db,
  p: {
    trainerId: string;
    controleId: string;
    motif: string;
    valideParId: string;
    maintenant: Date;
  },
): Promise<ResultatValidation> {
  const motif = p.motif.trim();
  if (motif.length < MOTIF_MIN) return { ok: false, raison: "motif" };

  const c = await db.verificationRegistreSousTraitance.findUnique({ where: { id: p.controleId } });
  if (c === null || c.trainerId !== p.trainerId) return { ok: false, raison: "introuvable" };
  if (c.verdict !== "orange" || c.source === SOURCE_VALIDATION_ORANGE) {
    return { ok: false, raison: "pas_orange" };
  }
  const fait = await db.$transaction(async (tx) => {
    // Sous verrou : aucun contrôle ne s'inscrit entre la vérification et l'écriture.
    await verrouFormateur(tx, p.trainerId);
    const plusRecent = await tx.verificationRegistreSousTraitance.findFirst({
      where: { trainerId: p.trainerId, createdAt: { gt: c.createdAt } },
      select: { id: true },
    });
    if (plusRecent !== null) return false;
    await tx.verificationRegistreSousTraitance.create({
      data: {
        trainerId: p.trainerId,
        verifieAt: c.verifieAt,
        verdict: "orange",
        source: SOURCE_VALIDATION_ORANGE,
        siren: c.siren,
        siret: c.siret,
        numeroDeclarationActivite: c.numeroDeclarationActivite,
        motif: `Contrôle ${c.id} validé : ${motif}`.slice(0, 2000),
        verifieParId: p.valideParId,
      },
    });
    await journaliser(
      tx,
      {
        action: "qualiopi.formateur.controle_registre.orange_valide",
        targetType: "Trainer",
        targetId: p.trainerId,
        changes: { controleId: c.id },
        session: { userId: p.valideParId },
      },
      { exiger: true },
    );
    return true;
  });
  return fait ? { ok: true } : { ok: false, raison: "pas_le_dernier" };
}

export type ResultatPassage =
  | { readonly passe: false; readonly raison: "interrupteur" | "hors_plage" }
  | { readonly passe: true; readonly controles: number; readonly echecs: number };

/** Débit plafonné : le registre public limite les appels. */
export const PLAFOND_CONTROLES_PAR_PASSAGE = 20;

/**
 * Passage périodique (K-4) : recontrôle les formateurs indépendants ACTIFS
 * dont le dernier contrôle a plus de 25 jours, du plus ancien au plus récent.
 *
 * 🔴 ÉTEINT par défaut : interrupteur absent ou illisible = aucun appel.
 * `maintenant` est reçu en paramètre (aucune horloge truquée).
 */
export async function passerControleRegistrePeriodique(
  db: Db,
  source: SourceRegistre,
  p: { maintenant: Date; plafond?: number },
): Promise<ResultatPassage> {
  const ligne = await db.setting.findUnique({
    where: { key: cleSetting("controle_registre_periodique") },
    select: { value: true },
  });
  if (!lireValeur("controle_registre_periodique", ligne?.value).valeur) {
    return { passe: false, raison: "interrupteur" };
  }
  if (!dansLaPlageDuPassage(p.maintenant)) return { passe: false, raison: "hors_plage" };

  const actifs = await db.trainer.findMany({
    where: { statut: "sous_traitant", actif: true, finCollaborationAt: null },
    select: {
      id: true,
      verificationsRegistre: {
        orderBy: { verifieAt: "desc" },
        take: 1,
        select: { verifieAt: true },
      },
    },
  });
  const plafond = Math.max(0, Math.min(p.plafond ?? PLAFOND_CONTROLES_PAR_PASSAGE, 200));
  const aFaire = actifs
    .map((a) => ({ id: a.id, dernier: a.verificationsRegistre[0]?.verifieAt ?? null }))
    .filter((a) => aRecontroler(a.dernier, p.maintenant))
    .sort((a, b) => (a.dernier?.getTime() ?? 0) - (b.dernier?.getTime() ?? 0))
    .slice(0, plafond);

  let controles = 0;
  let echecs = 0;
  for (const f of aFaire) {
    try {
      const r = await controlerRegistreFormateur(db, source, {
        trainerId: f.id,
        verifieParId: null,
        maintenant: p.maintenant,
      });
      if (r.ok) controles += 1;
    } catch {
      // Une fiche en échec n'arrête pas le passage ; elle repassera au suivant.
      echecs += 1;
    }
  }
  return { passe: true, controles, echecs };
}
