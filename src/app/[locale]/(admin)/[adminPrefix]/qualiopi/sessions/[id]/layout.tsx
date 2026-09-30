/**
 * Admin — Qualiopi · Cadre commun de la fiche session et de ses sous-pages.
 *
 * 🔴 Refonte « session de bout en bout » (lot L2, ADR 0060). Avant ce cadre,
 * chaque sous-page (émargement, évaluations, financement, kit) répétait son
 * propre en-tête et ses propres liens de retour — quatre façons de revenir, et
 * aucune de savoir où en est le dossier. Ce layout porte, UNE fois :
 *
 *  - l'en-tête : numéro, statut, phase, client (vers SA fiche, et non plus vers
 *    la liste des clients), formateur ;
 *  - un fil d'Ariane unique : Sessions › N° ;
 *  - le bandeau d'état du dossier (`BandeauVerrouDossier`), dont le texte est
 *    celui du dossier d'audit, mot pour mot ;
 *  - le `DossierVerrouProvider`, qui dit à chaque composant d'écriture si le
 *    dossier est clos — il remplace alors son formulaire par un résumé en
 *    lecture, ou masque son bouton.
 *
 * L'état vient de `chargerEtatVerrou`, source unique (RM-01) : l'écran ne
 * recalcule aucune règle. Le serveur reste la vraie garde.
 *
 * ⚠️ Budget console : ce layout n'ajoute aucune dépendance cliente — un
 * Provider de contexte et le petit formulaire de réouverture, rien d'autre.
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { MOTIF_REFUS, peutEngager } from "@/server/auth/habilitations";
import { prisma } from "@/lib/prisma";
import {
  chargerEtatVerrou,
  dossierFige,
  phaseDossier,
  type PhaseDossier,
} from "@/server/qualiopi/sessions/verrou-dossier";
import {
  reverrouillerDossierSessionAction,
  rouvrirDossierSessionAction,
} from "@/server/actions/qualiopi/dossier-verrou";
import {
  BandeauVerrouDossier,
  type GesteEncorePossible,
} from "@/features/admin-qualiopi/session-hub/BandeauVerrouDossier";
import { DossierVerrouProvider } from "@/features/admin-qualiopi/session-hub/DossierVerrouProvider";

const STATUT_LABELS: Record<string, string> = {
  planifiee: "Planifiée",
  en_cours: "En cours",
  realisee: "Réalisée",
  annulee: "Annulée",
  reportee: "Reportée",
};

const LIBELLES_PHASE: Record<PhaseDossier, string> = {
  preparer: "Préparer",
  jour_j: "Le jour J",
  apres: "Après",
  cloturee: "Clôturée",
  hors_parcours: "Hors parcours",
};

function pluriel(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

/**
 * Les gestes OUVERTS réellement dus sur un dossier clos — jamais la liste
 * théorique : un encart qui énumère ce qui n'attend rien apprend à ne plus le
 * lire. Lu seulement quand le dossier est clos.
 */
async function gestesEncorePossibles(
  sessionId: string,
  sessionBase: string,
): Promise<GesteEncorePossible[]> {
  const [aSigner, aRemettre, froidEnAttente, factures] = await Promise.all([
    prisma.documentGenere.count({
      where: {
        sessionId,
        annuleeAt: null,
        statutSignature: { in: ["en_attente", "partielle"] },
      },
    }),
    prisma.documentGenere.count({
      where: {
        sessionId,
        annuleeAt: null,
        statutSignature: "signee",
        exemplaireSigneEnvoyeAt: null,
      },
    }),
    prisma.questionnaire.count({
      where: {
        type: "satisfaction_froid",
        reponduAt: null,
        enrollment: { sessionId, statut: { notIn: ["abandon", "exclu"] } },
      },
    }),
    prisma.factureFormation.count({ where: { sessionId } }),
  ]);
  const out: GesteEncorePossible[] = [];
  if (aSigner > 0) {
    out.push({
      libelle: `${pluriel(aSigner, "pièce attend", "pièces attendent")} encore une signature ou un contreseing`,
      href: `${sessionBase}#documents`,
    });
  }
  if (aRemettre > 0) {
    out.push({
      libelle: `${pluriel(aRemettre, "exemplaire signé", "exemplaires signés")} à remettre`,
      href: `${sessionBase}#documents`,
    });
  }
  if (froidEnAttente > 0) {
    out.push({
      libelle: `${pluriel(froidEnAttente, "questionnaire à froid", "questionnaires à froid")} en attente de réponse du stagiaire`,
      href: `${sessionBase}#questionnaires`,
    });
  }
  if (factures === 0) {
    out.push({ libelle: "Aucune facture émise", href: `${sessionBase}/financement` });
  }
  return out;
}

export default async function SessionFicheLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; adminPrefix: string; id: string }>;
}) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const [session, verrou] = await Promise.all([
    prisma.trainingSession.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        titreSession: true,
        statut: true,
        formation: { select: { titre: true } },
        client: { select: { id: true, numero: true, raisonSociale: true } },
        formateurPrincipal: { select: { prenom: true, nom: true } },
      },
    }),
    chargerEtatVerrou(id),
  ]);
  if (session === null || verrou === null) notFound();

  const base = `/${locale}/${adminPrefix}/qualiopi`;
  // Écrit en entier : c'est le retour à la fiche que cherche la garde
  // `toute-sous-page-ramene-a-son-parent` pour les quatre sous-pages.
  const sessionBase = `/${locale}/${adminPrefix}/qualiopi/sessions/${id}`;
  const fige = dossierFige(verrou.etat);
  const phase = phaseDossier(verrou.statut, verrou.etat);
  const encorePossible = fige ? await gestesEncorePossibles(id, sessionBase) : [];

  const libelleCls =
    "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  const valeurCls =
    "text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
  const lienCls = "text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";

  return (
    <AdminPageShell width="wide">
      {/* Fil d'Ariane UNIQUE : les sous-pages n'ont plus le leur. */}
      <nav
        aria-label="Fil d'Ariane"
        className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-xs)]"
      >
        <Link href={`${base}/sessions`} className={lienCls}>
          Sessions
        </Link>
        <span className="mx-[var(--space-admin-2)] text-[color:var(--color-admin-fg-muted)]">
          ›
        </span>
        <Link href={sessionBase} className={lienCls}>
          {session.numero}
        </Link>
      </nav>

      <header className="mb-[var(--space-admin-5)] border-b border-[color:var(--color-admin-border)] pb-[var(--space-admin-4)]">
        <h1 className="text-[length:var(--text-admin-xl)] font-semibold text-[color:var(--color-admin-fg)]">
          {session.titreSession ?? session.formation.titre}
        </h1>
        <dl className="mt-[var(--space-admin-3)] flex flex-wrap gap-x-[var(--space-admin-6)] gap-y-[var(--space-admin-2)]">
          <div>
            <dt className={libelleCls}>N°</dt>
            <dd className={valeurCls}>{session.numero}</dd>
          </div>
          <div>
            <dt className={libelleCls}>Statut</dt>
            <dd className={valeurCls}>{STATUT_LABELS[session.statut] ?? session.statut}</dd>
          </div>
          <div>
            <dt className={libelleCls}>Phase</dt>
            <dd className={valeurCls} data-phase={phase}>
              {LIBELLES_PHASE[phase]}
            </dd>
          </div>
          {session.client !== null && (
            <div>
              <dt className={libelleCls}>Client</dt>
              <dd className={valeurCls}>
                <Link href={`${base}/clients/${session.client.id}`} className={lienCls}>
                  {session.client.raisonSociale}
                </Link>{" "}
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  ({session.client.numero})
                </span>
              </dd>
            </div>
          )}
          <div>
            <dt className={libelleCls}>Formateur</dt>
            <dd className={valeurCls}>
              {session.formateurPrincipal !== null
                ? `${session.formateurPrincipal.prenom} ${session.formateurPrincipal.nom}`
                : "Non assigné"}
            </dd>
          </div>
        </dl>
      </header>

      <BandeauVerrouDossier
        sessionId={id}
        etat={verrou.etat}
        peutRouvrir={peutEngager(acces.role, "rouvrir_dossier")}
        motifSansHabilitation={MOTIF_REFUS.rouvrir_dossier}
        encorePossible={encorePossible}
        rouvrirAction={rouvrirDossierSessionAction}
        reverrouillerAction={reverrouillerDossierSessionAction}
      />

      <DossierVerrouProvider fige={fige} etat={verrou.etat.etat}>
        {children}
      </DossierVerrouProvider>
    </AdminPageShell>
  );
}
