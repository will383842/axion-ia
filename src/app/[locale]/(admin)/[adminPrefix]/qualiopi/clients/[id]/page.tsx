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
 *
 * ## Dossier client (chantier visio, PR 3) — cinq onglets
 *
 * « Pièces et facturation » (tout ce qui précède, inchangé) reste ouvert à tous
 * les rôles de la console : `gardePage("consultation")` reste EN TÊTE.
 *
 * Synthèse, Projets, Échanges et Personnes portent ce que le client a DIT en
 * rendez-vous. Régime FILTRE de la décision A2 : hors `ROLES_DOSSIER_ECHANGES`
 * (Will et les administrateurs), ils ne sont NI RENDUS NI REQUÊTÉS — la lecture
 * `features/dossier-client/queries` n'est appelée qu'après
 * `peutVoirLesEchanges(acces.role)` — et un message NOMME la raison.
 * Garde : `./__tests__/un-lecteur-ne-voit-ni-synthese-ni-echanges.spec.tsx`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Euro, CalendarDays, Users, Wallet } from "lucide-react";

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
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminFilterTabs } from "@/components/admin/ui/AdminFilterTabs";
import { gardePage } from "@/server/auth/garde-page";
import {
  OngletEchanges,
  OngletPersonnes,
  OngletProjets,
  OngletSynthese,
} from "@/components/admin/dossier-client/Onglets";
import { motifSansAccesAuxEchanges, peutVoirLesEchanges } from "@/features/dossier-client/acces";
import { consoliderFaits } from "@/features/dossier-client/consolider-faits";
import { confirmerSirenFormAction } from "@/features/dossier-client/actions";
import {
  rechercherSiren,
  type ResultatAnnuaire,
} from "@/features/dossier-client/recherche-entreprises";
import {
  lireFaitsARanger,
  lireFaitsDuClient,
  lirePersonnesDuClient,
  lireProjetsDuClient,
  lireRencontresDuClient,
} from "@/features/dossier-client/queries";

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
  searchParams?: Promise<{ onglet?: string; erreur?: string; annuaire?: string }>;
}

const ONGLETS_DOSSIER = ["synthese", "projets", "echanges", "personnes"] as const;
type Onglet = (typeof ONGLETS_DOSSIER)[number] | "facturation";

const LIBELLE_ONGLET: Readonly<Record<Onglet, string>> = {
  synthese: "Synthèse",
  projets: "Projets",
  echanges: "Échanges",
  personnes: "Personnes",
  facturation: "Pièces et facturation",
};

/** L'onglet demandé, ramené à ce que le rôle peut voir. */
function ongletAffiche(demande: string | undefined, voitEchanges: boolean): Onglet {
  if (!voitEchanges) return "facturation";
  if (demande === "facturation") return "facturation";
  return (ONGLETS_DOSSIER as ReadonlyArray<string>).includes(demande ?? "")
    ? (demande as Onglet)
    : "synthese";
}

export default async function FicheClient360Page({ params, searchParams }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  const sp = (await searchParams) ?? {};

  const client = await getClient360(id);
  if (!client) notFound();

  const qBase = `/${locale}/${adminPrefix}/qualiopi`;
  const clientsBase = `${qBase}/clients`;
  const ficheHref = `${clientsBase}/${client.id}`;

  // ── Dossier client : régime FILTRE (décision A2) ─────────────────────────
  // 🔴 La vérification du rôle PRÉCÈDE toute lecture du dossier : hors de la
  // liste, aucune requête n'est faite (pas seulement aucun rendu).
  const voitEchanges = peutVoirLesEchanges(acces.role);
  const onglet = ongletAffiche(sp.onglet, voitEchanges);
  const erreur = typeof sp.erreur === "string" && sp.erreur !== "" ? sp.erreur.slice(0, 300) : null;
  const maintenant = new Date();

  // « SIREN à compléter » : l'annuaire public n'est interrogé que sur demande
  // (lien « Chercher le SIREN »), côté serveur, 3 s au plus. Aucun JavaScript
  // dans le navigateur : la console est au bord de son cliquet de poids.
  const sirenACompleter = client.type === "entreprise" && !client.siren;
  const annuaire: ResultatAnnuaire | null =
    sirenACompleter && acces.peutEcrire && sp.annuaire === "1"
      ? await rechercherSiren(client.raisonSociale, client.adresseVille ?? null)
      : null;
  const ongletCourant = typeof sp.onglet === "string" ? sp.onglet : "";

  let contenuDossier: React.ReactNode = null;
  if (voitEchanges && onglet === "synthese") {
    const [faits, projets] = await Promise.all([lireFaitsDuClient(id), lireProjetsDuClient(id)]);
    contenuDossier = (
      <OngletSynthese
        consolidation={consoliderFaits(faits, projets, maintenant)}
        projets={projets}
        ficheHref={ficheHref}
      />
    );
  } else if (voitEchanges && onglet === "projets") {
    const [projets, faitsARanger] = await Promise.all([
      lireProjetsDuClient(id),
      lireFaitsARanger(id),
    ]);
    contenuDossier = (
      <OngletProjets
        clientId={id}
        projets={projets}
        faitsARanger={faitsARanger}
        ficheHref={ficheHref}
        qBase={qBase}
        erreur={erreur}
      />
    );
  } else if (voitEchanges && onglet === "echanges") {
    const [rencontres, projets] = await Promise.all([
      lireRencontresDuClient(id),
      lireProjetsDuClient(id),
    ]);
    contenuDossier = (
      <OngletEchanges
        rencontres={rencontres}
        projets={projets}
        rendezVousBase={`/${locale}/${adminPrefix}/rendez-vous`}
        maintenant={maintenant}
      />
    );
  } else if (voitEchanges && onglet === "personnes") {
    const [personnes, projets] = await Promise.all([
      lirePersonnesDuClient(id),
      lireProjetsDuClient(id),
    ]);
    contenuDossier = (
      <OngletPersonnes clientId={id} personnes={personnes} projets={projets} erreur={erreur} />
    );
  }

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
          <>
            {/* Le wizard pré-sélectionne le client (?clientId=) : le parcours
                de vente démarre depuis la fiche, sans re-chercher le client. */}
            <AdminButton href={`${qBase}/vente/new?clientId=${client.id}`}>
              Nouvelle vente
            </AdminButton>
            <AdminButton variant="secondary" href={`${clientsBase}/${client.id}/edit`}>
              Éditer
            </AdminButton>
          </>
        }
      />

      {/* ── Onglets du dossier client (A2 : administrateurs seulement) ─────── */}
      {voitEchanges ? (
        <AdminFilterTabs
          className="mb-[var(--space-admin-6)]"
          current={onglet}
          options={([...ONGLETS_DOSSIER, "facturation"] as const).map((o) => ({
            value: o,
            label: LIBELLE_ONGLET[o],
            href: `${ficheHref}?onglet=${o}`,
          }))}
        />
      ) : (
        <p className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          {motifSansAccesAuxEchanges(acces.role)}
        </p>
      )}

      {erreur !== null && onglet === "facturation" ? (
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-error)]">
          {erreur}
        </p>
      ) : null}

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
            {client.type === "entreprise" ? (
              client.siren ? (
                <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  SIREN <span className="font-mono">{client.siren}</span>
                </p>
              ) : (
                <div className="mt-[var(--space-admin-1)] flex flex-col gap-[var(--space-admin-1)]">
                  <AdminBadge tone="warning" className="self-start">
                    SIREN à compléter
                  </AdminBadge>
                  {acces.peutEcrire && annuaire === null ? (
                    <Link
                      href={`${ficheHref}?${ongletCourant ? `onglet=${ongletCourant}&` : ""}annuaire=1`}
                      className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
                    >
                      Chercher le SIREN dans l&apos;annuaire
                    </Link>
                  ) : null}
                  {annuaire !== null && !annuaire.ok ? (
                    <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                      L&apos;annuaire des entreprises ne répond pas pour l&apos;instant. Saisissez
                      le SIREN dans « Éditer », ou réessayez plus tard.
                    </p>
                  ) : null}
                  {annuaire !== null && annuaire.ok && annuaire.propositions.length === 0 ? (
                    <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-soft)]">
                      Aucune entreprise trouvée à ce nom.
                    </p>
                  ) : null}
                  {annuaire !== null && annuaire.ok && annuaire.propositions.length > 0 ? (
                    <ul className="space-y-[var(--space-admin-1)] text-[length:var(--text-admin-xs)]">
                      {annuaire.propositions.map((prop) => (
                        <li key={prop.siren}>
                          <form
                            action={confirmerSirenFormAction}
                            className="flex flex-wrap items-center gap-[var(--space-admin-2)]"
                          >
                            <input type="hidden" name="clientId" value={client.id} />
                            <input type="hidden" name="siren" value={prop.siren} />
                            <span className="font-mono">{prop.siren}</span>
                            <span>{prop.nom}</span>
                            <span className="text-[color:var(--color-admin-fg-muted)]">
                              {[prop.codePostal, prop.ville].filter(Boolean).join(" ")}
                            </span>
                            <button type="submit" className="admin-button-ghost">
                              C&apos;est elle
                            </button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )
            ) : null}
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
          {/* Pénalités de retard : APPLICATION opt-in, désactivée par défaut.
              Affiché sur la fiche parce que c'est une décision commerciale qu'on
              doit pouvoir constater sans ouvrir le formulaire d'édition.
              ⚠️ Ne dit RIEN des mentions légales, imprimées sans condition sur
              toute facture (art. L.441-9 / L.441-10 / D.441-5). */}
          <div className="col-span-2 sm:col-span-4">
            <p className={infoLabelCls}>Pénalités de retard</p>
            <p className={infoValueCls}>
              {client.penalitesRetardActives
                ? "Appliquées à ce client (chiffrées dans les relances)"
                : "Non appliquées (mentions légales imprimées sur les factures dans tous les cas)"}
            </p>
          </div>
        </div>
      </section>

      {contenuDossier}

      {onglet === "facturation" ? (
        <>
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
                      <span className="tabular-nums">
                        {eur(f.montantTtcCents ?? f.montantHtCents)}
                      </span>
                      <span className={ligneMutedCls}>
                        {formatDateFrShort(f.emiseAt ?? f.createdAt)}
                      </span>
                      <StatutBadge map={FACTURE_STATUT} statut={f.statut} />
                      {!estAvoir &&
                      reste > 0 &&
                      f.statut !== "brouillon" &&
                      f.statut !== "annulee" ? (
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
                    <span className="font-mono text-[length:var(--text-admin-xs)]">
                      {doc.numero}
                    </span>
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
        </>
      ) : null}
    </AdminPageShell>
  );
}
