// Réseau d'apporteurs (démarrage manuel, 2026-10-05) — les ENTREPRISES PRÉSENTÉES.
// Onglets « À traiter » (réponse à donner), « Protégées », « Toutes », et le formulaire
// de saisie à la réception de l'e-mail de l'apporteur.

import { AdminBadge, AdminCard, AdminPageHeader } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminFilterTabs } from "@/components/admin/ui/AdminFilterTabs";
import { ActionsPresentation } from "@/components/admin/apporteurs/entreprises/ActionsPresentation";
import { NouvellePresentationForm } from "@/components/admin/apporteurs/entreprises/NouvellePresentationForm";
import { ReponsePresentation } from "@/components/admin/apporteurs/entreprises/ReponsePresentation";
import {
  compterParOnglet,
  dateCourte,
  libelleSignalement,
  lireApporteursSignes,
  lirePresentations,
  lireSignalements,
  nomFamilleDe,
  type OngletPresentations,
  type PresentationVue,
} from "@/features/apporteurs-reseau/presentations";
import { LIBELLE_PROLONGATION, type MotifProlongation } from "@/features/apporteurs-reseau/regles";
import { dayKeyInParis, toParisLocalInput } from "@/lib/calendar-grid";
import { gardePage } from "@/server/auth/garde-page";
import { peutOuvrirDossierApporteur } from "@/server/auth/habilitations";
import { coordonneesAffichables } from "@/features/apporteurs-reseau/coordonnees-presentees";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const ONGLETS: ReadonlyArray<{ cle: OngletPresentations; libelle: string }> = [
  { cle: "a-traiter", libelle: "À traiter" },
  { cle: "protegees", libelle: "Protégées" },
  { cle: "toutes", libelle: "Toutes" },
];

const STATUT: Record<
  string,
  { libelle: string; ton: "neutral" | "info" | "success" | "warning" | "destructive" }
> = {
  reservee: { libelle: "En attente de l'entreprise", ton: "info" },
  confirmee: { libelle: "Protégée", ton: "success" },
  deja_connue: { libelle: "Déjà connue", ton: "neutral" },
  hors_champ: { libelle: "Hors champ", ton: "neutral" },
  dementie: { libelle: "Démentie", ton: "destructive" },
  terminee: { libelle: "Terminée", ton: "neutral" },
};

const heure = (d: Date) =>
  d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

export default async function EntreprisesPresenteesPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const sp = await searchParams;
  const onglet = ONGLETS.find((o) => o.cle === sp.onglet)?.cle ?? "a-traiter";
  const base = `/fr/${adminPrefix}/apporteurs/entreprises`;
  const maintenant = new Date();
  const voitPii = peutOuvrirDossierApporteur(acces.role);

  const [comptes, lignes, apporteurs] = await Promise.all([
    compterParOnglet(),
    lirePresentations(onglet),
    lireApporteursSignes(),
  ]);
  const signalements = new Map(
    await Promise.all(
      lignes
        .filter((p) => p.aTraiter)
        .map(
          async (p) =>
            [
              p.id,
              (await lireSignalements(p.siren, maintenant, p.id)).map(libelleSignalement),
            ] as const,
        ),
    ),
  );

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Entreprises présentées"
        description="Les entreprises présentées par les apporteurs, par e-mail ou par leur formulaire."
      />

      {acces.peutEcrire ? (
        <AdminCard as="section">
          <details>
            <summary className="cursor-pointer font-semibold">
              ➕ Nouvelle entreprise présentée
            </summary>
            <div className="pt-[var(--space-admin-4)]">
              <NouvellePresentationForm
                apporteurs={apporteurs}
                maintenantLocal={toParisLocalInput(maintenant)}
              />
            </div>
          </details>
        </AdminCard>
      ) : null}

      <AdminFilterTabs
        current={onglet}
        options={ONGLETS.map((o) => ({
          value: o.cle,
          label: o.libelle,
          href: `${base}?onglet=${o.cle}`,
          count: comptes[o.cle],
        }))}
      />

      {lignes.length === 0 ? (
        <p className="text-[color:var(--color-admin-fg-muted)]">Rien ici.</p>
      ) : (
        <div className="grid gap-[var(--space-admin-3)] lg:grid-cols-2">
          {lignes.map((p) => (
            <Carte
              key={p.id}
              p={p}
              signalements={signalements.get(p.id) ?? []}
              peutEcrire={acces.peutEcrire}
              voitPii={voitPii}
              aujourdhui={dayKeyInParis(maintenant)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Carte({
  p,
  signalements,
  peutEcrire,
  voitPii,
  aujourdhui,
}: {
  p: PresentationVue;
  signalements: string[];
  peutEcrire: boolean;
  /** Les coordonnées des personnes présentées sont réservées aux rôles autorisés. */
  voitPii: boolean;
  aujourdhui: string;
}) {
  const statut = p.aTraiter
    ? { libelle: "À traiter", ton: "warning" as const }
    : (STATUT[p.statut] ?? STATUT.terminee!);
  return (
    <AdminCard as="article">
      <div className="flex flex-col gap-[var(--space-admin-3)]">
        <div className="flex flex-wrap items-start justify-between gap-[var(--space-admin-2)]">
          <div>
            <h2 className="text-[length:var(--text-admin-lg)] font-semibold">{p.denomination}</h2>
            <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              {p.siren} · par {p.apporteur} · reçu le {heure(p.recueAt)}
            </p>
          </div>
          <AdminBadge tone={statut.ton} dot>
            {statut.libelle}
          </AdminBadge>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-[var(--space-admin-3)] gap-y-1 text-[length:var(--text-admin-sm)]">
          <dt className="text-[color:var(--color-admin-fg-muted)]">👤</dt>
          <dd>
            {p.personneNom}
            {p.personneFonction ? `, ${p.personneFonction}` : ""}
          </dd>
          <dt className="text-[color:var(--color-admin-fg-muted)]">✉️</dt>
          <dd>{coordonneesAffichables(p, voitPii)}</dd>
          {p.besoin ? (
            <>
              <dt className="text-[color:var(--color-admin-fg-muted)]">🎯</dt>
              <dd>{p.besoin}</dd>
            </>
          ) : null}
          {p.dateEchange ? (
            <>
              <dt className="text-[color:var(--color-admin-fg-muted)]">🤝</dt>
              <dd>Échange le {dateCourte(p.dateEchange)}</dd>
            </>
          ) : null}
          {p.protegeeJusquAt && p.statut === "confirmee" ? (
            <>
              <dt className="text-[color:var(--color-admin-fg-muted)]">🛡️</dt>
              <dd>
                Jusqu&apos;au {dateCourte(p.protegeeJusquAt)}
                {p.confirmationTacite ? " (sans réponse, 30 jours)" : ""}
                {p.motifProlongation
                  ? ` · prolongée : ${LIBELLE_PROLONGATION[p.motifProlongation as MotifProlongation] ?? p.motifProlongation}`
                  : ""}
              </dd>
            </>
          ) : null}
          {p.adresseACorriger ? (
            <>
              <dt className="text-[color:var(--color-admin-fg-muted)]">⚠️</dt>
              <dd>
                <AdminBadge tone="warning">Adresse à corriger</AdminBadge> le message de prise de
                contact est revenu en erreur : les 30 jours ne courent pas.
              </dd>
            </>
          ) : null}
          {p.statut === "reservee" && p.contactEnvoyeAt ? (
            <>
              <dt className="text-[color:var(--color-admin-fg-muted)]">📨</dt>
              <dd>Contactée le {dateCourte(p.contactEnvoyeAt)}</dd>
            </>
          ) : null}
        </dl>

        {p.aTraiter ? (
          <div className="flex flex-wrap gap-[var(--space-admin-2)]">
            {signalements.length === 0 ? (
              <AdminBadge tone="success">Rien de connu sur ce SIREN</AdminBadge>
            ) : (
              signalements.map((s) => (
                <AdminBadge key={s} tone="warning">
                  {s}
                </AdminBadge>
              ))
            )}
          </div>
        ) : null}

        {peutEcrire && p.aTraiter ? (
          <ReponsePresentation id={p.id} nomFamilleSuggere={nomFamilleDe(p.personneNom)} />
        ) : null}

        {peutEcrire && !p.aTraiter ? (
          <details>
            <summary className="cursor-pointer text-[length:var(--text-admin-sm)] font-medium">
              Actions
            </summary>
            <div className="pt-[var(--space-admin-3)]">
              <ActionsPresentation
                id={p.id}
                peutConfirmer={p.statut === "reservee"}
                peutDementir={p.statut === "reservee" || p.statut === "confirmee"}
                note={p.note}
                aujourdhui={aujourdhui}
              />
            </div>
          </details>
        ) : null}
        {!peutEcrire && p.note ? (
          <p className="text-[length:var(--text-admin-sm)]">📝 {p.note}</p>
        ) : null}
      </div>
    </AdminCard>
  );
}
