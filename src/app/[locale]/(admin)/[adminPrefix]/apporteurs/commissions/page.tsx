// Réseau d'apporteurs (démarrage manuel, 2026-10-05) — les COMMISSIONS.
// Relevés du mois (« Marquer versé »), puis la liste par statut, avec « Qualifier »
// pour une formation. Export annuel des versements (DAS2).

import Link from "next/link";

import { AdminBadge, AdminCard, AdminPageHeader, AdminStatCard } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminFilterTabs } from "@/components/admin/ui/AdminFilterTabs";
import {
  QualifierForm,
  VerserForm,
} from "@/components/admin/apporteurs/commissions/FormulairesCommission";
import { classerActiviteAction } from "@/features/apporteurs-reseau/actions-commissions";
import {
  COMMISSIONS_PAR_PAGE,
  compterCommissions,
  libelleMois,
  lireCommissions,
  moisParis,
  relevesDuMois,
} from "@/features/apporteurs-reseau/commissions";
import {
  euros,
  FORFAIT_CONFERENCE_CENTS,
  PALIER_CONFERENCE,
  PALIERS_FORMATION,
} from "@/features/apporteurs-reseau/regles";
import { moisAvecArticle } from "@/lib/email/templates/apporteur-demarrage";
import { peutEngager } from "@/server/auth/habilitations";
import { gardePage } from "@/server/auth/garde-page";
import type { StatutCommissionApporteur } from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const ONGLETS: ReadonlyArray<{ cle: StatutCommissionApporteur; libelle: string }> = [
  { cle: "a_qualifier", libelle: "À qualifier" },
  { cle: "due", libelle: "Dues" },
  { cle: "en_attente_vigilance", libelle: "Attente vigilance" },
  { cle: "versee", libelle: "Versées" },
  { cle: "reprise", libelle: "Reprises" },
];

const ACTIVITE: Record<string, string> = {
  formation: "Formation",
  un_a_un: "1-to-1",
  audit: "Audit",
  implementation: "Intégration",
  site_web: "Site web",
  conference: "Conférence",
};

const PALIERS = [
  ...PALIERS_FORMATION.map((p) => ({
    id: p.id,
    libelle: p.libelle,
    detail: `${euros(p.forfaitCents)} si ${euros(p.prixCents)} HT`,
  })),
  {
    id: PALIER_CONFERENCE,
    libelle: "Conférence (500 € fixes)",
    detail: `${euros(FORFAIT_CONFERENCE_CENTS)} par commande`,
  },
];

export default async function CommissionsApporteursPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const peutPayer = peutEngager(acces.role, "facturer");
  const sp = await searchParams;
  const base = `/fr/${adminPrefix}/apporteurs/commissions`;
  const maintenant = new Date();
  const comptes = await compterCommissions();
  const ongletDefaut = comptes.a_qualifier > 0 ? "a_qualifier" : "due";
  const onglet = ONGLETS.find((o) => o.cle === sp.statut)?.cle ?? ongletDefaut;
  const pages = Math.max(1, Math.ceil(comptes[onglet] / COMMISSIONS_PAR_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const [lignes, releves] = await Promise.all([
    lireCommissions(onglet, page),
    relevesDuMois(maintenant),
  ]);
  const annee = maintenant.getUTCFullYear();

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Commissions apporteurs"
        description="Nées des factures soldées des entreprises protégées."
        actions={
          <div className="flex flex-wrap gap-[var(--space-admin-2)]">
            {[annee - 1, annee].map((a) => (
              <a key={a} href={`${base}/export?annee=${a}`} className="admin-button-secondary">
                ⬇️ Versements {a} (DAS2)
              </a>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-[var(--space-admin-3)] md:grid-cols-4">
        <AdminStatCard
          label="À qualifier"
          value={comptes.a_qualifier}
          href={`${base}?statut=a_qualifier`}
        />
        <AdminStatCard label="Dues" value={comptes.due} href={`${base}?statut=due`} />
        <AdminStatCard
          label="Attente vigilance"
          value={comptes.en_attente_vigilance}
          href={`${base}?statut=en_attente_vigilance`}
        />
        <AdminStatCard label="Versées" value={comptes.versee} href={`${base}?statut=versee`} />
      </div>

      <AdminCard as="section">
        <h2 className="mb-[var(--space-admin-3)] font-semibold">
          💶 Relevé du mois {moisAvecArticle(libelleMois(moisParis(maintenant)))}
        </h2>
        {releves.length === 0 ? (
          <p className="text-[color:var(--color-admin-fg-muted)]">Aucune commission due.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--color-admin-border)]">
            {releves.map((r) => (
              <li
                key={r.apporteurId}
                className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)] py-[var(--space-admin-3)]"
              >
                <div>
                  <Link
                    href={`/fr/${adminPrefix}/apporteurs/${r.apporteurId}`}
                    className="font-medium"
                  >
                    {r.apporteur}
                  </Link>
                  <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                    {euros(r.soldeCents)} · {r.lignes} ligne(s){r.raison ? ` · ${r.raison}` : ""}
                  </p>
                </div>
                {r.emis && peutPayer ? (
                  <VerserForm apporteurId={r.apporteurId} montant={euros(r.soldeCents)} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminFilterTabs
        current={onglet}
        options={ONGLETS.map((o) => ({
          value: o.cle,
          label: o.libelle,
          href: `${base}?statut=${o.cle}`,
          count: comptes[o.cle],
        }))}
      />

      {lignes.length === 0 ? (
        <p className="text-[color:var(--color-admin-fg-muted)]">Rien ici.</p>
      ) : (
        <div className="grid gap-[var(--space-admin-3)] lg:grid-cols-2">
          {lignes.map((c) => (
            <AdminCard key={c.id} as="article" variant="compact">
              <div className="flex flex-col gap-[var(--space-admin-2)]">
                <div className="flex flex-wrap items-start justify-between gap-[var(--space-admin-2)]">
                  <div>
                    <p className="font-semibold">
                      {c.montantCents !== null ? euros(c.montantCents) : "—"}{" "}
                      <span className="font-normal text-[color:var(--color-admin-fg-muted)]">
                        · {c.apporteur}
                      </span>
                    </p>
                    <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                      {c.entreprise ?? "?"} · {ACTIVITE[c.activite] ?? c.activite} · facture{" "}
                      {c.factureNumero ?? "?"} ({euros(c.factureHtCents)} HT)
                    </p>
                  </div>
                  <div className="flex gap-[var(--space-admin-1)]">
                    {c.parrainage ? <AdminBadge tone="info">Parrainage</AdminBadge> : null}
                    {c.autofactureNumero ? (
                      <AdminBadge tone="outline">{c.autofactureNumero}</AdminBadge>
                    ) : null}
                  </div>
                </div>
                {c.palier ? (
                  <p className="text-[length:var(--text-admin-sm)]">
                    {c.palier === PALIER_CONFERENCE
                      ? "Conférence"
                      : (PALIERS_FORMATION.find((p) => p.id === c.palier)?.libelle ?? c.palier)}
                  </p>
                ) : null}
                {c.statut === "a_qualifier" &&
                !c.parrainage &&
                c.activite === "formation" &&
                peutPayer ? (
                  <QualifierForm id={c.id} paliers={PALIERS} />
                ) : null}
                {c.statut === "a_qualifier" && c.parrainage ? (
                  <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                    Calculée quand la commission du filleul sera qualifiée.
                  </p>
                ) : null}
                {c.statut === "a_qualifier" &&
                !c.parrainage &&
                c.activite !== "formation" &&
                peutPayer ? (
                  <form
                    action={classerActiviteAction}
                    className="flex flex-wrap items-end gap-[var(--space-admin-2)]"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                      Activité de la facture (inconnue)
                      <select name="activite" className="admin-input" defaultValue="">
                        <option value="" disabled>
                          Choisir…
                        </option>
                        <option value="formation">Formation (puis palier)</option>
                        <option value="un_a_un">1-to-1 (30 %)</option>
                        <option value="audit">Audit (30 %)</option>
                        <option value="implementation">Intégration (15 %)</option>
                        <option value="conference">Conférence (500 € fixes)</option>
                        <option value="site_web">Site web (aucune commission)</option>
                      </select>
                    </label>
                    <button type="submit" className="admin-button-secondary">
                      Classer
                    </button>
                  </form>
                ) : null}
              </div>
            </AdminCard>
          ))}
        </div>
      )}
      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center gap-[var(--space-admin-3)]">
          {page > 1 ? (
            <Link
              href={`${base}?statut=${onglet}&page=${page - 1}`}
              className="admin-button-secondary"
            >
              Précédent
            </Link>
          ) : null}
          <span className="text-[color:var(--color-admin-fg-muted)]">
            Page {page} sur {pages}
          </span>
          {page < pages ? (
            <Link
              href={`${base}?statut=${onglet}&page=${page + 1}`}
              className="admin-button-secondary"
            >
              Suivant
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
