/**
 * Admin — Qualiopi · 🔴 À traiter (refonte console phase 1, 2026-08-01).
 *
 * LA porte d'entrée de la console. Verdict de Will sur l'ancienne organisation :
 * « on ne sait pas où regarder, on ne sait pas par quoi commencer ». Cette page
 * répond à la seule question du matin : « qu'est-ce que je dois faire ? »
 *
 * Quatre blocs, dans l'ordre d'urgence :
 *   ✍️  Signatures — pièces à contresigner (quelqu'un a signé, il manque une
 *       partie) et signatures client qui n'ont pas commencé.
 *   ✉️  E-mails — la corbeille de validation F60.
 *   🚨  Alertes & relances — les alertes actives de l'évaluateur quotidien
 *       (OPCO sans réponse, impayés, devis dormants, vigilance URSSAF, NDA…).
 *
 * 🔴 Zéro logique propre : les chiffres viennent de `compterQualiopiNav()`
 * (le MÊME module que les pastilles de la sidebar) et les listes des services
 * existants. Cette page AGRÈGE, elle ne recalcule rien — un chiffre calculé
 * deux fois dirait un jour deux choses différentes.
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { compterQualiopiNav } from "@/server/admin/qualiopi-nav-counts";
import { listAlertes } from "@/server/qualiopi/alertes/alertes-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — À traiter | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

/** Libellé humain d'un type de pièce signable (sous-ensemble courant). */
const TYPE_LABELS: Record<string, string> = {
  convention: "Convention",
  convention_tripartite: "Convention tripartite",
  contrat: "Contrat de formation",
  devis: "Devis",
  lettre_mission: "Lettre de mission",
  contrat_sous_traitance: "Contrat de sous-traitance",
  releve_connexion: "Relevé de connexion",
  protocole_afest: "Protocole AFEST",
};

/**
 * Pièces dont une signature attend. Stub-safe → [].
 *
 * `partielle` d'abord (quelqu'un a DÉJÀ signé — souvent le client : c'est le
 * contreseing de l'organisme qui bloque la pièce, donc TOI), puis `en_attente`
 * (le lien est émis, personne n'a signé — c'est le client qu'on relance).
 */
async function lireSignaturesEnAttente() {
  try {
    return await prisma.documentGenere.findMany({
      where: { statutSignature: { in: ["partielle", "en_attente"] } },
      orderBy: [{ statutSignature: "desc" }, { updatedAt: "asc" }],
      take: 30,
      select: {
        id: true,
        type: true,
        numero: true,
        statutSignature: true,
        updatedAt: true,
        sessionId: true,
        trainerId: true,
        session: { select: { titreSession: true, numero: true } },
      },
    });
  } catch {
    return [];
  }
}

export default async function ATraiterPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const session = await auth();
  const role = session?.user?.role;
  // Même garde que le reste de la console Qualiopi (alertes, sessions).
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const base = `/${locale}/${adminPrefix}`;

  const [compteurs, signatures, alertes] = await Promise.all([
    compterQualiopiNav(),
    lireSignaturesEnAttente(),
    listAlertes({ resolue: false, limit: 50 }).catch(() => []),
  ]);

  const critiques = alertes.filter((a) => a.niveau === "critique");
  const importantes = alertes.filter((a) => a.niveau === "important");
  const rienAFaire =
    compteurs.total === 0 &&
    signatures.length === 0 &&
    critiques.length === 0 &&
    importantes.length === 0;

  const carte =
    "mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]";
  const titreCarte =
    "mb-[var(--space-admin-3)] flex items-center gap-[var(--space-admin-2)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]";
  const pastille =
    "inline-flex min-w-[1.5rem] items-center justify-center rounded-full bg-[color:var(--color-admin-error)] px-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] font-bold text-white";
  const ligne =
    "flex flex-wrap items-center justify-between gap-[var(--space-admin-2)] border-b border-[color:var(--color-admin-border)] py-[var(--space-admin-2)] last:border-b-0";
  const lien =
    "text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-accent)] hover:underline";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="🔴 À traiter"
        description="Tout ce qui attend une action, au même endroit — signatures, e-mails, relances, alertes. Quand cette page est vide, tout est à jour."
      />

      {rienAFaire && (
        <div className={carte}>
          <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)]">
            ✨ Rien à traiter — tout est à jour. Les pastilles rouges de la navigation vous
            ramèneront ici dès que quelque chose attendra.
          </p>
        </div>
      )}

      {/* ✍️ Signatures */}
      {signatures.length > 0 && (
        <div className={carte}>
          <h2 className={titreCarte}>
            ✍️ Signatures en attente <span className={pastille}>{signatures.length}</span>
          </h2>
          <ul>
            {signatures.map((s) => {
              const label = TYPE_LABELS[s.type] ?? s.type;
              const contexte = s.session ? `${s.session.titreSession} · ${s.session.numero}` : null;
              // partielle = une partie a signé → c'est (souvent) TON contreseing
              // qui manque. en_attente = personne n'a signé → relancer.
              const consigne =
                s.statutSignature === "partielle"
                  ? "une signature est posée — il manque la contrepartie"
                  : "aucune signature — relancer le signataire";
              const cible = s.sessionId
                ? `${base}/qualiopi/sessions/${s.sessionId}`
                : s.trainerId
                  ? `${base}/qualiopi/formateurs/${s.trainerId}`
                  : `${base}/qualiopi/sessions`;
              return (
                <li key={s.id} className={ligne}>
                  <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                    <strong>
                      {label} {s.numero}
                    </strong>
                    {contexte ? ` — ${contexte}` : ""}{" "}
                    <span className="text-[color:var(--color-admin-fg-muted)]">({consigne})</span>
                  </span>
                  <Link href={cible} className={lien}>
                    Ouvrir →
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ✉️ E-mails à valider */}
      {compteurs.emails > 0 && (
        <div className={carte}>
          <h2 className={titreCarte}>
            ✉️ E-mails à valider <span className={pastille}>{compteurs.emails}</span>
          </h2>
          <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Des e-mails (devis, conventions, relances…) attendent votre relecture avant de partir.
          </p>
          <Link href={`${base}/qualiopi/emails`} className={lien}>
            Ouvrir la corbeille de validation →
          </Link>
        </div>
      )}

      {/* 🚨 Alertes & relances */}
      {(critiques.length > 0 || importantes.length > 0) && (
        <div className={carte}>
          <h2 className={titreCarte}>
            🚨 Alertes &amp; relances{" "}
            <span className={pastille}>{critiques.length + importantes.length}</span>
          </h2>
          <ul>
            {[...critiques, ...importantes].map((a) => (
              <li key={a.id} className={ligne}>
                <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                  {a.niveau === "critique" ? "🔴" : "🟠"} <strong>{a.titre}</strong>
                  <span className="block text-[color:var(--color-admin-fg-muted)]">
                    {a.message}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-[var(--space-admin-2)]">
            <Link href={`${base}/qualiopi/alertes`} className={lien}>
              Gérer les alertes (marquer lu / résoudre) →
            </Link>
          </p>
        </div>
      )}
    </AdminPageShell>
  );
}
