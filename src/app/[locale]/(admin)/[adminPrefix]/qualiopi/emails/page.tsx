/**
 * Admin — Qualiopi · Corbeille de validation des emails (F60).
 *
 * Les emails commerciaux (relance d'impayé, devis, facture, contrat) attendent
 * ici une relecture avant de partir. La chaîne Qualiopi — convocation, rappel
 * J-7, satisfaction J+1, suivi J+30, attestation — n'y passe PAS : la retenir
 * exposerait un stagiaire à ne jamais recevoir sa convocation, et les
 * indicateurs 4, 9, 11, 30 et 32 en dépendent.
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
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
  libelleTemplateEmail,
  reglesRetenantDesEnvoisReglementaires,
} from "@/server/email/outbox-policy";

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
  title: "Qualiopi — E-mails à valider | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const dateFr = (d: Date): string =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Résumé lisible de la charge utile, pour que l'admin voie ce qui part sans
 * avoir à rendre le HTML complet.
 *
 * On liste des couples label/valeur plutôt que le JSON brut : un admin ne doit
 * pas avoir à décoder une structure technique pour décider d'un envoi.
 */
function construireApercu(payload: unknown): Array<{ label: string; valeur: string }> {
  if (payload === null || typeof payload !== "object") return [];
  const LIBELLES: Record<string, string> = {
    destinataireNom: "Destinataire",
    numeroFacture: "Facture",
    montantDu: "Montant dû",
    dateEcheance: "Échéance",
    joursRetard: "Jours de retard",
    soldePartiel: "Solde après versement partiel",
    titreFormation: "Formation",
    numeroSession: "Session",
  };
  const out: Array<{ label: string; valeur: string }> = [];
  for (const [cle, libelle] of Object.entries(LIBELLES)) {
    const v = (payload as Record<string, unknown>)[cle];
    if (v === undefined || v === null || v === "") continue;
    out.push({ label: libelle, valeur: typeof v === "boolean" ? (v ? "oui" : "non") : String(v) });
  }
  return out;
}

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

  const carte =
    "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)]";

  // S5 (2026-08-26) — le gel réglementaire par règle NOMMÉE reste permis (la
  // règle nommée est souveraine, c'est documenté dans `outbox-policy.ts`) mais
  // il ne doit jamais être SILENCIEUX : tant qu'une telle règle est active, la
  // page le dit — en persistance, pas seulement au moment du clic.
  const naturesRetenues = reglesRetenantDesEnvoisReglementaires(reglages);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="E-mails à valider"
        description="Les emails commerciaux attendent votre relecture avant de partir. La chaîne Qualiopi — convocation, rappel, questionnaires, attestation — part automatiquement et n'apparaît pas ici."
      />

      {naturesRetenues.length > 0 && (
        <p
          role="alert"
          className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-warning)] bg-[color:var(--color-admin-surface)] p-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]"
        >
          <span className="font-semibold">
            Cette règle retient des envois réglementaires (convocations, attestations…) : ils
            partiront seulement après validation manuelle.
          </span>{" "}
          Natures concernées : {naturesRetenues.map((t) => libelleTemplateEmail(t)).join(", ")}.
          Retirez la règle correspondante ci-dessous pour rétablir l&apos;envoi automatique.
        </p>
      )}

      <section className="mb-[var(--space-admin-8)]">
        <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          En attente ({enAttente.length})
        </h2>

        {enAttente.length === 0 ? (
          <p
            className={`${carte} text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]`}
          >
            Aucun email en attente. Les relances d&apos;impayé, devis et factures apparaîtront ici
            avant leur envoi.
          </p>
        ) : (
          <div className="flex flex-col gap-[var(--space-admin-4)]">
            {enAttente.map((e) => (
              <EmailOutboxItem
                key={e.id}
                id={e.id}
                template={e.template}
                destinataire={e.recipient}
                sujet={e.sujet}
                clientNom={e.client?.raisonSociale ?? null}
                creeLe={dateFr(e.createdAt)}
                apercu={construireApercu(e.payload)}
                nbPiecesJointes={Array.isArray(e.attachments) ? e.attachments.length : 0}
                approuverAction={approuverEmailAction}
                refuserAction={refuserEmailAction}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mb-[var(--space-admin-8)]">
        <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
          Règles d&apos;envoi
        </h2>
        <div className={carte}>
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Par défaut, ces natures d&apos;email passent par la validation :{" "}
            <span>
              {EMAILS_A_VALIDER_PAR_DEFAUT.map((t) => libelleTemplateEmail(t)).join(", ")}
            </span>
            . Une règle plus précise l&apos;emporte sur une règle plus générale — un réglage par
            client prime sur le réglage global.
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
        </div>
      </section>

      {traitesRecents.length > 0 && (
        <section>
          <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
            Traités récemment
          </h2>
          <ul className={`${carte} flex flex-col gap-[var(--space-admin-2)]`}>
            {traitesRecents.map((e) => (
              <li key={e.id} className="text-[length:var(--text-admin-sm)]">
                <span
                  className={
                    e.statut === "envoye"
                      ? "text-[color:var(--color-admin-success)]"
                      : "text-[color:var(--color-admin-fg-muted)]"
                  }
                >
                  {e.statut === "envoye" ? "Envoyé" : "Refusé"}
                </span>
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  {" "}
                  · {e.recipient} · {e.sujet}
                </span>
                {e.statut === "refuse" && e.refuseMotif ? (
                  <span className="block pl-[var(--space-admin-4)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] italic">
                    Motif : {e.refuseMotif}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </AdminPageShell>
  );
}
