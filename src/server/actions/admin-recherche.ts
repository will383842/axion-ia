/**
 * Recherche globale de données — Server Action de la palette ⌘K admin.
 *
 * `rechercheGlobaleAction(q, adminPrefix)` interroge en parallèle les 8 modèles
 * métier « chauds » (clients, sessions, factures, devis, stagiaires,
 * formations, contrats coaching, missions d'audit) et retourne des groupes de
 * résultats prêts à rendre dans la palette (label FR + items { titre, sous,
 * href }).
 *
 * Hrefs — routes de fiche VÉRIFIÉES dans src/app (2026-08-02) :
 *  - Client            → `/qualiopi/clients/[id]` (fiche 360°, livrée par le
 *    chantier client-360 mergé avant celui-ci ; l'édition
 *    est donc la fiche de fait).
 *  - TrainingSession   → `/qualiopi/sessions/[id]` (page.tsx présent).
 *  - FactureFormation  → `/qualiopi/facturation/[id]` (page.tsx présent).
 *  - Devis             → `/qualiopi/devis/[id]` (page.tsx présent).
 *  - Trainee           → `/qualiopi/stagiaires/[id]` (page.tsx présent).
 *  - Formation         → `/qualiopi/formations/[id]` (page.tsx présent).
 *  - CoachingContract  → REPLI `/coaching/seances` : aucune fiche contrat
 *    n'existe (seule `coaching/seances/[id]` existe, et c'est une SÉANCE, pas
 *    un contrat) et la liste des séances n'interprète AUCUN searchParam — un
 *    `?contrat=` serait inerte et trompeur, on pointe la liste nue.
 *  - AuditMission      → `/qualiopi/audits/[id]` (page.tsx présent).
 *
 * Garde : rôle admin | super_admin exactement (`requireAdminPublish` — malgré
 * son nom, c'est LE guard existant qui vérifie précisément ces deux rôles).
 * Stub-safe : build GH Actions (`DATABASE_URL` → stub.invalid, ADR 0026) →
 * data vide sans toucher Prisma. Fail-soft : tout throw → `{ error }`.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminPublish } from "@/server/actions/qualiopi/_guards";

export interface ResultatRecherche {
  readonly id: string;
  readonly titre: string;
  readonly sous: string;
  readonly href: string;
}

export interface GroupeResultats {
  /** Clé stable du type (mappée à une icône côté palette). */
  readonly type: string;
  /** Libellé FR du groupe. */
  readonly label: string;
  readonly items: ReadonlyArray<ResultatRecherche>;
}

type ActionResult = { data: GroupeResultats[] } | { error: string };

const rechercheSchema = z.object({
  q: z.string().trim().min(2).max(80),
  adminPrefix: z.string().trim().min(1).max(80),
});

const TAKE = 5;
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });

/** ` · `-join en ignorant les segments vides/null. */
function sous(...parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" · ");
}

export async function rechercheGlobaleAction(
  q: string,
  adminPrefix: string,
): Promise<ActionResult> {
  try {
    // Contrat build ADR 0026 : environnement stub GH Actions → data vide AVANT
    // même le guard (pas de session au build, et rien à divulguer : vide).
    if (process.env.DATABASE_URL?.includes("stub.invalid")) {
      return { data: [] };
    }

    await requireAdminPublish();

    const parsed = rechercheSchema.safeParse({ q, adminPrefix });
    if (!parsed.success) {
      return { error: "Recherche invalide (2 à 80 caractères)." };
    }
    const terme = parsed.data.q;
    const base = `/fr/${parsed.data.adminPrefix}`;

    const contains = { contains: terme, mode: "insensitive" as const };
    const numeroPrefix = { startsWith: terme.toUpperCase() };
    const estNumerique = /^\d+$/.test(terme);

    const [clients, sessions, factures, devis, stagiaires, formations, coachings, audits] =
      await Promise.all([
        prisma.client.findMany({
          where: {
            OR: [
              { raisonSociale: contains },
              { numero: numeroPrefix },
              { contactNom: contains },
              ...(estNumerique ? [{ siret: { startsWith: terme } }] : []),
            ],
          },
          select: { id: true, numero: true, raisonSociale: true, contactNom: true },
          take: TAKE,
        }),
        prisma.trainingSession.findMany({
          where: { OR: [{ numero: numeroPrefix }, { titreSession: contains }] },
          select: { id: true, numero: true, titreSession: true, dateDebut: true, dateFin: true },
          take: TAKE,
        }),
        prisma.factureFormation.findMany({
          where: { OR: [{ numero: numeroPrefix }, { destinataireNom: contains }] },
          select: { id: true, numero: true, destinataireNom: true, statut: true },
          take: TAKE,
        }),
        prisma.devis.findMany({
          where: { numero: numeroPrefix },
          select: { id: true, numero: true, statut: true },
          take: TAKE,
        }),
        prisma.trainee.findMany({
          where: {
            deletedAt: null,
            OR: [{ nom: contains }, { prenom: contains }, { email: contains }],
          },
          select: { id: true, nom: true, prenom: true, email: true },
          take: TAKE,
        }),
        prisma.formation.findMany({
          where: { OR: [{ numero: numeroPrefix }, { titre: contains }] },
          select: { id: true, numero: true, titre: true },
          take: TAKE,
        }),
        prisma.coachingContract.findMany({
          where: { numero: numeroPrefix },
          select: { id: true, numero: true, interventionSlug: true },
          take: TAKE,
        }),
        prisma.auditMission.findMany({
          where: { OR: [{ numero: numeroPrefix }, { titre: contains }] },
          select: { id: true, numero: true, titre: true },
          take: TAKE,
        }),
      ]);

    const groupes: GroupeResultats[] = [
      {
        type: "clients",
        label: "Clients",
        items: clients.map((c) => ({
          id: c.id,
          titre: c.raisonSociale,
          sous: sous(c.numero, c.contactNom),
          href: `${base}/qualiopi/clients/${c.id}`,
        })),
      },
      {
        type: "sessions",
        label: "Sessions",
        items: sessions.map((s) => ({
          id: s.id,
          titre: s.titreSession,
          sous: sous(s.numero, `${dateFmt.format(s.dateDebut)} → ${dateFmt.format(s.dateFin)}`),
          href: `${base}/qualiopi/sessions/${s.id}`,
        })),
      },
      {
        type: "factures",
        label: "Factures",
        items: factures.map((f) => ({
          id: f.id,
          titre: f.destinataireNom,
          sous: sous(f.numero, f.statut),
          href: `${base}/qualiopi/facturation/${f.id}`,
        })),
      },
      {
        type: "devis",
        label: "Devis",
        items: devis.map((d) => ({
          id: d.id,
          titre: d.numero,
          sous: d.statut,
          href: `${base}/qualiopi/devis/${d.id}`,
        })),
      },
      {
        type: "stagiaires",
        label: "Stagiaires",
        items: stagiaires.map((t) => ({
          id: t.id,
          titre: `${t.prenom} ${t.nom}`,
          sous: t.email,
          href: `${base}/qualiopi/stagiaires/${t.id}`,
        })),
      },
      {
        type: "formations",
        label: "Formations",
        items: formations.map((f) => ({
          id: f.id,
          titre: f.titre,
          sous: f.numero,
          href: `${base}/qualiopi/formations/${f.id}`,
        })),
      },
      {
        type: "coaching",
        label: "Contrats coaching",
        items: coachings.map((c) => ({
          id: c.id,
          titre: c.numero,
          sous: c.interventionSlug,
          // Repli documenté en tête de fichier : pas de fiche contrat.
          href: `${base}/coaching/seances`,
        })),
      },
      {
        type: "audits",
        label: "Missions d'audit",
        items: audits.map((a) => ({
          id: a.id,
          titre: a.titre,
          sous: a.numero,
          href: `${base}/qualiopi/audits/${a.id}`,
        })),
      },
    ];

    return { data: groupes.filter((g) => g.items.length > 0) };
  } catch {
    return { error: "Recherche indisponible." };
  }
}
