// Retirer un apporteur du réseau, l'y remettre, ou supprimer DÉFINITIVEMENT un dossier
// jamais engagé (décision de Will, 2026-10-07).
//
// ── Retirer / Remettre (tout apporteur) ───────────────────────────────────
// Retirer : la fiche sort des listes par défaut (onglet « Retirés » pour la revoir) et le
// lien personnel du dossier cesse de fonctionner (`versionLien` + 1). RIEN n'est effacé :
// contrat, pièces, commissions, autofactures, journal. Retirer un apporteur SIGNÉ ne
// résilie pas son contrat (préavis de 30 jours, art. 11.1) : la console le dit et renvoie
// à « Résilier le contrat ». Les commissions dues restent dues.
// Remettre : la fiche revient dans les listes avec un NOUVEAU lien (`versionLien` + 1),
// qui n'est pas envoyé.
//
// ── Supprimer définitivement (dossier jamais engagé) ──────────────────────
// Seulement si le dossier n'a JAMAIS été signé et n'a ni commission (donc ni autofacture),
// ni présentation d'entreprise, ni filleul. Les contrôles sont refaits DANS la transaction
// qui supprime : un dossier signé entre l'affichage et le clic n'est pas supprimé. Le
// dossier et ses pièces partent (le contenu des pièces suit en cascade) ; la fiche
// CANDIDAT reste (règle de Will : ne jamais perdre un contact, sauf un doublon). Une ligne
// de journal est conservée.
//
// ── La table `apporteur_reseau_retrait` ───────────────────────────────────
// Séparée, à dessein (voir le schéma). Avant que la migration soit jouée — le worker et
// l'app tournent le nouveau code jusqu'à ~50 min avant elle —, la LECTURE rend « personne
// n'est retiré » au lieu de lever : une liste ne doit pas tomber pour un état accessoire.

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";

/** Statuts d'un dossier ENGAGÉ : signé par l'apporteur, ou au-delà. */
const STATUTS_ENGAGES = new Set(["a_verifier", "signe", "resilie"]);

/** La table n'existe pas encore (migration pas jouée) : Prisma P2021. */
function tableAbsente(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: unknown }).code === "P2021";
}

/** Les identifiants des apporteurs retirés. Vide si la table n'existe pas encore. */
export async function idsRetires(): Promise<Set<string>> {
  try {
    const lignes = await prisma.apporteurReseauRetrait.findMany({ select: { apporteurId: true } });
    return new Set(lignes.map((l) => l.apporteurId));
  } catch (err) {
    if (tableAbsente(err)) return new Set();
    throw err;
  }
}

/** La date de retrait d'un apporteur, ou `null`. `null` aussi si la table n'existe pas encore. */
export async function retraitDe(apporteurId: string): Promise<Date | null> {
  try {
    const l = await prisma.apporteurReseauRetrait.findUnique({
      where: { apporteurId },
      select: { retireAt: true },
    });
    return l?.retireAt ?? null;
  } catch (err) {
    if (tableAbsente(err)) return null;
    throw err;
  }
}

export type Issue = { ok: true; message: string } | { ok: false; message: string };

export async function retirerDuReseau(apporteurId: string, adminId: string): Promise<Issue> {
  return prisma.$transaction(async (tx) => {
    const a = await tx.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { id: true, statut: true },
    });
    if (!a) return { ok: false, message: "Dossier introuvable." };
    const deja = await tx.apporteurReseauRetrait.findUnique({ where: { apporteurId } });
    if (deja) return { ok: false, message: "Cette fiche est déjà retirée du réseau." };
    await tx.apporteurReseauRetrait.create({ data: { apporteurId, retirePar: adminId } });
    await tx.apporteurReseau.update({
      where: { id: apporteurId },
      data: { versionLien: { increment: 1 } },
      select: { id: true },
    });
    await tx.activityLog.create({
      data: {
        adminUserId: adminId,
        action: "apporteur.retire_du_reseau",
        targetType: "apporteur_reseau",
        targetId: apporteurId,
        changes: { statut: a.statut, lienDesactive: true },
      },
    });
    return {
      ok: true,
      message:
        a.statut === "signe"
          ? "Fiche retirée du réseau et lien du dossier désactivé. Le contrat N'EST PAS résilié : pour y mettre fin, utilisez « Résilier le contrat » (préavis de 30 jours, art. 11.1). Les commissions dues restent dues."
          : "Fiche retirée du réseau et lien du dossier désactivé. Rien n'a été effacé.",
    };
  });
}

export async function remettreDansLeReseau(apporteurId: string, adminId: string): Promise<Issue> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.apporteurReseauRetrait.deleteMany({ where: { apporteurId } });
    if (count === 0) return { ok: false, message: "Cette fiche n'est pas retirée du réseau." };
    await tx.apporteurReseau.update({
      where: { id: apporteurId },
      data: { versionLien: { increment: 1 } },
      select: { id: true },
    });
    await tx.activityLog.create({
      data: {
        adminUserId: adminId,
        action: "apporteur.remis_dans_le_reseau",
        targetType: "apporteur_reseau",
        targetId: apporteurId,
        changes: { nouveauLien: true, lienEnvoye: false },
      },
    });
    return {
      ok: true,
      message:
        "Fiche remise dans le réseau. Un nouveau lien de dossier a été créé ; il n'a pas été envoyé.",
    };
  });
}

/** Ce qui décide si un dossier peut être supprimé définitivement. Pure. */
export interface EtatSuppression {
  readonly statut: string;
  readonly signeParApporteurAt: Date | null;
  readonly signeParSocieteAt: Date | null;
  readonly commissions: number;
  readonly presentations: number;
  readonly filleuls: number;
}

/** `null` si la suppression est permise ; sinon la phrase qui dit pourquoi elle ne l'est pas. */
export function refusSuppression(e: EtatSuppression): string | null {
  if (e.signeParApporteurAt || e.signeParSocieteAt || STATUTS_ENGAGES.has(e.statut)) {
    return "Contrat signé : conservation légale. Utilisez « Retirer du réseau ».";
  }
  if (e.commissions > 0) {
    return "Commissions enregistrées : conservation légale. Utilisez « Retirer du réseau ».";
  }
  if (e.presentations > 0) {
    return "Entreprises présentées : conservation de l'historique. Utilisez « Retirer du réseau ».";
  }
  if (e.filleuls > 0) {
    return "Cet apporteur est le parrain d'autres apporteurs. Utilisez « Retirer du réseau ».";
  }
  return null;
}

/** « Jean Dupont » → « jean dupont », sans accents : ce que l'on demande de retaper. */
export function nomAConfirmer(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export async function etatSuppression(apporteurId: string): Promise<EtatSuppression | null> {
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: {
      statut: true,
      signeParApporteurAt: true,
      signeParSocieteAt: true,
      _count: { select: { commissions: true, presentations: true, filleuls: true } },
    },
  });
  if (!a) return null;
  return {
    statut: a.statut,
    signeParApporteurAt: a.signeParApporteurAt,
    signeParSocieteAt: a.signeParSocieteAt,
    commissions: a._count.commissions,
    presentations: a._count.presentations,
    filleuls: a._count.filleuls,
  };
}

export async function supprimerDefinitivement(
  apporteurId: string,
  adminId: string,
  nomTape: string,
): Promise<Issue> {
  return prisma.$transaction(async (tx) => {
    const a = await tx.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: {
        id: true,
        statut: true,
        prenom: true,
        nom: true,
        emailHash: true,
        submissionId: true,
        signeParApporteurAt: true,
        signeParSocieteAt: true,
        _count: {
          select: { commissions: true, presentations: true, filleuls: true, pieces: true },
        },
      },
    });
    if (!a) return { ok: false, message: "Dossier introuvable." };
    const refus = refusSuppression({
      statut: a.statut,
      signeParApporteurAt: a.signeParApporteurAt,
      signeParSocieteAt: a.signeParSocieteAt,
      commissions: a._count.commissions,
      presentations: a._count.presentations,
      filleuls: a._count.filleuls,
    });
    if (refus) return { ok: false, message: refus };
    const attendu = nomAConfirmer(`${decryptPii(a.prenom) ?? ""} ${decryptPii(a.nom) ?? ""}`);
    if (!attendu || nomAConfirmer(nomTape) !== attendu) {
      return { ok: false, message: "Le nom tapé ne correspond pas : rien n'a été supprimé." };
    }
    // Le contenu des pièces suit en cascade ; la fiche candidat (`submissionId`) reste.
    await tx.pieceApporteur.deleteMany({ where: { apporteurId } });
    await tx.apporteurReseauRetrait.deleteMany({ where: { apporteurId } });
    await tx.apporteurReseau.delete({ where: { id: apporteurId }, select: { id: true } });
    await tx.activityLog.create({
      data: {
        adminUserId: adminId,
        action: "apporteur.dossier_supprime_definitivement",
        targetType: "apporteur_reseau",
        targetId: apporteurId,
        // Aucune donnée personnelle en clair : l'empreinte et le lien vers la fiche candidat.
        changes: {
          statut: a.statut,
          emailHash: a.emailHash,
          submissionId: a.submissionId,
          piecesSupprimees: a._count.pieces,
        },
      },
    });
    return {
      ok: true,
      message:
        "Dossier d'apporteur et pièces supprimés définitivement. La fiche candidat est conservée.",
    };
  });
}
