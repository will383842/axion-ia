/**
 * Emplacement du lot B7 : seul ce lot modifie ce fichier.
 * Lot 0 (socle) : le bloc « Devis et factures » de la fiche client, DÉPLACÉ tel quel de la page.
 * Les lectures restent faites par la page et arrivent en props.
 */

import Link from "next/link";
import { Euro, CalendarDays, Users, Wallet } from "lucide-react";

import { FactureHorsConsole } from "@/components/admin/dossier-client/FactureHorsConsole";
import { AdminBloc } from "@/components/admin/ui/AdminBloc";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { BandeauAttributionPartners } from "@/components/admin/qualiopi/BandeauAttributionPartners";
import { resteDuNetCents, type Client360 } from "@/server/qualiopi/crm/clients";
import type { bandeauPourLeRole } from "@/server/partners/client-attributions";
import { formatDateFrShort } from "@/lib/format-date-fr";
import { dayKeyInParis } from "@/lib/calendar-grid";
import type { ContexteFiche } from "./contexte";
import { RelanceDevis } from "./RelanceDevis";

type BadgeTone = "neutral" | "info" | "success" | "warning" | "destructive";

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

const sectionCls = "mb-[var(--space-admin-8)]";
const listeCls = "space-y-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const ligneCls = "flex flex-wrap items-center gap-[var(--space-admin-3)]";
const ligneMutedCls = "text-[color:var(--color-admin-fg-muted)]";
const lienMonoCls =
  "font-mono text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline";

export function OngletDevisFactures({
  ctx,
  client,
  encoursDuCents,
  factures,
  factureHorsConsoleLe,
  bandeauPartners,
  nbEmailsAValider,
}: {
  ctx: ContexteFiche;
  client: Client360;
  encoursDuCents: number;
  factures: Client360["facturesFormation"];
  factureHorsConsoleLe: Date | null;
  bandeauPartners: Awaited<ReturnType<typeof bandeauPourLeRole>>;
  nbEmailsAValider: number;
}): React.ReactElement {
  const qBase = ctx.qBase;
  return (
    <>
      {ctx.voitEchanges ? (
        <FactureHorsConsole
          clientId={client.id}
          etabliLe={factureHorsConsoleLe}
          peutEcrire={ctx.peutEcrire}
          aujourdhui={dayKeyInParis(ctx.maintenant)}
          message={ctx.message}
          erreur={null /* l'erreur s'affiche déjà en tête de l'onglet */}
        />
      ) : null}
      {encoursDuCents > 0 ? (
        <AdminBloc teinte="ambre" haut titre="Encours à encaisser">
          <p className="text-[length:var(--text-admin-sm)]">
            {eur(encoursDuCents)} restent dus sur les factures ouvertes de ce client.
          </p>
        </AdminBloc>
      ) : null}

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
        <BandeauAttributionPartners texte={bandeauPartners} />
        {/* EMPLACEMENT:RELANCE-DEVIS (lot B9) */}
        {ctx.voitEchanges ? <RelanceDevis ctx={ctx} devis={client.devis} /> : null}
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
          <AdminBloc teinte="terracotta" niveau={3} haut titre="E-mails à valider">
            <p className="text-[length:var(--text-admin-sm)]">
              <span className="font-semibold tabular-nums">{nbEmailsAValider}</span> e-mail
              {nbEmailsAValider > 1 ? "s" : ""} en attente de validation —{" "}
              <Link
                href={`${qBase}/emails`}
                className="font-semibold text-[color:var(--bloc-title)] underline underline-offset-2"
              >
                valider dans la boîte d&apos;envoi
              </Link>
              .
            </p>
          </AdminBloc>
        )}
      </section>
    </>
  );
}
