/**
 * Admin — Qualiopi · À traiter (refonte console phase 1, 2026-08-01 ; passage
 * aux pictogrammes lucide couche 4, même date).
 *
 * LA porte d'entrée de la console. Verdict de Will sur l'ancienne organisation :
 * « on ne sait pas où regarder, on ne sait pas par quoi commencer ». Cette page
 * répond à la seule question du matin : « qu'est-ce que je dois faire ? »
 *
 * Trois blocs, dans l'ordre d'urgence :
 *   - Signatures — pièces à contresigner (quelqu'un a signé, il manque une
 *     partie) et signatures client qui n'ont pas commencé.
 *   - E-mails — la corbeille de validation F60.
 *   - Alertes & relances — les alertes actives de l'évaluateur quotidien
 *     (OPCO sans réponse, impayés, devis dormants, vigilance URSSAF, NDA…).
 *
 * Zéro logique propre : les chiffres viennent de `compterQualiopiNav()`
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
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { compterQualiopiNav } from "@/server/admin/qualiopi-nav-counts";
import { listAlertes } from "@/server/qualiopi/alertes/alertes-service";
import { depuisMaintenant, joursEcoules } from "@/lib/admin/relative-time";
import {
  PenLine,
  Mail,
  CircleAlert,
  TriangleAlert,
  Clock,
  Inbox,
  Wrench,
  ChevronRight,
  CheckCheck,
  Signature,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Pastille de résumé en tête de page. Rendue seulement si le compteur est
 * non nul : une rangée de zéros n'apprend rien et dilue ce qui compte.
 */
function Resume({
  icon: Icon,
  ton,
  n,
  libelle,
}: {
  icon: LucideIcon;
  /** Teinte du pictogramme — seul le compte critique se distingue. */
  ton?: "danger" | "warning";
  n: number;
  libelle: string;
}): React.ReactElement | null {
  if (n === 0) return null;
  const teinte =
    ton === "danger"
      ? "text-[color:var(--color-admin-destructive)]"
      : ton === "warning"
        ? "text-[color:var(--color-admin-warning)]"
        : "text-[color:var(--color-admin-fg-muted)]";
  return (
    <span className="inline-flex items-center gap-[var(--space-admin-3)] rounded-[var(--radius-admin-pill)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-5)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
      <Icon size={15} aria-hidden="true" className={`shrink-0 ${teinte}`} />
      <strong className="tabular-nums">{n}</strong>
      <span className="text-[color:var(--color-admin-fg-soft)]">{libelle}</span>
    </span>
  );
}

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

  // Refonte UI 2026-08-01 (couche 4) — la page listait tout à plat, en lignes
  // séparées d'un filet, avec un lien texte « Ouvrir → » à droite. Rien
  // n'indiquait DEPUIS QUAND une pièce attendait, alors que c'est ce qui
  // distingue une signature posée ce matin d'une qui traîne depuis trois
  // semaines. Les cartes s'alignent maintenant sur `AdminCard` (rayon 16),
  // chaque ligne devient une TUILE cliquable, et l'ancienneté est affichée.
  const carte =
    "mb-[var(--space-admin-6)] rounded-[var(--radius-admin-xl)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-card)] shadow-[var(--shadow-admin-1)]";
  const titreCarte =
    "mb-[var(--space-admin-2)] flex items-center gap-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]";
  const sousTitreCarte =
    "mb-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]";
  const pastille =
    "inline-flex min-w-[1.5rem] items-center justify-center rounded-[var(--radius-admin-pill)] bg-[color:var(--color-admin-destructive)] px-[var(--space-admin-3)] text-[length:var(--text-admin-xs)] font-bold tabular-nums text-white";
  const tuile =
    "flex flex-wrap items-center justify-between gap-[var(--space-admin-4)] rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper-alt)] p-[var(--space-admin-5)] transition-colors hover:border-[color:var(--color-admin-accent)] hover:bg-[color:var(--color-admin-surface-hover)]";
  const listeTuiles = "flex flex-col gap-[var(--space-admin-3)]";
  const meta = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="À traiter"
        description="Tout ce qui attend une action, au même endroit — signatures, e-mails, relances, alertes. Quand cette page est vide, tout est à jour."
      />

      {rienAFaire ? (
        <AdminEmptyState
          icon={<CheckCheck size={22} aria-hidden="true" />}
          title="Rien à traiter — tout est à jour"
          description="Les pastilles rouges de la navigation vous ramèneront ici dès que quelque chose attendra une action."
        />
      ) : (
        // Résumé en tête : combien, et de quelle nature. Avant, il fallait
        // faire défiler la page pour savoir ce qui attendait.
        <div className="mb-[var(--space-admin-7)] flex flex-wrap items-center gap-[var(--space-admin-3)]">
          <Resume icon={PenLine} n={signatures.length} libelle="signature(s)" />
          <Resume icon={Mail} n={compteurs.emails} libelle="e-mail(s) à valider" />
          <Resume
            icon={CircleAlert}
            ton="danger"
            n={critiques.length}
            libelle="alerte(s) critique(s)"
          />
          <Resume
            icon={TriangleAlert}
            ton="warning"
            n={importantes.length}
            libelle="alerte(s) importante(s)"
          />
        </div>
      )}

      {/* Signatures */}
      {signatures.length > 0 && (
        <div className={carte}>
          <h2 className={titreCarte}>
            <Signature size={18} aria-hidden="true" className="shrink-0" />
            Signatures en attente <span className={pastille}>{signatures.length}</span>
          </h2>
          <p className={sousTitreCarte}>
            Une pièce reste bloquée tant qu’il manque une signature — la vôtre ou celle du client.
          </p>
          <ul className={listeTuiles}>
            {signatures.map((s) => {
              const label = TYPE_LABELS[s.type] ?? s.type;
              const contexte = s.session ? `${s.session.titreSession} · ${s.session.numero}` : null;
              // partielle = une partie a signé → c'est (souvent) TON contreseing
              // qui manque. en_attente = personne n'a signé → relancer.
              const aContresigner = s.statutSignature === "partielle";
              const consigne = aContresigner
                ? "une signature est posée — il manque la contrepartie"
                : "aucune signature — relancer le signataire";
              const cible = s.sessionId
                ? `${base}/qualiopi/sessions/${s.sessionId}`
                : s.trainerId
                  ? `${base}/qualiopi/formateurs/${s.trainerId}`
                  : `${base}/qualiopi/sessions`;
              const jours = joursEcoules(s.updatedAt);
              return (
                <li key={s.id}>
                  <Link href={cible} className={tuile}>
                    <span className="flex min-w-0 items-start gap-[var(--space-admin-4)]">
                      {/* Deux attentes de nature opposée : « à contresigner »
                          appelle un geste de votre part, « en attente » appelle
                          une relance. Le pictogramme le dit avant la phrase. */}
                      {aContresigner ? (
                        <PenLine
                          size={17}
                          aria-hidden="true"
                          className="mt-[2px] shrink-0 text-[color:var(--color-admin-accent)]"
                        />
                      ) : (
                        <Clock
                          size={17}
                          aria-hidden="true"
                          className="mt-[2px] shrink-0 text-[color:var(--color-admin-fg-muted)]"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                          <strong>
                            {label} {s.numero}
                          </strong>
                          {contexte ? ` — ${contexte}` : ""}
                        </span>
                        <span className={`block ${meta}`}>
                          {consigne} · {depuisMaintenant(s.updatedAt)}
                          {/* Au-delà de deux semaines, l'attente n'est plus
                              ordinaire : on le dit au lieu de laisser le
                              lecteur faire le calcul. */}
                          {jours >= 14 ? (
                            <strong className="ml-[var(--space-admin-2)] text-[color:var(--color-admin-destructive)]">
                              ⚠️ {jours} jours d’attente
                            </strong>
                          ) : null}
                        </span>
                      </span>
                    </span>
                    <span className="admin-button-ghost shrink-0">
                      Ouvrir
                      <ChevronRight size={15} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* E-mails à valider */}
      {compteurs.emails > 0 && (
        <div className={carte}>
          <h2 className={titreCarte}>
            <Mail size={18} aria-hidden="true" className="shrink-0" />
            E-mails à valider <span className={pastille}>{compteurs.emails}</span>
          </h2>
          <p className={sousTitreCarte}>
            Des e-mails (devis, conventions, relances…) attendent votre relecture avant de partir.
          </p>
          <Link href={`${base}/qualiopi/emails`} className="admin-button">
            <Inbox size={16} aria-hidden="true" />
            Ouvrir la corbeille de validation
          </Link>
        </div>
      )}

      {/* Alertes & relances */}
      {(critiques.length > 0 || importantes.length > 0) && (
        <div className={carte}>
          <h2 className={titreCarte}>
            <TriangleAlert size={18} aria-hidden="true" className="shrink-0" />
            Alertes &amp; relances{" "}
            <span className={pastille}>{critiques.length + importantes.length}</span>
          </h2>
          <p className={sousTitreCarte}>
            Détectées chaque matin par l’évaluateur automatique. Les critiques d’abord.
          </p>
          <ul className={listeTuiles}>
            {[...critiques, ...importantes].map((a) => {
              const critique = a.niveau === "critique";
              return (
                <li
                  key={a.id}
                  className={`${tuile} items-start border-l-4 ${
                    critique
                      ? "border-l-[color:var(--color-admin-destructive)]"
                      : "border-l-[color:var(--color-admin-warning)]"
                  }`}
                >
                  <span className="flex min-w-0 items-start gap-[var(--space-admin-4)]">
                    {critique ? (
                      <CircleAlert
                        size={17}
                        aria-hidden="true"
                        className="mt-[2px] shrink-0 text-[color:var(--color-admin-destructive)]"
                      />
                    ) : (
                      <TriangleAlert
                        size={17}
                        aria-hidden="true"
                        className="mt-[2px] shrink-0 text-[color:var(--color-admin-warning)]"
                      />
                    )}
                    <span className="min-w-0">
                      <span className="block text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
                        {a.titre}
                      </span>
                      {/* Certaines alertes reportent une réponse d'API brute
                          (le message d'échec d'un job IA fait plusieurs
                          centaines de caractères de JSON). Sans limite, une
                          seule alerte remplissait l'écran et enterrait les
                          autres. Le texte complet reste dans l'infobulle. */}
                      <span
                        title={a.message}
                        className="mt-[var(--space-admin-2)] line-clamp-2 block text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]"
                      >
                        {a.message}
                      </span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-[var(--space-admin-6)]">
            <Link href={`${base}/qualiopi/alertes`} className="admin-button-secondary">
              <Wrench size={16} aria-hidden="true" />
              Gérer les alertes (marquer lu / résoudre)
            </Link>
          </p>
        </div>
      )}
    </AdminPageShell>
  );
}
