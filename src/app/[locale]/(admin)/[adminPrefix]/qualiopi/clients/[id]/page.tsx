/**
 * Admin — Qualiopi · Fiche client 360°.
 *
 * 🔴 Cette vue manquait : la liste des clients pointait directement sur le
 * FORMULAIRE d'édition — pour savoir ce qu'on a vendu à un client (sessions,
 * devis, factures, encours), il fallait ouvrir six listes et filtrer de tête.
 * La fiche réunit tout : identité + contact, 4 KPI (dont l'encours dû réel),
 * puis les 10 dernières lignes de chaque relation.
 *
 * Liens vérifiés dans l'arborescence (2026-08-02) :
 * - fiches existantes : sessions/[id], audits/[id], devis/[id], facturation/[id]
 * - PAS de fiche contrat de coaching (seul coaching/seances/[id] existe, c'est
 *   une séance) → lignes en texte simple, sans lien.
 * - PAS de fiche dossier de financement (panel dans le hub facturation) →
 *   « Tout voir » renvoie au hub.
 * - PAS de registre DocumentGenere dédié → section sans « Tout voir ».
 * - Aucune liste ne supporte de filtre `?client=` → les « Tout voir » sont des
 *   liens simples vers la liste, pas des listes pré-filtrées.
 *
 * Server Component — auth + redirect, force-dynamic, noindex.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Euro, CalendarDays, Users, Wallet } from "lucide-react";

import { auth } from "@/auth";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import {
  getClient360,
  calculerEncoursDuCents,
  resteDuNetCents,
} from "@/server/qualiopi/crm/clients";
import { opcoLabel } from "@/server/qualiopi/financements/opco-referentiel";
import { formatDateFrShort } from "@/lib/format-date-fr";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Fiche client | Axion-IA Admin",
  robots: { index: false, follow: false },
};

// ─────────────────────────────────────────────────────────────────────────────
// Libellés + tonalités FR (convention console : maps locales par page)
// ─────────────────────────────────────────────────────────────────────────────

type BadgeTone = "neutral" | "info" | "success" | "warning" | "destructive";

const CLIENT_STATUT: Record<string, { label: string; tone: BadgeTone }> = {
  prospect: { label: "Prospect", tone: "neutral" },
  devis_envoye: { label: "Devis envoyé", tone: "warning" },
  client_actif: { label: "Client actif", tone: "success" },
  client_inactif: { label: "Client inactif", tone: "neutral" },
  perdu: { label: "Perdu", tone: "destructive" },
};

/** TrainingSessionStatut et AuditMissionStatut partagent les mêmes valeurs. */
const PRESTATION_STATUT: Record<string, { label: string; tone: BadgeTone }> = {
  planifiee: { label: "Planifiée", tone: "info" },
  en_cours: { label: "En cours", tone: "warning" },
  realisee: { label: "Réalisée", tone: "success" },
  annulee: { label: "Annulée", tone: "destructive" },
  reportee: { label: "Reportée", tone: "warning" },
};

const DEVIS_STATUT: Record<string, { label: string; tone: BadgeTone }> = {
  brouillon: { label: "Brouillon", tone: "neutral" },
  envoye: { label: "Envoyé", tone: "info" },
  accepte: { label: "Accepté", tone: "success" },
  refuse: { label: "Refusé", tone: "destructive" },
  expire: { label: "Expiré", tone: "destructive" },
  transforme_convention: { label: "Transformé en convention", tone: "success" },
};

const FACTURE_STATUT: Record<string, { label: string; tone: BadgeTone }> = {
  brouillon: { label: "Brouillon", tone: "neutral" },
  emise: { label: "Émise", tone: "info" },
  partiellement_payee: { label: "Partiellement payée", tone: "warning" },
  en_retard: { label: "En retard", tone: "destructive" },
  payee: { label: "Payée", tone: "success" },
  annulee: { label: "Annulée", tone: "neutral" },
};

const DOSSIER_STATUT: Record<string, { label: string; tone: BadgeTone }> = {
  a_monter: { label: "À monter", tone: "warning" },
  envoye: { label: "Envoyé", tone: "info" },
  accord_recu: { label: "Accord reçu", tone: "success" },
  refuse: { label: "Refusé", tone: "destructive" },
  facture: { label: "Facturé", tone: "info" },
  paiement_recu: { label: "Paiement reçu", tone: "success" },
  clos: { label: "Clos", tone: "neutral" },
};

const DOSSIER_TYPE: Record<string, string> = {
  opco: "OPCO",
  france_travail: "France Travail",
  cpf: "CPF",
  mixte: "Mixte",
};

/** Libellés des types de pièces — alignés sur DocumentsSection (fiche session). */
const DOC_LABELS: Record<string, string> = {
  cv_formateur: "Fiche formateur",
  convention: "Convention de formation",
  programme: "Programme de l'action",
  convention_tripartite: "Convention tripartite",
  contrat: "Contrat de formation",
  convocation: "Convocation",
  emargement: "Feuille d'émargement",
  releve_connexion: "Relevé de connexion",
  positionnement: "Questionnaire de positionnement",
  grille_evaluation: "Grille d'évaluation",
  satisfaction: "Questionnaire de satisfaction",
  attestation: "Attestation de réalisation",
  attestation_partielle: "Attestation partielle",
  certificat_realisation: "Certificat de réalisation",
  facture: "Facture",
  devis: "Devis",
  avoir: "Avoir",
  kit_opco: "Kit OPCO",
  kit_cpf: "Kit CPF / EDOF",
  kit_france_travail: "Kit France Travail",
  lettre_mission: "Lettre de mission formateur",
  reglement_interieur: "Règlement intérieur",
  livret_accueil: "Livret d'accueil stagiaire",
  protocole_afest: "Protocole individuel AFEST",
  inventaire_moyens: "Inventaire des moyens pédagogiques",
  contrat_sous_traitance: "Contrat de sous-traitance",
};

function eur(cents: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Briques locales (RSC pur)
// ─────────────────────────────────────────────────────────────────────────────

function StatutBadge({
  map,
  statut,
}: {
  map: Record<string, { label: string; tone: BadgeTone }>;
  statut: string;
}): React.ReactElement {
  const entry = map[statut];
  return (
    <AdminBadge tone={entry?.tone ?? "neutral"} dot>
      {entry?.label ?? statut.replace(/_/g, " ")}
    </AdminBadge>
  );
}

function SectionTitre({
  titre,
  toutVoirHref,
}: {
  titre: string;
  /** Lien vers la LISTE (non filtrée — aucun filtre client supporté). Optionnel. */
  toutVoirHref?: string;
}): React.ReactElement {
  return (
    <div className="mb-[var(--space-admin-3)] flex items-baseline justify-between gap-[var(--space-admin-4)]">
      <h2 className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]">
        {titre}
      </h2>
      {toutVoirHref ? (
        <Link
          href={toutVoirHref}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          Tout voir →
        </Link>
      ) : null}
    </div>
  );
}

function SectionVide({ message }: { message: string }): React.ReactElement {
  return (
    <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
      {message}
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function FicheClient360Page({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "admin" && role !== "super_admin")) {
    redirect(`/${locale}/${adminPrefix}/login`);
  }

  const client = await getClient360(id);
  if (!client) notFound();

  const qBase = `/${locale}/${adminPrefix}/qualiopi`;
  const clientsBase = `${qBase}/clients`;

  const encoursDuCents = calculerEncoursDuCents(client.facturesFormation);
  // La requête ramène TOUTES les factures (l'encours l'exige) ; l'affichage,
  // lui, s'aligne sur les autres sections : les 10 dernières.
  const factures = client.facturesFormation.slice(0, 10);

  const statutClient = CLIENT_STATUT[client.statut];
  const adresseStructuree = [
    client.adresseRue,
    [client.adresseCodePostal, client.adresseVille].filter(Boolean).join(" "),
  ]
    .filter((part) => part !== null && part !== undefined && part !== "")
    .join(", ");
  const adresse = adresseStructuree !== "" ? adresseStructuree : (client.adresse ?? null);
  const contactLigne = [client.contactNom, client.contactEmail, client.contactTelephone]
    .filter(Boolean)
    .join(" · ");
  const nbEmailsAValider = client._count.emailsEnAttente;

  const infoLabelCls =
    "text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase";
  const infoValueCls =
    "mt-0.5 text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-fg)]";
  const ligneCls = "flex flex-wrap items-center gap-[var(--space-admin-3)]";
  const ligneMutedCls = "text-[color:var(--color-admin-fg-muted)]";
  const lienMonoCls =
    "font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";
  const listeCls = "space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
  const sectionCls = "mb-[var(--space-admin-8)]";

  return (
    <AdminPageShell width="wide">
      <div className="mb-[var(--space-admin-4)]">
        <Link
          href={clientsBase}
          className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
        >
          ← Clients
        </Link>
      </div>

      <AdminPageHeader
        title={client.raisonSociale}
        meta={
          <>
            <AdminBadge tone="neutral">{client.numero}</AdminBadge>
            <AdminBadge tone="outline">
              {client.type === "particulier" ? "Particulier" : "Entreprise"}
            </AdminBadge>
            <AdminBadge tone={statutClient?.tone ?? "neutral"} dot>
              {statutClient?.label ?? client.statut}
            </AdminBadge>
          </>
        }
        actions={
          <AdminButton variant="secondary" href={`${clientsBase}/${client.id}/edit`}>
            Éditer
          </AdminButton>
        }
      />

      {/* ── Identité + contact ─────────────────────────────────────────────── */}
      <section className={sectionCls}>
        <div className="grid grid-cols-2 gap-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] sm:grid-cols-4">
          <div className="col-span-2">
            <p className={infoLabelCls}>Contact</p>
            <p className={infoValueCls}>{contactLigne !== "" ? contactLigne : "—"}</p>
            {client.contactFonction ? (
              <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {client.contactFonction}
              </p>
            ) : null}
          </div>
          <div>
            <p className={infoLabelCls}>SIRET</p>
            <p className={`${infoValueCls} font-mono`}>{client.siret ?? "—"}</p>
          </div>
          <div>
            <p className={infoLabelCls}>OPCO</p>
            <p className={infoValueCls}>
              {client.opcoIdentifie ? opcoLabel(client.opcoIdentifie) : "À déterminer"}
              {client.opcoNumeroAdherent ? ` · adh. ${client.opcoNumeroAdherent}` : ""}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <p className={infoLabelCls}>Adresse</p>
            <p className={infoValueCls}>{adresse ?? "—"}</p>
          </div>
        </div>
      </section>

      {/* ── KPI ────────────────────────────────────────────────────────────── */}
      <div className="mb-[var(--space-admin-8)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-4">
        <AdminStatCard label="CA cumulé" value={eur(client.caCents)} icon={Euro} />
        <AdminStatCard label="Sessions" value={client.nbSessions} icon={CalendarDays} />
        <AdminStatCard label="Stagiaires" value={client.nbStagiaires} icon={Users} />
        {/* Encours = restes dus nets des factures OUVERTES (avoirs déduits,
            encaissements `succeeded` soustraits) — pas un agrégat dénormalisé. */}
        <AdminStatCard
          label="Encours dû"
          value={eur(encoursDuCents)}
          tone={encoursDuCents > 0 ? "destructive" : "default"}
          icon={Wallet}
        />
      </div>

      {/* ── a. Sessions de formation ───────────────────────────────────────── */}
      <section className={sectionCls}>
        <SectionTitre titre="Sessions de formation" toutVoirHref={`${qBase}/sessions`} />
        {client.sessions.length === 0 ? (
          <SectionVide message="Aucune session de formation." />
        ) : (
          <ul className={listeCls}>
            {client.sessions.map((s) => (
              <li key={s.id} className={ligneCls}>
                <Link href={`${qBase}/sessions/${s.id}`} className={lienMonoCls}>
                  {s.numero}
                </Link>
                <span className="font-medium">{s.titreSession}</span>
                <span className={ligneMutedCls}>
                  {formatDateFrShort(s.dateDebut)} → {formatDateFrShort(s.dateFin)}
                </span>
                <StatutBadge map={PRESTATION_STATUT} statut={s.statut} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── b. Contrats de coaching (pas de fiche dédiée → texte simple) ───── */}
      <section className={sectionCls}>
        <SectionTitre titre="Contrats de coaching" />
        {client.coachingContracts.length === 0 ? (
          <SectionVide message="Aucun contrat de coaching." />
        ) : (
          <ul className={listeCls}>
            {client.coachingContracts.map((c) => (
              <li key={c.id} className={ligneCls}>
                <span className="font-mono text-[length:var(--text-admin-xs)]">{c.numero}</span>
                <span className="tabular-nums">{eur(c.montantHtCents)} HT</span>
                <span className={ligneMutedCls}>
                  {c.interventionSlug}
                  {c.dateSigneeAt
                    ? ` · signé le ${formatDateFrShort(c.dateSigneeAt)}`
                    : " · non signé"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── c. Missions d'audit ────────────────────────────────────────────── */}
      <section className={sectionCls}>
        <SectionTitre titre="Missions d'audit" toutVoirHref={`${qBase}/audits`} />
        {client.auditMissions.length === 0 ? (
          <SectionVide message="Aucune mission d'audit." />
        ) : (
          <ul className={listeCls}>
            {client.auditMissions.map((m) => (
              <li key={m.id} className={ligneCls}>
                <Link href={`${qBase}/audits/${m.id}`} className={lienMonoCls}>
                  {m.numero}
                </Link>
                <span className="font-medium">{m.titre}</span>
                <span className={ligneMutedCls}>
                  {formatDateFrShort(m.dateDebut)} → {formatDateFrShort(m.dateFin)}
                </span>
                <StatutBadge map={PRESTATION_STATUT} statut={m.statut} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── d. Devis ───────────────────────────────────────────────────────── */}
      <section className={sectionCls}>
        <SectionTitre titre="Devis" toutVoirHref={`${qBase}/devis`} />
        {client.devis.length === 0 ? (
          <SectionVide message="Aucun devis." />
        ) : (
          <ul className={listeCls}>
            {client.devis.map((d) => (
              <li key={d.id} className={ligneCls}>
                <Link href={`${qBase}/devis/${d.id}`} className={lienMonoCls}>
                  {d.numero}
                </Link>
                <span className="tabular-nums">{eur(d.montantTotalHtCents)} HT</span>
                <span className={ligneMutedCls}>{formatDateFrShort(d.createdAt)}</span>
                <StatutBadge map={DEVIS_STATUT} statut={d.statut} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── e. Factures ────────────────────────────────────────────────────── */}
      <section className={sectionCls}>
        <SectionTitre titre="Factures" toutVoirHref={`${qBase}/facturation`} />
        {factures.length === 0 ? (
          <SectionVide message="Aucune facture." />
        ) : (
          <ul className={listeCls}>
            {factures.map((f) => {
              const reste = resteDuNetCents(f);
              const estAvoir = f.avoirDeId !== null;
              return (
                <li key={f.id} className={ligneCls}>
                  <Link href={`${qBase}/facturation/${f.id}`} className={lienMonoCls}>
                    {f.numero}
                  </Link>
                  {estAvoir ? <AdminBadge tone="outline">Avoir</AdminBadge> : null}
                  <span className="tabular-nums">{eur(f.montantTtcCents ?? f.montantHtCents)}</span>
                  <span className={ligneMutedCls}>
                    {formatDateFrShort(f.emiseAt ?? f.createdAt)}
                  </span>
                  <StatutBadge map={FACTURE_STATUT} statut={f.statut} />
                  {!estAvoir && reste > 0 && f.statut !== "brouillon" && f.statut !== "annulee" ? (
                    <span className="text-[color:var(--color-admin-warning)] tabular-nums">
                      reste dû {eur(reste)}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── f. Documents générés (pas de registre dédié → pas de « Tout voir ») */}
      <section className={sectionCls}>
        <SectionTitre titre="Documents générés" />
        {client.documents.length === 0 ? (
          <SectionVide message="Aucun document généré." />
        ) : (
          <ul className={listeCls}>
            {client.documents.map((doc) => (
              <li key={doc.id} className={ligneCls}>
                <span className="font-medium">
                  {DOC_LABELS[doc.type] ?? doc.type.replace(/_/g, " ")}
                </span>
                <span className="font-mono text-[length:var(--text-admin-xs)]">{doc.numero}</span>
                <span className={ligneMutedCls}>{formatDateFrShort(doc.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── g. Dossiers de financement (panel dans le hub facturation) ─────── */}
      <section className={sectionCls}>
        <SectionTitre titre="Dossiers de financement" toutVoirHref={`${qBase}/facturation`} />
        {client.dossiersFinancement.length === 0 ? (
          <SectionVide message="Aucun dossier de financement." />
        ) : (
          <ul className={listeCls}>
            {client.dossiersFinancement.map((d) => (
              <li key={d.id} className={ligneCls}>
                <span className="font-medium">{DOSSIER_TYPE[d.type] ?? d.type}</span>
                <span className={ligneMutedCls}>
                  {d.financeurNom ?? "Financeur à préciser"}
                  {d.echeanceFinanceurAt
                    ? ` · échéance ${formatDateFrShort(d.echeanceFinanceurAt)}`
                    : ""}
                </span>
                <StatutBadge map={DOSSIER_STATUT} statut={d.statut} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── h. E-mails en attente de validation ────────────────────────────── */}
      <section>
        <SectionTitre titre="E-mails en attente" toutVoirHref={`${qBase}/emails`} />
        {nbEmailsAValider === 0 ? (
          <SectionVide message="Aucun e-mail en attente de validation." />
        ) : (
          <p className="text-[length:var(--text-admin-sm)]">
            <span className="font-semibold tabular-nums">{nbEmailsAValider}</span> e-mail
            {nbEmailsAValider > 1 ? "s" : ""} en attente de validation —{" "}
            <Link
              href={`${qBase}/emails`}
              className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
            >
              valider dans la boîte d&apos;envoi
            </Link>
            .
          </p>
        )}
      </section>
    </AdminPageShell>
  );
}
