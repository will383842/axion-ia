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
import { redirect } from "next/navigation";
import { ArrowRight, CheckCheck, CircleAlert, Mail, Signature, TriangleAlert } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { RelancerSignatureButton } from "@/components/admin/qualiopi/RelancerSignatureButton";
import { compterQualiopiNav } from "@/server/admin/qualiopi-nav-counts";
import { listAlertes } from "@/server/qualiopi/alertes/alertes-service";
import { partieARelancer } from "@/server/qualiopi/documents/signature/relance-partie";
import type { DocumentType } from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — À traiter | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

/**
 * Nombre de jours entiers écoulés depuis une date (arrondi au jour inférieur).
 * Utilisé pour afficher « en attente depuis X jours » sur les signatures — la
 * seule donnée déjà en base (`updatedAt`) qui dit depuis quand ça traîne,
 * jusqu'ici sélectionnée mais jamais affichée à l'écran.
 */
function joursDepuis(date: Date, maintenant = new Date()): number {
  return Math.max(0, Math.floor((maintenant.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)));
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
        // Parties DÉJÀ signataires (signatures non révoquées) : c'est ce qui
        // permet à `partieARelancer` de viser la PROCHAINE partie du circuit
        // sur une pièce `partielle` — et de ne proposer AUCUN bouton quand la
        // partie manquante est l'organisme (c'est un contreseing, pas un
        // e-mail à envoyer).
        signatures: { where: { revokedAt: null }, select: { partie: true } },
      },
    });
  } catch {
    return [];
  }
}

/**
 * Retire les pièces REMPLACÉES : une pièce non signée dont une autre du même
 * type, sur la même session, est intégralement signée.
 *
 * 🔴 Sans ce filtre, « À traiter » réclamait une signature sur une obligation
 * DÉJÀ satisfaite. Constaté sur INVEST SUN : la convention `-009` était signée
 * des deux côtés, et la liste réclamait toujours `-003` (la première, remplacée)
 * et `-011` (une copie née d'un clic sur « Convention » pour la télécharger).
 *
 * Le coût n'est pas cosmétique : ces lignes ne partent JAMAIS d'elles-mêmes, et
 * chaque régénération en ajoute une définitivement. Une liste de tâches qui ne
 * peut plus se vider cesse d'être lue.
 *
 * ⚠️ Une pièce SANS session (lettre de mission, devis) n'est jamais masquée :
 * rien ne permettrait d'affirmer qu'elle est remplacée.
 */
async function retirerPiecesRemplacees<T extends { sessionId: string | null; type: DocumentType }>(
  pieces: T[],
): Promise<T[]> {
  const sessionIds = [
    ...new Set(pieces.map((p) => p.sessionId).filter((v): v is string => v !== null)),
  ];
  if (sessionIds.length === 0) return pieces;

  try {
    const signees = await prisma.documentGenere.findMany({
      where: {
        sessionId: { in: sessionIds },
        statutSignature: "signee",
        type: { in: [...new Set(pieces.map((p) => p.type))] },
      },
      select: { sessionId: true, type: true },
    });
    const couvert = new Set(signees.map((s) => `${s.sessionId}::${s.type}`));
    return pieces.filter((p) => p.sessionId === null || !couvert.has(`${p.sessionId}::${p.type}`));
  } catch {
    // Sur échec de lecture on n'ose PAS masquer : mieux vaut une ligne en trop
    // qu'une signature réellement due qui disparaît de l'écran.
    return pieces;
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

  const [compteurs, signaturesBrutes, alertesBrutes] = await Promise.all([
    compterQualiopiNav(),
    lireSignaturesEnAttente(),
    listAlertes({ resolue: false, limit: 50 }).catch(() => []),
  ]);

  // Les pièces déjà remplacées par une version signée ne sont pas des tâches.
  const signatures = await retirerPiecesRemplacees(signaturesBrutes);

  // 🔴 Audit du 2026-08-01 (défaut P1) — `signature_en_attente` et
  // `signature_contreseing_du` sont les MÊMES pièces que celles déjà listées
  // dans le bloc « Signatures » ci-dessous, avec plus de détail (type, contexte
  // session, lien direct). Les laisser dans le bloc Alertes fait apparaître la
  // même pièce deux fois sur cette page. On les filtre UNIQUEMENT ici : elles
  // continuent d'exister côté évaluateur/DB pour la pastille de la sidebar et
  // pour /qualiopi/alertes, qui doivent rester exhaustives.
  const alertes = alertesBrutes.filter(
    (a) => a.code !== "signature_en_attente" && a.code !== "signature_contreseing_du",
  );

  const critiques = alertes.filter((a) => a.niveau === "critique");
  const importantes = alertes.filter((a) => a.niveau === "important");
  // 🔴 Audit du 2026-08-01 (défaut P1) — `compteurs.total` (compterQualiopiNav)
  // compte TOUTES les alertes non lues, y compris niveau « info », qu'aucun des
  // 3 blocs de cette page n'affiche. Une seule alerte « info » en attente
  // rendait `rienAFaire` faux SANS qu'aucun bloc n'ait de contenu à montrer :
  // écran vide, sans le message rassurant. `rienAFaire` doit refléter
  // exactement ce qui est rendu à l'écran, pas le total de la pastille.
  const rienAFaire =
    signatures.length === 0 &&
    compteurs.emails === 0 &&
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

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="À traiter"
        description="Tout ce qui attend une action, au même endroit — signatures, e-mails, relances, alertes. Quand cette page est vide, tout est à jour."
      />

      {rienAFaire && (
        <div className={carte}>
          <p className="text-[length:var(--text-admin-base)] text-[color:var(--color-admin-fg)]">
            <CheckCheck
              size={16}
              aria-hidden="true"
              className="mr-[var(--space-admin-2)] inline-block align-[-3px]"
            />
            Rien à traiter — tout est à jour. Les pastilles rouges de la navigation vous ramèneront
            ici dès que quelque chose attendra.
          </p>
        </div>
      )}

      {/* Signatures */}
      {signatures.length > 0 && (
        <div className={carte}>
          <h2 className={titreCarte}>
            <Signature size={18} aria-hidden="true" className="shrink-0" />
            Signatures en attente <span className={pastille}>{signatures.length}</span>
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
              const jours = joursDepuis(s.updatedAt);
              const attente = `en attente depuis ${jours} jour${jours > 1 ? "s" : ""}`;
              const cible = s.sessionId
                ? `${base}/qualiopi/sessions/${s.sessionId}`
                : s.trainerId
                  ? `${base}/qualiopi/formateurs/${s.trainerId}`
                  : `${base}/qualiopi/sessions`;
              // Partie à relancer, décidée ICI (côté serveur) par le module pur
              // adossé au SSOT des circuits. `null` = pas de bouton : soit la
              // prochaine signature est celle de l'organisme (contreseing de
              // Will), soit la partie signe authentifiée (formateur) et un lien
              // public serait refusé par l'action.
              const partieRelance = partieARelancer(
                s.type,
                s.statutSignature,
                s.signatures.map((sig) => sig.partie),
              );
              return (
                <li key={s.id} className={ligne}>
                  <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                    <strong>
                      {label} {s.numero}
                    </strong>
                    {contexte ? ` — ${contexte}` : ""}{" "}
                    <span className="text-[color:var(--color-admin-fg-muted)]">
                      ({consigne} — {attente})
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                    {partieRelance !== null && (
                      <RelancerSignatureButton documentGenereId={s.id} partie={partieRelance} />
                    )}
                    <AdminButton href={cible} variant="ghost" size="sm" iconAfter={ArrowRight}>
                      Ouvrir
                    </AdminButton>
                  </span>
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
          <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Des e-mails (devis, conventions, relances…) attendent votre relecture avant de partir.
          </p>
          <AdminButton
            href={`${base}/qualiopi/emails`}
            variant="ghost"
            size="sm"
            iconAfter={ArrowRight}
          >
            Ouvrir la corbeille de validation
          </AdminButton>
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
          <ul>
            {[...critiques, ...importantes].map((a) => (
              <li key={a.id} className={ligne}>
                <span className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
                  {/* Le niveau se lisait 🔴 contre 🟠 : deux ronds que SEULE la
                      couleur distinguait — illisible en vision des couleurs
                      déficiente, sur l'information la plus urgente de la page.
                      Deux SILHOUETTES différentes le disent sans la couleur. */}
                  {a.niveau === "critique" ? (
                    <CircleAlert
                      size={15}
                      aria-label="Critique"
                      className="mr-[var(--space-admin-2)] inline-block shrink-0 align-[-2px] text-[color:var(--color-admin-destructive)]"
                    />
                  ) : (
                    <TriangleAlert
                      size={15}
                      aria-label="Important"
                      className="mr-[var(--space-admin-2)] inline-block shrink-0 align-[-2px] text-[color:var(--color-admin-warning)]"
                    />
                  )}
                  <strong>{a.titre}</strong>
                  {/* Certaines alertes recopient une réponse d'API brute — un
                      échec de job IA fait des centaines de caractères de JSON
                      (vu en production le 2026-08-02). Deux lignes ici ; le
                      texte complet vit dans l'infobulle et sur la page Alertes. */}
                  <span
                    title={a.message}
                    className="line-clamp-2 block text-[color:var(--color-admin-fg-muted)]"
                  >
                    {a.message}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-[var(--space-admin-2)]">
            <AdminButton
              href={`${base}/qualiopi/alertes`}
              variant="ghost"
              size="sm"
              iconAfter={ArrowRight}
            >
              Gérer les alertes (marquer lu / résoudre)
            </AdminButton>
          </p>
        </div>
      )}
    </AdminPageShell>
  );
}
