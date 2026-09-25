// Fiche d'un abonné à la lettre (lot L3, 2026-09-24).
//
// Il n'existait aucune fiche : rien pour voir l'histoire d'une personne —
// preuves de consentement, e-mails du guide, synchronisation CRM. Et c'est
// d'ICI que part « Envoyer le guide » : un envoi ponctuel à un inscrit passe
// par ce bouton, pas par un script. Le bouton n'est affiché que si le geste
// l'accepterait (`refusConsole`) ; sinon, la fiche dit pourquoi.
//
// Lecture : `server/newsletter/console.ts`. Gestes : Server Actions de
// `features/admin-newsletter/actions.ts`, chacun sur son chemin public.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminPageHeader,
  AdminPageShell,
} from "@/components/admin/ui";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { libelleSource, lireFicheAbonne, type BaseInscription } from "@/server/newsletter/console";
import { LIBELLE_REFUS_CONSOLE } from "@/server/guide-ia/refus-console";
import { SubscriberRowActions } from "../_v2/SubscriberRowActions";
import { EnvoyerGuideBouton } from "../_v2/EnvoyerGuideBouton";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string; id: string }>;
}

const STATUT: Record<string, { libelle: string; ton: "success" | "warning" | "neutral" }> = {
  confirmed: { libelle: "Abonné", ton: "success" },
  pending: { libelle: "En attente (ancien double opt-in)", ton: "warning" },
  unsubscribed: { libelle: "Désabonné", ton: "neutral" },
  bounced: { libelle: "Rejeté (rebond définitif)", ton: "neutral" },
};

const ACTION_PREUVE: Record<string, string> = {
  optin: "Consentement donné",
  optout: "Retrait",
  information: "Information (intérêt légitime)",
};

const BASE: Record<BaseInscription, string> = {
  "interet-legitime": "Intérêt légitime (adresse professionnelle, information donnée)",
  consentement: "Consentement (case cochée)",
  "non-etablie": "Non établie",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dateHeure(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(d);
}

function Ligne({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-[var(--space-admin-4)] py-[var(--space-admin-2)]">
      <dt className="w-56 shrink-0 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
        {libelle}
      </dt>
      <dd className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
        {children}
      </dd>
    </div>
  );
}

export default async function FicheAbonnePage({ params }: PageProps) {
  const { adminPrefix, id } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);
  if (!UUID.test(id)) notFound();

  const fiche = await lireFicheAbonne(id);
  if (!fiche) notFound();
  const { abonne, demandeGuide, preuves, envois, synchroCrm, base: baseInscription } = fiche;
  // Pourquoi le guide ne peut pas partir d'ici — la phrase même du refus.
  const refus =
    fiche.refusEnvoi === null
      ? undefined
      : fiche.refusEnvoi === "introuvable"
        ? "Introuvable : la fiche a peut-être été effacée."
        : LIBELLE_REFUS_CONSOLE[fiche.refusEnvoi];
  const base = `/fr/${adminPrefix}`;
  const statut = STATUT[abonne.status] ?? { libelle: abonne.status, ton: "neutral" as const };

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={abonne.email}
        description="Fiche abonné à la lettre"
        actions={
          <Link href={`${base}/newsletter`} className="admin-button-ghost">
            ← Tous les abonnés
          </Link>
        }
      />

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Lettre
        </h2>
        <dl>
          <Ligne libelle="Statut">
            <AdminBadge tone={statut.ton}>{statut.libelle}</AdminBadge>
          </Ligne>
          <Ligne libelle="Langue">{abonne.locale.toUpperCase()}</Ligne>
          <Ligne libelle="Provenance">{libelleSource(abonne.source)}</Ligne>
          <Ligne libelle="Inscrit le">{dateHeure(abonne.createdAt)}</Ligne>
          <Ligne libelle="Inscrit à la lettre le">{dateHeure(abonne.confirmedAt)}</Ligne>
          <Ligne libelle="Désabonné le">{dateHeure(abonne.unsubscribedAt)}</Ligne>
          {/* Lue sur la DERNIÈRE preuve de la lettre : un retrait la rend « non établie ». */}
          <Ligne libelle="Base">{BASE[baseInscription]}</Ligne>
          <Ligne libelle="Texte présenté (référence)">{abonne.consentFormRef ?? "—"}</Ligne>
          <Ligne libelle="Version du texte">
            {abonne.consentVersion ?? "— (inscription antérieure)"}
          </Ligne>
          <Ligne libelle="Rebonds temporaires">
            {abonne.softBounceCount === 0
              ? "Aucun"
              : `${abonne.softBounceCount} (dernier : ${dateHeure(abonne.lastSoftBounceAt)})`}
          </Ligne>
          <Ligne libelle="Adresse IP">
            {abonne.ipHashPresent ? "Empreinte conservée (jamais l'adresse)" : "Aucune"}
          </Ligne>
        </dl>
        <div className="mt-[var(--space-admin-4)]">
          <SubscriberRowActions id={abonne.id} status={abonne.status} />
        </div>
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Guide IA entreprise
        </h2>
        {demandeGuide ? (
          <dl className="mb-[var(--space-admin-4)]">
            <Ligne libelle="Demande">
              {demandeGuide.origine === "admin" ? "Envoi depuis la console" : "Formulaire du site"}
              {" · "}
              {libelleSource(demandeGuide.source)} · {dateHeure(demandeGuide.createdAt)}
            </Ligne>
            <Ligne libelle="Premier envoi">{dateHeure(demandeGuide.sentAt)}</Ligne>
            <Ligne libelle="Envois">{demandeGuide.sendCount}</Ligne>
            <Ligne libelle="Lien ouvert (peut-être un antivirus)">
              {dateHeure(demandeGuide.firstSeenAt)}
            </Ligne>
            <Ligne libelle="Guide téléchargé (clic)">{dateHeure(demandeGuide.firstClickAt)}</Ligne>
            <Ligne libelle="Transmis au CRM">
              {demandeGuide.crmEmittedAt ? dateHeure(demandeGuide.crmEmittedAt) : "Pas encore"}
            </Ligne>
          </dl>
        ) : (
          <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Cette personne n&apos;a jamais reçu le guide.
          </p>
        )}
        {demandeGuide?.sentAt ? (
          <>
            {refus === undefined ? (
              <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Déjà envoyé. Un nouvel envoi est un « Renvoyer » : il compte dans la limite de 3
                envois par 24 h à cette adresse.
              </p>
            ) : null}
            <EnvoyerGuideBouton
              id={demandeGuide.id}
              mode="renvoyer"
              {...(refus !== undefined ? { refus } : {})}
            />
          </>
        ) : (
          <EnvoyerGuideBouton
            id={abonne.id}
            mode="envoyer"
            {...(refus !== undefined ? { refus } : {})}
          />
        )}
      </AdminCard>

      <AdminCard className="mb-[var(--space-admin-5)]">
        <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
          Registre de preuve
        </h2>
        {preuves.length === 0 ? (
          <AdminEmptyState title="Aucune preuve enregistrée pour la lettre." />
        ) : (
          <ul className="flex flex-col gap-[var(--space-admin-2)]">
            {preuves.map((p) => (
              <li key={p.id} className="text-[length:var(--text-admin-sm)]">
                <strong>{ACTION_PREUVE[p.action] ?? p.action}</strong> · {dateHeure(p.occurredAt)} ·{" "}
                <span className="text-[color:var(--color-admin-fg-muted)]">
                  {p.formRef} / {p.consentVersion}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <div className="grid grid-cols-1 gap-[var(--space-admin-5)] lg:grid-cols-2">
        <AdminCard>
          <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
            E-mails du guide
          </h2>
          {envois.length === 0 ? (
            <AdminEmptyState title="Aucun e-mail du guide." />
          ) : (
            <ul className="flex flex-col gap-[var(--space-admin-2)]">
              {envois.map((e) => (
                <li key={e.id} className="text-[length:var(--text-admin-sm)]">
                  {formatDateFrShort(e.createdAt)} · {e.status}
                  {e.bounceType
                    ? ` (rebond ${e.bounceType === "hard" ? "définitif" : "temporaire"})`
                    : ""}
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
        <AdminCard>
          <h2 className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-lg)] font-semibold text-[color:var(--color-admin-fg)]">
            Synchronisation CRM
          </h2>
          {synchroCrm.length === 0 ? (
            <AdminEmptyState title="Aucun événement de la lettre transmis au CRM." />
          ) : (
            <ul className="flex flex-col gap-[var(--space-admin-2)]">
              {synchroCrm.map((c) => (
                <li key={c.id} className="text-[length:var(--text-admin-sm)]">
                  {c.eventType} · {c.status} · {formatDateFrShort(c.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminPageShell>
  );
}
