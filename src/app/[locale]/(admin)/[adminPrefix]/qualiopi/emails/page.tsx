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
import { CheckCircle2, Send, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
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
import { motifRelanceDevisSansObjet } from "@/server/qualiopi/devis/relance-devis-sans-objet";
import {
  ENTITE_DEVIS,
  TEMPLATE_RELANCE_DEVIS,
} from "@/features/dossier-client/fiche/relance-devis";

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

const FUSEAU = "Europe/Paris";
const jourFr = (d: Date): string => {
  const t = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: FUSEAU,
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const heureFr = (d: Date): string =>
  d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: FUSEAU });
const NUMERO_DEVIS = /AXI-DEV-\d{4}-\d{3}/;

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

  // Une relance de devis garée peut être devenue inutile : un seul calcul par devis distinct,
  // lecture seule. Un calcul qui échoue ne pose aucun bandeau et ne casse jamais la page.
  const maintenant = new Date();
  const devisRelances = [
    ...new Set(
      enAttente
        .filter(
          (e) =>
            e.template === TEMPLATE_RELANCE_DEVIS &&
            e.entityType === ENTITE_DEVIS &&
            e.entityId !== null,
        )
        .map((e) => e.entityId as string),
    ),
  ];
  const motifsSansObjet = new Map<string, string | null>(
    await Promise.all(
      devisRelances.map(async (devisId): Promise<[string, string | null]> => {
        try {
          return [devisId, await motifRelanceDevisSansObjet(prisma, devisId, maintenant)];
        } catch {
          return [devisId, null];
        }
      }),
    ),
  );

  // S5 (2026-08-26) — le gel réglementaire par règle NOMMÉE reste permis (la
  // règle nommée est souveraine, c'est documenté dans `outbox-policy.ts`) mais
  // il ne doit jamais être SILENCIEUX : tant qu'une telle règle est active, la
  // page le dit — en persistance, pas seulement au moment du clic.
  const naturesRetenues = reglesRetenantDesEnvoisReglementaires(reglages);

  // Historique : jour (Europe/Paris) → cartes, dans l'ordre déjà trié par la requête.
  const nbEnvoyes = traitesRecents.filter((e) => e.statut === "envoye").length;
  const nbRefuses = traitesRecents.length - nbEnvoyes;
  const parJour: { jour: string; items: typeof traitesRecents }[] = [];
  for (const e of traitesRecents) {
    const date = e.statut === "envoye" ? e.envoyeAt : e.refuseAt;
    const jour = date ? jourFr(date) : "Date inconnue";
    const groupe = parJour.find((g) => g.jour === jour);
    if (groupe) groupe.items.push(e);
    else parJour.push({ jour, items: [e] });
  }

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

      <div className="mb-[var(--space-admin-6)] grid gap-[var(--space-admin-4)] sm:grid-cols-3">
        <AdminStatCard
          label="À relire"
          value={enAttente.length}
          tone={enAttente.length > 0 ? "warning" : "success"}
          icon={enAttente.length > 0 ? Send : CheckCircle2}
        />
        <AdminStatCard
          label="Envoyés récemment"
          value={nbEnvoyes}
          tone="success"
          icon={CheckCircle2}
        />
        <AdminStatCard
          label="Refusés récemment"
          value={nbRefuses}
          tone={nbRefuses > 0 ? "destructive" : "default"}
          icon={XCircle}
        />
      </div>

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
          <AdminEmptyState
            icon={<CheckCircle2 size={24} />}
            title="Rien à relire"
            description="Aucun email en attente. Les relances d'impayé, devis et factures apparaîtront ici avant leur envoi."
            className="min-h-[12rem] justify-center"
          />
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
                  motifSansObjet={
                    e.template === TEMPLATE_RELANCE_DEVIS &&
                    e.entityType === ENTITE_DEVIS &&
                    e.entityId !== null
                      ? (motifsSansObjet.get(e.entityId) ?? null)
                      : null
                  }
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
          <div className="flex flex-col gap-[var(--space-admin-6)]">
            {parJour.map((g) => (
              <section key={g.jour} className="flex flex-col gap-[var(--space-admin-4)]">
                <h3 className="m-0 text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
                  {g.jour}
                </h3>
                <ul className="m-0 flex list-none flex-col gap-[var(--space-admin-4)] p-0">
                  {g.items.map((e) => {
                    const envoye = e.statut === "envoye";
                    const date = envoye ? e.envoyeAt : e.refuseAt;
                    const numero = NUMERO_DEVIS.exec(e.sujet)?.[0];
                    return (
                      <li
                        key={e.id}
                        data-statut={e.statut}
                        className={`flex flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-l-4 border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)] ${
                          envoye
                            ? "border-l-[color:var(--color-admin-success)]"
                            : "border-l-[color:var(--color-admin-destructive)]"
                        }`}
                      >
                        <div className="flex flex-wrap items-start gap-[var(--space-admin-4)]">
                          <AdminBadge
                            tone={envoye ? "success" : "destructive"}
                            plein
                            compact={false}
                          >
                            {envoye ? (
                              <Send aria-hidden="true" size={16} className="mr-1 inline" />
                            ) : (
                              <XCircle aria-hidden="true" size={16} className="mr-1 inline" />
                            )}
                            {envoye ? "Envoyé" : "Refusé"}
                          </AdminBadge>
                          <div className="min-w-0 flex-1">
                            <p className="m-0 text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
                              {e.sujet}
                              {numero ? (
                                <>
                                  {" "}
                                  <AdminBadge tone="neutral">{numero}</AdminBadge>
                                </>
                              ) : null}
                            </p>
                            <p className="m-0 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                              {e.recipient}
                            </p>
                          </div>
                          <span className="text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg-soft)] tabular-nums">
                            {date ? heureFr(date) : "—"}
                          </span>
                        </div>
                        {!envoye && e.refuseMotif ? (
                          <p
                            data-motif
                            className="m-0 rounded-[var(--radius-admin-md)] border-l-4 border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-warning-soft)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-base)] text-[color:var(--color-admin-warning-fg)]"
                          >
                            <span className="font-bold">Motif :</span> {e.refuseMotif}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </AdminBloc>
      )}

      <AdminBloc teinte="bleu" niveau={2} titre="Règles d'envoi">
        <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Par défaut, relecture requise pour :
        </p>
        <p className="mb-[var(--space-admin-4)] flex flex-wrap gap-[var(--space-admin-2)]">
          {EMAILS_A_VALIDER_PAR_DEFAUT.map((t) => (
            <AdminBadge key={t} tone="warning" plein>
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
