/**
 * Admin — Qualiopi · Corbeille de validation des emails (F60).
 *
 * Les emails commerciaux (relance d'impayé, devis, facture, contrat) attendent
 * ici une relecture avant de partir. La chaîne formation — convocation, rappel
 * J-7, satisfaction J+1, suivi J+30, attestation — n'y passe PAS : la retenir
 * exposerait un stagiaire à ne jamais recevoir sa convocation, et les
 * indicateurs 4, 9, 11, 30 et 32 en dépendent.
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import { Fragment } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminBlocRepliable } from "@/components/admin/ui/AdminBlocRepliable";
import { EmailOutboxItem } from "@/components/admin/qualiopi/EmailOutboxItem";
import { EmailAutomationSettings } from "@/components/admin/qualiopi/EmailAutomationSettings";
import {
  approuverEmailAction,
  refuserEmailAction,
  definirReglageEmailAction,
  supprimerReglageEmailAction,
} from "@/server/actions/qualiopi/email-outbox";
import {
  EMAILS_A_VALIDER_PAR_DEFAUT,
  EMAILS_AUTOMATIQUES_PAR_DEFAUT,
  gabaritLitLeMessage,
  libelleTemplateEmail,
  reglesRetenantDesEnvoisReglementaires,
} from "@/server/email/outbox-policy";
import {
  estEnvoiDevis,
  construireApercu,
  lireDetailsDevis,
  messageDejaSaisi,
  presenterDevis,
} from "@/components/admin/qualiopi/emails-devis-details";
import { lireReponsesSurRelancesGarees } from "@/server/relances/reponse-relance-garee";

/**
 * Natures d'email réglables. On expose les deux listes plutôt que la seule
 * liste « à valider » : le réglage doit permettre les DEUX sens — passer une
 * relance en automatique, mais aussi soumettre une convocation à validation si
 * Will le décide un jour.
 */
const TEMPLATES_REGLABLES: readonly string[] = [
  ...EMAILS_A_VALIDER_PAR_DEFAUT,
  ...EMAILS_AUTOMATIQUES_PAR_DEFAUT,
];

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formation — E-mails à valider | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const dateFr = (d: Date): string =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default async function EmailsAValiderPage({
  params,
}: {
  params: Promise<{ locale: string; adminPrefix: string }>;
}) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/fr/${adminPrefix}/login`);

  const [enAttente, traitesRecents, reglages, clients] = await Promise.all([
    prisma.emailOutbox.findMany({
      where: { statut: "a_valider" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        template: true,
        recipient: true,
        sujet: true,
        payload: true,
        attachments: true,
        createdAt: true,
        entityType: true,
        entityId: true,
        jobId: true,
        client: { select: { raisonSociale: true } },
      },
    }),
    prisma.emailOutbox.findMany({
      where: { statut: { in: ["envoye", "refuse"] } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        template: true,
        recipient: true,
        sujet: true,
        statut: true,
        refuseMotif: true,
        envoyeAt: true,
        refuseAt: true,
      },
    }),
    prisma.emailAutomationSetting.findMany({
      orderBy: [{ scope: "asc" }, { template: "asc" }],
      select: {
        id: true,
        scope: true,
        template: true,
        mode: true,
        client: { select: { raisonSociale: true } },
      },
    }),
    prisma.client.findMany({
      orderBy: { raisonSociale: "asc" },
      select: { id: true, raisonSociale: true },
    }),
  ]);

  // Lot 8A — une relance formateur garée ici peut encore partir après sa réponse : on le dit.
  // Une seule requête groupée pour tous les devis en attente (pas de N+1).
  const detailsDevis = await lireDetailsDevis(prisma, enAttente);

  const reponduLe = await lireReponsesSurRelancesGarees(enAttente);

  // S5 (2026-08-26) — le gel réglementaire par règle NOMMÉE reste permis (la
  // règle nommée est souveraine, c'est documenté dans `outbox-policy.ts`) mais
  // il ne doit jamais être SILENCIEUX : tant qu'une telle règle est active, la
  // page le dit — en persistance, pas seulement au moment du clic.
  const naturesRetenues = reglesRetenantDesEnvoisReglementaires(reglages);

  const COLONNE =
    "px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-left text-[length:var(--text-admin-xs)] font-semibold text-[color:var(--color-admin-fg-muted)]";
  const CELLULE =
    "px-[var(--space-admin-3)] py-[var(--space-admin-2)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="E-mails à valider"
        description="Relisez puis envoyez les e-mails commerciaux."
        meta={
          <>
            {enAttente.length > 0 ? (
              <AdminBadge tone="warning">{enAttente.length} à relire</AdminBadge>
            ) : (
              <AdminBadge tone="success">Rien à relire</AdminBadge>
            )}
            <AdminBadge tone="neutral">
              {reglages.length} règle{reglages.length > 1 ? "s" : ""} personnalisée
              {reglages.length > 1 ? "s" : ""}
            </AdminBadge>
            {naturesRetenues.length > 0 && (
              <AdminBadge tone="destructive">Envois retenus</AdminBadge>
            )}
          </>
        }
      />

      <AdminBlocRepliable titre="Comment ça marche" className="mb-[var(--space-admin-6)]">
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Les emails commerciaux attendent votre relecture avant de partir. La chaîne formation —
          convocation, rappel, questionnaires, attestation — part automatiquement et n&apos;apparaît
          pas ici. Une règle plus précise l&apos;emporte sur une règle plus générale — un réglage
          par client prime sur le réglage global.
        </p>
      </AdminBlocRepliable>

      {naturesRetenues.length > 0 && (
        <div
          role="alert"
          className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
        >
          <p className="m-0">
            <span className="font-semibold">
              Cette règle retient des envois réglementaires (convocations, attestations…) : ils
              partiront seulement après validation manuelle.
            </span>{" "}
            Natures concernées :
          </p>
          <p className="my-[var(--space-admin-2)] flex flex-wrap gap-[var(--space-admin-2)]">
            {naturesRetenues.map((t, i) => (
              <Fragment key={t}>
                <AdminBadge tone="outline">{libelleTemplateEmail(t)}</AdminBadge>
                <span className="sr-only">{i < naturesRetenues.length - 1 ? ", " : "."}</span>
              </Fragment>
            ))}
          </p>
          <p className="m-0">
            Retirez la règle correspondante ci-dessous pour rétablir l&apos;envoi automatique.
          </p>
        </div>
      )}

      <AdminBloc teinte="ambre" niveau={2} titre={`À relire (${enAttente.length})`}>
        {enAttente.length === 0 ? (
          <p
            role="status"
            className="m-0 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
          >
            <span className="font-semibold text-[color:var(--color-admin-fg)]">
              Aucun e-mail à relire
            </span>{" "}
            Aucun email en attente. Les relances d&apos;impayé, devis et factures apparaîtront ici
            avant leur envoi.
          </p>
        ) : (
          <div className="flex flex-col gap-[var(--space-admin-4)]">
            {enAttente.map((e) => {
              const brut = estEnvoiDevis(e) ? detailsDevis.get(e.entityId as string) : undefined;
              const dv = brut ? presenterDevis(brut, e.entityId as string, adminPrefix) : null;
              return (
                <EmailOutboxItem
                  key={e.id}
                  id={e.id}
                  template={e.template}
                  destinataire={e.recipient}
                  sujet={e.sujet}
                  clientNom={e.client?.raisonSociale ?? null}
                  creeLe={dateFr(e.createdAt)}
                  apercu={[
                    ...(reponduLe.has(e.id)
                      ? [
                          {
                            label: "Attention",
                            valeur: `le formateur a répondu le ${dateFr(reponduLe.get(e.id)!)}, après la mise en attente de cette relance`,
                          },
                        ]
                      : []),
                    ...construireApercu(e.payload, e.template),
                    ...(dv?.montantTtc ? [{ label: "Montant TTC", valeur: dv.montantTtc }] : []),
                  ]}
                  messageInitial={messageDejaSaisi(e.payload)}
                  lienDevis={dv?.lienDevis ?? null}
                  lienPdf={dv?.lienPdf ?? null}
                  nbPiecesJointes={Array.isArray(e.attachments) ? e.attachments.length : 0}
                  accepteMessagePersonnalise={gabaritLitLeMessage(e.template)}
                  approuverAction={approuverEmailAction}
                  refuserAction={refuserEmailAction}
                />
              );
            })}
          </div>
        )}
      </AdminBloc>

      {traitesRecents.length > 0 && (
        <AdminBloc teinte="gris" niveau={2} titre="Envoyés ou refusés récemment">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={COLONNE}>
                    Statut
                  </th>
                  <th scope="col" className={COLONNE}>
                    Date
                  </th>
                  <th scope="col" className={COLONNE}>
                    Destinataire
                  </th>
                  <th scope="col" className={COLONNE}>
                    Objet
                  </th>
                </tr>
              </thead>
              <tbody>
                {traitesRecents.map((e) => {
                  const date = e.statut === "envoye" ? e.envoyeAt : e.refuseAt;
                  return (
                    <tr key={e.id} className="border-t border-[color:var(--color-admin-border)]">
                      <td className={CELLULE}>
                        <AdminBadge tone={e.statut === "envoye" ? "success" : "neutral"}>
                          {e.statut === "envoye" ? "Envoyé" : "Refusé"}
                        </AdminBadge>
                      </td>
                      <td className={CELLULE}>{date ? dateFr(date) : "—"}</td>
                      <td className={CELLULE}>{e.recipient}</td>
                      <td className={CELLULE}>
                        {e.sujet}
                        {e.statut === "refuse" && e.refuseMotif ? (
                          <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] italic">
                            Motif : {e.refuseMotif}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminBloc>
      )}

      <AdminBloc teinte="bleu" niveau={2} titre="Règles d'envoi">
        <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Par défaut, relecture requise pour :
        </p>
        <p className="mb-[var(--space-admin-4)] flex flex-wrap gap-[var(--space-admin-2)]">
          {EMAILS_A_VALIDER_PAR_DEFAUT.map((t) => (
            <AdminBadge key={t} tone="neutral">
              {libelleTemplateEmail(t)}
            </AdminBadge>
          ))}
        </p>

        <EmailAutomationSettings
          reglages={reglages.map((r) => ({
            id: r.id,
            scope: r.scope,
            clientNom: r.client?.raisonSociale ?? null,
            template: r.template,
            mode: r.mode,
          }))}
          clients={clients}
          templates={TEMPLATES_REGLABLES}
          definirAction={definirReglageEmailAction}
          supprimerAction={supprimerReglageEmailAction}
        />
      </AdminBloc>
    </AdminPageShell>
  );
}
