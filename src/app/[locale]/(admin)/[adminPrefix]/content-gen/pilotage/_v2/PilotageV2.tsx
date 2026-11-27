// Écran « Pilotage SEO & IA » (P8) — LECTURE SEULE, mode observation.
// Composants serveur. Une valeur inconnue s'écrit « indisponible », jamais 0.

import Link from "next/link";
import {
  AdminBadge,
  AdminCard,
  AdminEmptyState,
  AdminPageHeader,
  AdminPageShell,
  AdminTable,
} from "@/components/admin/ui";
import type { AdminTableColumn } from "@/components/admin/ui";
import { TYPES_PAGE } from "@/server/seo-pilotage/donnees/types-page";
import type {
  ImportEcran,
  LignePageEcran,
  ModeleActif,
  ModelePilotage,
  OpportuniteEcran,
} from "@/server/seo-pilotage/ecran/modele";
import type { LigneRequeteEcran } from "@/server/seo-pilotage/ecran/requetes";
import type { LigneVue } from "@/server/seo-pilotage/ecran/vue";

export const ONGLETS = [
  { cle: "ensemble", libelle: "Vue d'ensemble" },
  { cle: "pages", libelle: "Pages" },
  { cle: "requetes", libelle: "Requêtes" },
  { cle: "opportunites", libelle: "Opportunités" },
  { cle: "sante", libelle: "Santé des données" },
] as const;
type CleOnglet = (typeof ONGLETS)[number]["cle"];

const TYPES: Readonly<Record<string, string>> = {
  article: "Articles",
  actualite: "Actualités",
  guide: "Guides",
  ville: "Pages de villes",
  offre: "Offres",
  faq: "Questions fréquentes",
  institutionnel: "Pages de présentation",
  conversion: "Contact et réservation",
  galerie: "Galerie",
  autre: "Autres pages",
  total: "Ensemble du site",
};
const INTENTIONS: Readonly<Record<string, string>> = {
  navigationnelle: "Cherche la marque",
  transactionnelle: "Veut acheter",
  locale: "Locale",
  commerciale: "Compare des offres",
  informationnelle: "Veut comprendre",
  inconnue: "Non classée",
};
const DETECTEURS: Readonly<Record<string, string>> = {
  a: "Presque en première page",
  b: "Peu de clics pour sa position",
  c: "Requête sans page adaptée",
  d: "Pages en concurrence",
  e: "Page en baisse",
  f: "Jamais affichée",
};

const MODES = {
  observation: "Mode observation",
  proposition: "Mode proposition",
  auto_borne: "Mode automatique borné",
} as const;

const libelleType = (t: string): string => TYPES[t] ?? t;

const nombre = (n: number): string => new Intl.NumberFormat("fr-FR").format(n);
const decimal = (n: number): string =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
const pourcent = (n: number): string =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n * 100)} %`;
const jourFr = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const jourCourt = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

function Indisponible({ quoi }: { readonly quoi: string }) {
  return (
    <AdminCard>
      <p className="text-sm text-[color:var(--color-admin-warning-fg)]">
        {quoi} : <strong>indisponible</strong> pour l&apos;instant. Ce n&apos;est pas un zéro : la
        donnée n&apos;a pas pu être lue.
      </p>
    </AdminCard>
  );
}

function Evolution({
  valeur,
  suffixe = " %",
}: {
  readonly valeur: number | null;
  suffixe?: string;
}) {
  if (valeur === null) return <span className="admin-meta-block">—</span>;
  const signe = valeur > 0 ? "+" : "";
  return (
    <span>
      {signe}
      {decimal(valeur)}
      {suffixe}
    </span>
  );
}

function VueEnsemble({ modele }: { readonly modele: ModeleActif }) {
  if (modele.vue === null) return <Indisponible quoi="Les chiffres par type de page" />;
  if (modele.vue.length === 0) {
    return (
      <AdminEmptyState
        title="Pas encore de chiffres"
        description="Aucune donnée de Google sur les 28 derniers jours."
      />
    );
  }
  const colonnes: AdminTableColumn<LigneVue>[] = [
    {
      key: "type",
      header: "Type de page",
      cell: (l) => <strong>{libelleType(l.typePage)}</strong>,
    },
    { key: "clics", header: "Clics", align: "right", cell: (l) => nombre(l.clics) },
    {
      key: "dclics",
      header: "Évolution des clics",
      align: "right",
      cell: (l) => <Evolution valeur={l.variationClics} />,
    },
    { key: "imp", header: "Affichages", align: "right", cell: (l) => nombre(l.impressions) },
    {
      key: "dimp",
      header: "Évolution des affichages",
      align: "right",
      cell: (l) => <Evolution valeur={l.variationImpressions} />,
    },
    {
      key: "pos",
      header: "Position moyenne dans Google",
      align: "right",
      cell: (l) => (l.position === null ? "indisponible" : decimal(l.position)),
    },
    {
      key: "ctr",
      header: "Part des personnes qui cliquent",
      align: "right",
      cell: (l) => (l.ctr === null ? "indisponible" : pourcent(l.ctr)),
    },
  ];
  return (
    <div className="space-y-2">
      {!modele.fenetreCouranteComplete ? (
        <p className="text-sm text-[color:var(--color-admin-warning-fg)]">
          Attention : certains jours des 28 derniers jours n&apos;ont pas encore été reçus de
          Google. Les chiffres sont partiels.
        </p>
      ) : null}
      {!modele.comparaisonPossible ? (
        <p className="text-sm text-[color:var(--color-admin-warning-fg)]">
          Évolution indisponible : les 28 jours d&apos;avant ne sont pas tous reçus.
        </p>
      ) : null}
      <p className="admin-meta-block">
        28 derniers jours, comparés aux 28 jours d&apos;avant. Une position plus basse en chiffre
        est meilleure (1 = tout en haut).
      </p>
      <AdminTable
        columns={colonnes}
        rows={modele.vue}
        getRowId={(l) => l.typePage}
        caption="Résultats dans Google par type de page"
      />
    </div>
  );
}

function Pages({
  lignes,
  base,
}: {
  readonly lignes: LignePageEcran[] | null;
  readonly base: string;
}) {
  if (lignes === null) return <Indisponible quoi="La liste des pages" />;
  const filtrees = lignes;
  const colonnes: AdminTableColumn<LignePageEcran>[] = [
    { key: "chemin", header: "Page", cell: (l) => l.chemin },
    { key: "type", header: "Type", cell: (l) => libelleType(l.typePage) },
    { key: "clics", header: "Clics", align: "right", cell: (l) => nombre(l.clics) },
    { key: "imp", header: "Affichages", align: "right", cell: (l) => nombre(l.impressions) },
    {
      key: "pos",
      header: "Position moyenne",
      align: "right",
      cell: (l) => (l.position === null ? "indisponible" : decimal(l.position)),
    },
    {
      key: "cit",
      header: "Facilité à être citée par une IA",
      cell: () => <span className="admin-meta-block">pas encore mesurée</span>,
    },
  ];
  return (
    <div className="space-y-3">
      <nav aria-label="Filtrer par type de page" className="flex flex-wrap gap-2 text-sm">
        <Link href={`${base}?onglet=pages`}>Tous</Link>
        {TYPES_PAGE.map((t) => (
          <Link key={t} href={`${base}?onglet=pages&type=${encodeURIComponent(t)}`}>
            {libelleType(t)}
          </Link>
        ))}
      </nav>
      <AdminTable
        columns={colonnes}
        rows={filtrees}
        getRowId={(l) => `${l.chemin}|${l.typePage}`}
        caption="Pages les plus affichées sur 28 jours"
        emptyState={<AdminEmptyState title="Aucune page" description="Rien à afficher ici." />}
      />
    </div>
  );
}

function Requetes({ lignes }: { readonly lignes: LigneRequeteEcran[] | null }) {
  if (lignes === null) return <Indisponible quoi="La liste des requêtes" />;
  const colonnes: AdminTableColumn<LigneRequeteEcran>[] = [
    { key: "req", header: "Ce que les gens tapent", cell: (l) => <strong>{l.requete}</strong> },
    {
      key: "int",
      header: "Ce qu'ils cherchent",
      cell: (l) => INTENTIONS[l.intention] ?? l.intention,
    },
    { key: "imp", header: "Affichages", align: "right", cell: (l) => nombre(l.impressions) },
    { key: "clics", header: "Clics", align: "right", cell: (l) => nombre(l.clics) },
    {
      key: "pos",
      header: "Position moyenne",
      align: "right",
      cell: (l) => (l.position === null ? "indisponible" : decimal(l.position)),
    },
    { key: "page", header: "Page qui répond", cell: (l) => l.pageProprietaire },
    {
      key: "cann",
      header: "Concurrence entre pages",
      cell: (l) =>
        l.cannibalisation ? (
          <AdminBadge tone="warning">Plusieurs pages ({l.nbPages})</AdminBadge>
        ) : (
          "—"
        ),
    },
  ];
  return (
    <div className="space-y-2">
      <p className="admin-meta-block">
        Les requêtes rares (moins de 3 affichages) ne sont pas montrées, par prudence sur les
        données personnelles.
      </p>
      <AdminTable
        columns={colonnes}
        rows={lignes}
        getRowId={(l) => l.requete}
        caption="Requêtes des 28 derniers jours"
        emptyState={<AdminEmptyState title="Aucune requête" description="Rien à afficher ici." />}
      />
    </div>
  );
}

function Opportunites({ lignes }: { readonly lignes: OpportuniteEcran[] | null }) {
  if (lignes === null) return <Indisponible quoi="Les opportunités" />;
  if (lignes.length === 0) {
    return (
      <AdminEmptyState
        title="Aucune opportunité pour l'instant"
        description="Le calcul de la semaine n'a rien enregistré. En mode observation, rien n'est modifié sur le site."
      />
    );
  }
  const colonnes: AdminTableColumn<OpportuniteEcran>[] = [
    {
      key: "det",
      header: "Piste",
      cell: (l) => <strong>{DETECTEURS[l.detecteur] ?? l.detecteur}</strong>,
    },
    { key: "cible", header: "Page ou requête", cell: (l) => l.cible },
    { key: "motif", header: "Pourquoi", cell: (l) => l.motif ?? "—" },
    { key: "prio", header: "Priorité", align: "right", cell: (l) => decimal(l.priorite) },
  ];
  const aTraiter = lignes.filter((l) => !l.signalement);
  const signalements = lignes.filter((l) => l.signalement);
  return (
    <div className="space-y-6">
      <section aria-labelledby="opp-pistes" className="space-y-2">
        <h2 id="opp-pistes" className="text-base font-semibold">
          Pistes classées par priorité
        </h2>
        <AdminTable
          columns={colonnes}
          rows={aTraiter}
          getRowId={(l) => l.id}
          emptyState={<AdminEmptyState title="Aucune piste" description="Rien à classer." />}
        />
      </section>
      <section aria-labelledby="opp-signalements" className="space-y-2">
        <h2 id="opp-signalements" className="text-base font-semibold">
          À décider par une personne
        </h2>
        <p className="admin-meta-block">
          Fusionner deux pages, retirer une page de Google : le système ne le fait jamais seul.
        </p>
        <AdminTable
          columns={colonnes}
          rows={signalements}
          getRowId={(l) => l.id}
          emptyState={<AdminEmptyState title="Aucun signalement" description="Rien à décider." />}
        />
      </section>
    </div>
  );
}

function Sante({ modele }: { readonly modele: ModeleActif }) {
  if (modele.imports === null) return <Indisponible quoi="L'historique des imports" />;
  const colonnes: AdminTableColumn<ImportEcran>[] = [
    { key: "jour", header: "Jour importé", cell: (l) => jourFr(l.jour) },
    {
      key: "statut",
      header: "Résultat",
      cell: (l) =>
        l.statut === "reussi" ? (
          <AdminBadge tone="success">Réussi</AdminBadge>
        ) : l.statut === "en_cours" ? (
          <AdminBadge tone="info">En cours</AdminBadge>
        ) : (
          <AdminBadge tone="destructive">Échec</AdminBadge>
        ),
    },
    { key: "p", header: "Lignes de pages", align: "right", cell: (l) => nombre(l.nbLignesPage) },
    {
      key: "r",
      header: "Lignes de requêtes",
      align: "right",
      cell: (l) => nombre(l.nbLignesRequete),
    },
    { key: "t", header: "Essais", align: "right", cell: (l) => nombre(l.tentatives) },
    { key: "e", header: "Erreur", cell: (l) => l.erreurCode ?? "—" },
  ];
  return (
    <div className="space-y-2">
      <p className="admin-meta-block">{modele.source.explication}</p>
      <AdminTable
        columns={colonnes}
        rows={modele.imports}
        getRowId={(l) => l.jour}
        caption="Derniers imports depuis Google Search Console"
        emptyState={
          <AdminEmptyState title="Aucun import" description="Rien n'a encore été reçu." />
        }
      />
    </div>
  );
}

const ETATS_SOURCE = {
  disponible: { tone: "success", texte: "disponible" },
  en_retard: { tone: "warning", texte: "en retard" },
  indisponible: { tone: "destructive", texte: "indisponible" },
} as const;

interface Props {
  readonly modele: ModelePilotage;
  readonly adminPrefix: string;
  readonly onglet?: string | undefined;
}

export function PilotageV2({ modele, adminPrefix, onglet }: Props) {
  const base = `/fr/${adminPrefix}/content-gen/pilotage`;
  if (modele.etat === "eteint") {
    return (
      <AdminPageShell>
        <AdminPageHeader title="Pilotage SEO & IA" />
        <AdminEmptyState
          title="Pilotage éteint"
          description="Le suivi des résultats dans Google n'est pas activé sur ce serveur. Rien n'est collecté, rien n'est modifié."
        />
      </AdminPageShell>
    );
  }
  const actif: CleOnglet = ONGLETS.some((o) => o.cle === onglet)
    ? (onglet as CleOnglet)
    : "ensemble";
  const etat = ETATS_SOURCE[modele.source.etat];
  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Pilotage SEO & IA"
        description="Comment le site se comporte dans Google. Lecture seule : cet écran ne modifie rien."
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <AdminBadge tone="info">{MODES[modele.mode]}</AdminBadge>
            <span>
              Google Search Console : <AdminBadge tone={etat.tone}>{etat.texte}</AdminBadge>
            </span>
            {modele.donneesJusquAu ? (
              <span>Données jusqu&apos;au {jourCourt(modele.donneesJusquAu)}</span>
            ) : null}
          </span>
        }
      />
      <nav aria-label="Sections du pilotage" className="mb-4 flex flex-wrap gap-2 text-sm">
        {ONGLETS.map((o) => (
          <Link
            key={o.cle}
            href={`${base}?onglet=${o.cle}`}
            aria-current={o.cle === actif ? "page" : undefined}
            className={
              o.cle === actif
                ? "rounded bg-[color:var(--color-admin-accent)] px-3 py-1 font-semibold text-white"
                : "rounded border border-[color:var(--color-admin-accent)] px-3 py-1 text-[color:var(--color-admin-accent)]"
            }
          >
            {o.libelle}
          </Link>
        ))}
      </nav>
      {actif === "ensemble" ? <VueEnsemble modele={modele} /> : null}
      {actif === "pages" ? <Pages lignes={modele.pages} base={base} /> : null}
      {actif === "requetes" ? <Requetes lignes={modele.requetes} /> : null}
      {actif === "opportunites" ? <Opportunites lignes={modele.opportunites} /> : null}
      {actif === "sante" ? <Sante modele={modele} /> : null}
    </AdminPageShell>
  );
}
