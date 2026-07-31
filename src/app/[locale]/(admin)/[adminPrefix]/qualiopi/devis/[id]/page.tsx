/**
 * Admin — Qualiopi · Détail d&apos;un devis (T19 Cluster E4a).
 *
 * Affiche :
 *   - Fiche de statut (numéro, client, montant, financement, validité, mention TVA).
 *   - Lignes du devis.
 *   - `DevisLifecycleButtons` (envoyer / accepter / refuser selon statut).
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { DevisLifecycleButtons } from "@/components/admin/qualiopi/DevisLifecycleButtons";
import { DevisContresignature } from "@/components/admin/qualiopi/DevisContresignature";
import { contresignerPieceAction } from "@/server/actions/qualiopi/piece-signature";
import { getOrganismeIdentite } from "@/server/qualiopi/documents/organisme";
import { FacturerDevisButtons } from "@/components/admin/qualiopi/FacturerDevisButtons";
import { getDevis } from "@/server/qualiopi/crm/devis";
import { getClient } from "@/server/qualiopi/crm/clients";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Devis | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers & libellés
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
  transforme_convention: "Transformé en convention",
};

const FINANCEMENT_LABELS: Record<string, string> = {
  direct: "Direct (entreprise)",
  opco: "OPCO",
  cpf: "CPF / EDOF",
  france_travail: "France Travail",
};

function formatEur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types des lignes JSON
// ─────────────────────────────────────────────────────────────────────────────

interface DevisLigne {
  designation: string;
  quantite: number;
  prixUnitaireHtCents: number;
  offreTierId?: string;
  offreCode?: string;
}

/**
 * Référence d'offre lisible d'une ligne, quelle que soit sa génération.
 *
 * Deux formes coexistent en base et aucune migration ne les réconciliera : les
 * lignes émises avant ce correctif rangeaient un CODE (AXI-DEV-2026-002 porte
 * `"offreTierId": "AXI-OFF-201"`) OU un vrai tierId selon l'offre, parce que le
 * <select> émettait `tierId ?? code`. Les devis déjà émis sont des pièces
 * immuables : on lit les deux formes, on n'en réécrit aucune.
 */
function refOffre(ligne: DevisLigne): string | null {
  if (ligne.offreCode !== undefined && ligne.offreCode !== "") return ligne.offreCode;
  if (ligne.offreTierId !== undefined && ligne.offreTierId !== "") return ligne.offreTierId;
  return null;
}

function parseLignes(raw: unknown): DevisLigne[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (l): l is DevisLigne =>
      typeof l === "object" &&
      l !== null &&
      typeof (l as Record<string, unknown>).designation === "string",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function QualiopiDevisDetailPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const devis = await getDevis(id);
  if (!devis) notFound();

  const client = await getClient(devis.clientId);

  // Factures déjà émises sur ce devis (hors avoirs/annulées) — alimente le
  // bloc « Facturer ce devis » (acompte / solde avec déduction).
  const facturesLiees = await prisma.factureFormation.findMany({
    where: { devisId: devis.id, statut: { not: "annulee" }, avoirDeId: null },
    select: { numero: true, montantHtCents: true },
    orderBy: { createdAt: "asc" },
  });
  const dejaFactureHtCents = facturesLiees.reduce((acc, f) => acc + f.montantHtCents, 0);

  // ── État RÉEL de la signature, lu du registre de preuve ──
  //
  // 🔴 Source de vérité = les lignes `document_signatures`, jamais le statut
  // dérivé porté par la pièce. Afficher le second sans le premier reproduirait
  // le défaut que ce chantier retire partout : une case « signé » sans
  // signataire, sans horodatage et sans empreinte.
  const signatures =
    devis.documentGenereId !== null
      ? await prisma.documentSignature.findMany({
          where: { documentGenereId: devis.documentGenereId, revokedAt: null },
          select: {
            id: true,
            partie: true,
            signataireNom: true,
            signataireQualite: true,
            signeAt: true,
            selfHash: true,
            methode: true,
          },
          // ⚠️ Même tri que la chaîne (`createdAt`, puis `id`) : trier sur
          // `signeAt` afficherait un ordre qui peut différer de celui du
          // chaînage, et donnerait à lire une séquence qui n'est pas la vraie.
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        })
      : [];
  const clientASigne = signatures.some((s) => s.partie === "client");
  const organismeASigne = signatures.some((s) => s.partie === "axionia");
  const identiteOrganisme = await getOrganismeIdentite();

  const devisBase = `/${locale}/${adminPrefix}/qualiopi/devis`;
  const lignes = parseLignes(devis.lignes);

  const isExpired =
    (devis.statut === "brouillon" || devis.statut === "envoye") && devis.dateValidite < new Date();

  const infoLabelCls =
    "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  const infoValueCls =
    "mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
  const sectionHeadCls =
    "text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)] mb-[var(--space-admin-3)]";
  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      {/* Fil d&apos;Ariane */}
      <div className="mb-[var(--space-admin-4)] flex items-center gap-[var(--space-admin-3)]">
        <Link
          href={devisBase}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Devis
        </Link>
      </div>

      <AdminPageHeader
        title={`Devis ${devis.numero}`}
        description={
          client
            ? `${client.raisonSociale} · ${STATUT_LABELS[devis.statut] ?? devis.statut}`
            : `Client inconnu · ${STATUT_LABELS[devis.statut] ?? devis.statut}`
        }
      />

      {/* ── Fiche de statut ─────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Informations</h2>
        <div className="grid grid-cols-2 gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] sm:grid-cols-4">
          {/* Statut */}
          <div>
            <p className={infoLabelCls}>Statut</p>
            <p
              className={
                devis.statut === "accepte"
                  ? `${infoValueCls} text-[color:var(--color-admin-success)]`
                  : devis.statut === "refuse" || devis.statut === "expire"
                    ? `${infoValueCls} text-[color:var(--color-admin-fg-muted)]`
                    : devis.statut === "envoye"
                      ? `${infoValueCls} text-[color:var(--color-admin-warning)]`
                      : infoValueCls
              }
            >
              {STATUT_LABELS[devis.statut] ?? devis.statut}
            </p>
          </div>

          {/* Montant HT */}
          <div>
            <p className={infoLabelCls}>Montant HT</p>
            <p className={infoValueCls}>
              <span className="tabular-nums">{formatEur(devis.montantTotalHtCents)}</span>
            </p>
          </div>

          {/* Financement */}
          <div>
            <p className={infoLabelCls}>Financement suggéré</p>
            <p className={infoValueCls}>
              {devis.financementSuggere ? (
                (FINANCEMENT_LABELS[devis.financementSuggere] ?? devis.financementSuggere)
              ) : (
                <span className="text-[color:var(--color-admin-fg-muted)]">—</span>
              )}
            </p>
          </div>

          {/* Validité */}
          <div>
            <p className={infoLabelCls}>Validité</p>
            <p
              className={
                isExpired ? `${infoValueCls} text-[color:var(--color-admin-warning)]` : infoValueCls
              }
            >
              {formatDate(devis.dateValidite)}
              {isExpired && (
                <span className="ml-[var(--space-admin-1)] text-[length:var(--text-admin-xs)]">
                  (expiré)
                </span>
              )}
            </p>
          </div>

          {/* OPCO estimé */}
          {devis.montantOpcoEstimeCents != null && (
            <div>
              <p className={infoLabelCls}>Prise en charge OPCO estimée</p>
              <p className={infoValueCls}>
                <span className="tabular-nums">{formatEur(devis.montantOpcoEstimeCents)}</span>
              </p>
            </div>
          )}

          {/* Reste à charge */}
          {devis.resteAChargeCents != null && (
            <div>
              <p className={infoLabelCls}>Reste à charge</p>
              <p className={infoValueCls}>
                <span className="tabular-nums">{formatEur(devis.resteAChargeCents)}</span>
              </p>
            </div>
          )}

          {/* Envoyé le */}
          {devis.sentAt != null && (
            <div>
              <p className={infoLabelCls}>Envoyé le</p>
              <p className={infoValueCls}>{formatDate(devis.sentAt)}</p>
            </div>
          )}

          {/* Accepté / refusé le */}
          {devis.acceptedAt != null && (
            <div>
              <p className={infoLabelCls}>Accepté le</p>
              <p className={`${infoValueCls} text-[color:var(--color-admin-success)]`}>
                {formatDate(devis.acceptedAt)}
              </p>
            </div>
          )}
          {devis.declinedAt != null && (
            <div>
              <p className={infoLabelCls}>Refusé le</p>
              <p className={`${infoValueCls} text-[color:var(--color-admin-fg-muted)]`}>
                {formatDate(devis.declinedAt)}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Mention TVA ─────────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Mention TVA</h2>
        <p className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          {/*
            🔴 F25 — un devis sans mention n'est pas un devis sans régime : c'est
            le régime « assujetti », qui n'appelle aucune mention d'exonération.
            Laisser l'encart vide se lirait comme une donnée manquante, et
            pousserait à « corriger » en ajoutant une exonération non détenue.
          */}
          {devis.mentionTva !== null && devis.mentionTva !== ""
            ? devis.mentionTva
            : "Assujetti à la TVA au taux standard — aucune mention d'exonération applicable."}
        </p>
      </section>

      {/* ── Lignes ──────────────────────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Lignes</h2>
        {lignes.length === 0 ? (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Aucune ligne.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)]">
            <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
              <thead className="border-b border-[color:var(--color-admin-border)]">
                <tr>
                  <th className={headCls}>Désignation</th>
                  <th className={`${headCls} text-right`}>Qté</th>
                  <th className={`${headCls} text-right`}>PU HT</th>
                  <th className={`${headCls} text-right`}>Total HT</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-[color:var(--color-admin-border)] last:border-0"
                  >
                    <td className={cellCls}>
                      {ligne.designation}
                      {/* 🔴 Le garde porte sur les DEUX formes, pas seulement le texte
                          affiché : le laisser sur `offreTierId` seul ferait DISPARAÎTRE
                          la référence d'offre pour tout le catalogue V2 dès que les
                          nouvelles lignes cessent de renseigner ce champ. */}
                      {refOffre(ligne) !== null && (
                        <div className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                          Offre : {refOffre(ligne)}
                        </div>
                      )}
                    </td>
                    <td className={`${cellCls} text-right tabular-nums`}>{ligne.quantite}</td>
                    <td className={`${cellCls} text-right tabular-nums`}>
                      {formatEur(ligne.prixUnitaireHtCents)}
                    </td>
                    <td className={`${cellCls} text-right font-medium tabular-nums`}>
                      {formatEur(Math.round(ligne.quantite * ligne.prixUnitaireHtCents))}
                    </td>
                  </tr>
                ))}
                {/* Ligne de total */}
                <tr className="border-t-2 border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)]">
                  <td colSpan={3} className={`${cellCls} font-semibold`}>
                    Total HT
                  </td>
                  <td className={`${cellCls} text-right font-semibold tabular-nums`}>
                    {formatEur(devis.montantTotalHtCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Signature électronique ───────────────────────────────────────── */}
      {/*
        Cette section affichait la soumission DocuSeal et un champ « copier le
        lien du client ». La bascule du 2026-07-30 vers le canal maison la rend
        sans objet, et c'est un GAIN de sûreté : on ne stocke que le HASH du
        jeton, si bien que la console ne détient plus le lien personnel du
        client. Le composant `DevisSignatureLinkCopy` disait lui-même pourquoi ce
        lien était dangereux à exposer — « un admin qui l'ouvre peut signer à sa
        place, et l'audit trail enregistrerait l'IP d'Axion-IA sous la signature
        du client ». Le problème n'est plus atténué, il est supprimé.

        On affiche désormais les signatures RÉELLEMENT apposées, lues du registre
        de preuve, avec de quoi les vérifier.
      */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Signature électronique</h2>

        {/* Signatures RÉELLEMENT apposées, avec ce dont elles sont faites. */}
        {signatures.length > 0 && (
          <ul className="mb-[var(--space-admin-4)] space-y-[var(--space-admin-3)]">
            {signatures.map((s) => (
              <li
                key={s.id}
                className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
              >
                <p className={infoLabelCls}>
                  {s.partie === "client" ? "Accord du client" : "Contresignature de l'organisme"}
                </p>
                <p className={infoValueCls}>
                  {s.signataireNom}
                  {s.signataireQualite !== null ? ` — ${s.signataireQualite}` : ""}
                </p>
                <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  {`Signé le ${s.signeAt.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`}
                  {s.methode === "confirmation_accessible"
                    ? " — confirmation nominative, sans tracé manuscrit"
                    : ""}
                </p>
                {/* 🔴 L'empreinte EN ENTIER : une empreinte tronquée ne se
                    vérifie pas, et une preuve invérifiable n'en est pas une. */}
                <p className="mt-[var(--space-admin-1)] text-[length:var(--text-admin-xs)] break-all text-[color:var(--color-admin-fg-muted)]">
                  <code>{s.selfHash}</code>
                </p>
              </li>
            ))}
          </ul>
        )}

        {/* 🔴 L'organisme CONCLUT — il contresigne ce que le client a accepté.
            Le bouton n'apparaît donc qu'une fois le client signataire : c'est la
            même règle que celle que l'action refuse côté serveur, et l'écran ne
            doit pas proposer ce que le serveur refusera. */}
        {devis.documentGenereId !== null && clientASigne && !organismeASigne && (
          <DevisContresignature
            documentGenereId={devis.documentGenereId}
            organismeNom={identiteOrganisme.raisonSociale}
            contresignerAction={contresignerPieceAction}
          />
        )}

        {clientASigne && organismeASigne && (
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
            Devis intégralement signé. La chaîne de preuve est vérifiable dans Qualiopi › Mode
            auditeur › Signatures.
          </p>
        )}

        {/* 🔴 L'exemplaire signé — sans lui, la preuve n'existait QU'en base.
            Le PDF remis au client et vu par l'auditeur continuait d'afficher des
            cadres vides, alors que la signature était enregistrée et chaînée.

            ⚠️ Rendu à la volée : ce n'est PAS la pièce du registre, dont
            l'empreinte est scellée et ne doit jamais être réécrite. */}
        {signatures.length > 0 && (
          <p className="mt-[var(--space-admin-4)]">
            <a
              href={`/api/qualiopi/pieces/${devis.documentGenereId}/exemplaire-signe`}
              className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-accent)] underline underline-offset-4"
            >
              Télécharger l&apos;exemplaire signé (PDF)
            </a>
            <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
              Le devis avec les signatures apposées. La pièce d&apos;origine, scellée, reste
              inchangée.
            </span>
          </p>
        )}

        {/* ⚠️ L'alerte reste restreinte au statut « envoyé » : sur un brouillon
            aucun lien n'existe encore, et sur un devis accepté / refusé / expiré
            / transformé il n'y a plus rien à signer — l'afficher serait un faux
            positif permanent. */}
        {devis.statut === "envoye" && !clientASigne && (
          <p
            role="alert"
            className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning)]"
          >
            {devis.documentGenereId === null
              ? "Aucune pièce n'a été générée pour ce devis : le client ne peut pas signer en ligne. Réviser le devis pour le réémettre."
              : "Le client n'a pas encore signé. Le lien de signature lui a été envoyé avec le devis ; renvoyer l'email en émet un nouveau et invalide le précédent."}
          </p>
        )}
      </section>

      {/* ── Actions de cycle de vie ──────────────────────────────────────── */}
      <section className="mb-[var(--space-admin-8)]">
        <h2 className={sectionHeadCls}>Actions</h2>
        <DevisLifecycleButtons devisId={devis.id} statut={devis.statut} />
      </section>

      {/* ── Facturation (acompte / solde) — devis accepté uniquement ─────── */}
      {(devis.statut === "accepte" || devis.statut === "transforme_convention") && (
        <section>
          <h2 className={sectionHeadCls}>Facturer ce devis</h2>
          {facturesLiees.length > 0 && (
            <ul className="mb-[var(--space-admin-3)] space-y-1 text-[length:var(--text-admin-sm)]">
              {facturesLiees.map((f) => (
                <li key={f.numero}>
                  {f.numero} — <span className="tabular-nums">{formatEur(f.montantHtCents)}</span>{" "}
                  HT
                </li>
              ))}
            </ul>
          )}
          <FacturerDevisButtons
            devisId={devis.id}
            dejaFactureHtCents={dejaFactureHtCents}
            totalDevisHtCents={devis.montantTotalHtCents}
          />
        </section>
      )}
    </AdminPageShell>
  );
}
