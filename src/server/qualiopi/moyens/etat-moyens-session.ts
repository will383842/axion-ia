/**
 * 🔴 CHANTIER QNC, LOT L07 — LECTURE DE L'ÉTAT « MOYENS » D'UNE SESSION.
 *
 * Alimente le bloc de la fiche session : moyens filtrés selon la modalité,
 * vérifications datées, journal des changements de modalité et de lieu, pièces
 * à réémettre, dernier test du lien. Lecture seule ; tout est daté par le serveur.
 */

import { prisma } from "@/lib/prisma";
import {
  alertesPiecesSession,
  categoriesPourModalite,
  type AlertePiece,
  type Modalite,
} from "@/server/qualiopi/moyens/moyens-regles";
import { controlerLienDistanciel } from "@/server/qualiopi/moyens/changement-session";
import {
  ACTION_TEST_LIEN,
  ACTION_VERIFICATION,
} from "@/server/qualiopi/moyens/verification-moyens";

export interface EtatMoyensSession {
  readonly modalite: Modalite;
  readonly chezEntreprise: boolean;
  readonly lien: "ok" | "manquant" | "pas_zoom";
  readonly moyens: ReadonlyArray<{
    id: string;
    categorie: string;
    libelle: string;
    dateVerification: Date | null;
  }>;
  readonly verifications: ReadonlyArray<{ creeLe: Date; bloc: unknown }>;
  readonly changements: ReadonlyArray<{
    nature: string;
    motif: string;
    creeLe: Date;
    auteurNom: string;
  }>;
  readonly piecesARemettre: ReadonlyArray<AlertePiece>;
  readonly dernierTestLien: { creeLe: Date; ok: boolean } | null;
}

export async function lireEtatMoyensSession(sessionId: string): Promise<EtatMoyensSession | null> {
  const s = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    select: { modalite: true, lieuType: true, lieuVisioUrl: true },
  });
  if (s === null) return null;
  const modalite = s.modalite as Modalite;

  const [moyens, journal, changements, pieces, test] = await Promise.all([
    prisma.moyenPedagogique.findMany({
      where: { actif: true, categorie: { in: [...categoriesPourModalite(modalite)] } },
      orderBy: [{ categorie: "asc" }, { libelle: "asc" }],
      select: { id: true, categorie: true, libelle: true, dateVerification: true },
    }),
    prisma.activityLog.findMany({
      where: { action: ACTION_VERIFICATION, targetId: sessionId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, changes: true },
    }),
    prisma.sessionChangementModaliteLieu.findMany({
      where: { sessionId },
      orderBy: { creeLe: "asc" },
      select: { nature: true, motif: true, creeLe: true, auteurNom: true },
    }),
    prisma.documentGenere.findMany({
      where: { sessionId },
      select: { id: true, type: true, createdAt: true },
    }),
    prisma.activityLog.findFirst({
      where: { action: ACTION_TEST_LIEN, targetId: sessionId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, changes: true },
    }),
  ]);

  return {
    modalite,
    chezEntreprise: s.lieuType === "sur_site",
    lien: controlerLienDistanciel(modalite, s.lieuVisioUrl),
    moyens,
    verifications: journal.map((j) => ({
      creeLe: j.createdAt,
      bloc: (j.changes as { bloc?: unknown } | null)?.bloc ?? null,
    })),
    changements,
    piecesARemettre: alertesPiecesSession(
      pieces.map((p) => ({ id: p.id, type: String(p.type), creeLe: p.createdAt })),
      changements.map((c) => ({ nature: c.nature as "modalite" | "lieu", creeLe: c.creeLe })),
    ),
    dernierTestLien: test
      ? { creeLe: test.createdAt, ok: (test.changes as { ok?: unknown } | null)?.ok === true }
      : null,
  };
}
