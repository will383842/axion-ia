/**
 * Admin — Qualiopi · Wizard « Nouvelle vente » (plan 2026-08-05, phase 0).
 *
 * Parcours guidé : client → formation (telle quelle / adaptée / sur-mesure) →
 * devis puis session → checklist des pièces. Server Component : auth gate
 * admin/super_admin, force-dynamic, noindex. Charge en amont tout ce dont le
 * wizard client a besoin (offres actives, formations publiées, clients légers,
 * brouillons de l'admin, brouillon repris via ?brouillon=<id>) — zéro appel DB
 * côté client.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { VenteWizard } from "@/components/admin/qualiopi/VenteWizard";
import { prisma } from "@/lib/prisma";
import { listOffres } from "@/server/qualiopi/offres/offres";
import { estOffreUnAUn } from "@/server/qualiopi/offres/famille-prestation";
import type { ChecklistVenteInput, VenteFinancement } from "@/server/qualiopi/vente/checklist";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Nouvelle vente | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  /**
   * `brouillon` : reprise d'un brouillon de vente existant.
   * `clientId` : pré-sélection du client (boutons « Nouvelle vente » des
   * fiches CRM) — ignoré si un brouillon est repris (le brouillon prime).
   */
  searchParams: Promise<{ brouillon?: string; clientId?: string }>;
}

export default async function QualiopiVenteNewPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const sp = await searchParams;
  const acces = await gardePage("ecriture", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  // ⚠️ `userId` est CONSOMMÉ plus bas (auteur de la vente) : le retirer avec la
  // garde casserait la page. `gardePage` a déjà refusé l'absence de session.
  const role = acces.role;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/${locale}/${adminPrefix}/login`);

  const [offresWithPrice, formations, clients, mesBrouillons] = await Promise.all([
    listOffres({ actifOnly: true }),
    prisma.formation
      .findMany({
        where: { statut: "actif", statutGeneration: "publie" },
        select: { id: true, numero: true, titre: true, offreSiteId: true, dureeHeures: true },
        orderBy: { titre: "asc" },
      })
      .catch(() => []),
    prisma.client
      .findMany({
        select: { id: true, numero: true, raisonSociale: true },
        orderBy: { raisonSociale: "asc" },
        // Borne : la liste part entière au client (filtrage en mémoire).
        // Largement au-dessus du CRM actuel ; à revoir si import massif.
        take: 500,
      })
      .catch(() => []),
    prisma.venteBrouillon
      .findMany({
        where: { createdByAdminId: userId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          etape: true,
          updatedAt: true,
          client: { select: { raisonSociale: true } },
        },
      })
      .catch(() => []),
  ]);

  // Montant en CENTIMES résolu côté serveur (même motif que /qualiopi/devis/new :
  // importer pricing-resolver côté client tirerait tout pricing.ts dans le bundle).
  // `tarifNonReverifie` : même seuil de 30 jours que l'alerte
  // `offres_site_non_verifiees` — vendre sur un tarif jamais revérifié mérite
  // d'être signalé AU MOMENT du choix, pas seulement sur l'écran d'alertes.
  const now = new Date();
  const seuilVerif = new Date(now.getTime() - 30 * 86_400_000);
  const offres = offresWithPrice.map((o) => ({
    id: o.offre.id,
    tierId: o.offre.tierId,
    code: o.offre.code,
    titreFr: o.offre.titreFr,
    prixLabelFr: o.prixLabelFr,
    prixHtCents: o.prixHtEur === null ? null : Math.round(o.prixHtEur * 100),
    noteDevisFr: o.noteDevisFr,
    tarifNonReverifie:
      o.offre.derniereVerifCoherenceAt === null || o.offre.derniereVerifCoherenceAt < seuilVerif,
    // Une formation collective et un accompagnement individuel ne se vendent
    // pas pareil : le wizard doit bifurquer, pas proposer un sélecteur de
    // formation qui restera vide (cf. `famille-prestation.ts`).
    estUnAUn: estOffreUnAUn(o.offre.formatPedagogique),
  }));

  // ── Pré-sélection client (?clientId=) — boutons « Nouvelle vente » du CRM ──
  const clientInitialId =
    sp.brouillon === undefined && sp.clientId !== undefined
      ? clients.find((c) => c.id === sp.clientId)?.id
      : undefined;

  // ── Reprise d'un brouillon (?brouillon=<id>) — borné au propriétaire ───────
  let brouillon:
    | {
        id: string;
        etape: number;
        payload: Record<string, unknown>;
        clientId: string | null;
        devisId: string | null;
        sessionId: string | null;
      }
    | undefined;
  let devisInitial:
    | {
        id: string;
        numero: string;
        statut: "brouillon" | "envoye" | "accepte" | "refuse" | "expire" | "transforme_convention";
        sentAt: string | null;
        fichierPdfUrl: string | null;
        docusealSubmissionId: string | null;
        montantTotalHtCents: number;
      }
    | undefined;
  let sessionInitiale:
    | {
        id: string;
        numero: string;
        statut: "planifiee" | "en_cours" | "realisee" | "annulee" | "reportee";
      }
    | undefined;
  let checklistInitiale: ChecklistVenteInput | undefined;

  if (sp.brouillon !== undefined) {
    const row = await prisma.venteBrouillon
      .findUnique({
        where: { id: sp.brouillon },
        select: {
          id: true,
          etape: true,
          payload: true,
          clientId: true,
          devisId: true,
          sessionId: true,
          createdByAdminId: true,
        },
      })
      .catch(() => null);

    if (row !== null && row.createdByAdminId === userId) {
      brouillon = {
        id: row.id,
        etape: row.etape,
        payload: (row.payload ?? {}) as Record<string, unknown>,
        clientId: row.clientId,
        devisId: row.devisId,
        sessionId: row.sessionId,
      };

      if (row.devisId !== null) {
        const d = await prisma.devis
          .findUnique({
            where: { id: row.devisId },
            select: {
              id: true,
              numero: true,
              statut: true,
              sentAt: true,
              fichierPdfUrl: true,
              docusealSubmissionId: true,
              montantTotalHtCents: true,
            },
          })
          .catch(() => null);
        if (d !== null) {
          devisInitial = {
            id: d.id,
            numero: d.numero,
            statut: d.statut,
            sentAt: d.sentAt?.toISOString() ?? null,
            fichierPdfUrl: d.fichierPdfUrl,
            docusealSubmissionId: d.docusealSubmissionId,
            montantTotalHtCents: d.montantTotalHtCents,
          };
        }
      }

      if (row.sessionId !== null) {
        const s = await prisma.trainingSession
          .findUnique({
            where: { id: row.sessionId },
            select: {
              id: true,
              numero: true,
              statut: true,
              financementType: true,
              opcoSubrogation: true,
              documents: { select: { type: true } },
              enrollments: {
                where: { statut: { in: ["planifiee", "presente"] } },
                select: { id: true },
              },
            },
          })
          .catch(() => null);
        if (s !== null) {
          sessionInitiale = { id: s.id, numero: s.numero, statut: s.statut };
          // Les alertes par SESSION et par INSCRIPTION : `emargement_manquant`
          // cible Enrollment — la charger seulement par session rendait son
          // relais checklist définitivement muet.
          const enrollmentIds = s.enrollments.map((e) => e.id);
          const alertes = await prisma.alerteSysteme
            .findMany({
              where: {
                resolue: false,
                OR: [
                  { cibleType: "TrainingSession", cibleId: s.id },
                  ...(enrollmentIds.length > 0
                    ? [{ cibleType: "Enrollment", cibleId: { in: enrollmentIds } }]
                    : []),
                ],
              },
              select: { code: true },
            })
            .catch(() => []);
          checklistInitiale = {
            devis: devisInitial
              ? {
                  statut: devisInitial.statut,
                  fichierPdfUrl: devisInitial.fichierPdfUrl,
                  docusealSubmissionId: devisInitial.docusealSubmissionId,
                  sentAt: devisInitial.sentAt,
                }
              : null,
            session: {
              statut: s.statut,
              financementType: (s.financementType ?? null) as VenteFinancement | "mixte" | null,
              opcoSubrogation: s.opcoSubrogation,
            },
            documentsGeneres: s.documents.map((doc) => ({ type: doc.type })),
            enrollmentsActifs: s.enrollments.length,
            alertesOuvertes: alertes,
          };
        }
      }
    }
  }

  // 🔴 Le rappel des ventes en cours était rendu AVANT le wizard, donc AVANT
  // le titre de la page (qui vit dans le wizard) : on atterrissait sur un
  // encart orphelin, le titre en dessous. Il passe désormais en prop et
  // s'affiche SOUS l'en-tête — même information, ordre de lecture rétabli.
  const brouillonsEnCours =
    brouillon === undefined
      ? mesBrouillons.map((b) => ({
          id: b.id,
          etape: b.etape,
          clientRaisonSociale: b.client?.raisonSociale ?? null,
          modifieLe: b.updatedAt.toLocaleDateString("fr-FR"),
        }))
      : [];

  return (
    <VenteWizard
      adminPrefix={adminPrefix}
      role={role}
      clients={clients}
      offres={offres}
      formations={formations}
      brouillonsEnCours={brouillonsEnCours}
      {...(clientInitialId !== undefined ? { clientInitialId } : {})}
      {...(brouillon !== undefined ? { brouillon } : {})}
      {...(devisInitial !== undefined ? { devisInitial } : {})}
      {...(sessionInitiale !== undefined ? { sessionInitiale } : {})}
      {...(checklistInitiale !== undefined ? { checklistInitiale } : {})}
    />
  );
}
