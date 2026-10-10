/**
 * Admin — Conformité RGPD : le registre des traitements, ses points à corriger, les
 * demandes des personnes, les sous-traitants et la conduite à tenir en cas d'incident.
 *
 * ⛔ Le registre n'est PAS dans le dépôt : il est importé ici (administrateurs) et
 * rangé dans le stockage privé R2 (cf. `src/features/conformite-rgpd/stockage.ts`).
 *
 * Server Component — garde de consultation, force-dynamic (donc `no-store`), noindex.
 * Onglets en liens `?onglet=` : aucun JavaScript client pour changer de vue.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BookOpenCheck, Building2, Inbox } from "lucide-react";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminEmptyState } from "@/components/admin/ui/AdminEmptyState";
import { AdminSubmitButton } from "@/components/admin/ui/AdminSubmitButton";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { CarteEcart, PastilleEtat, texteOuTiret } from "@/components/admin/conformite-rgpd/blocs";
import { SUBPROCESSORS } from "@/content/subprocessors";
import { importerRegistreAction } from "@/features/conformite-rgpd/actions";
import { LIBELLE_ORIGINE, listerDemandes } from "@/features/conformite-rgpd/demandes";
import {
  compterOuverts,
  destinatairesAbsents,
  joursRestants,
  pastilleDelai,
  peutImporterRegistre,
  pointsACorriger,
  transfereHorsUE,
} from "@/features/conformite-rgpd/regles";
import { lireRegistre } from "@/features/conformite-rgpd/stockage";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Conformité RGPD | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const ONGLETS = [
  { cle: "registre", libelle: "Registre" },
  { cle: "points", libelle: "Points à corriger" },
  { cle: "demandes", libelle: "Demandes" },
  { cle: "sous-traitants", libelle: "Sous-traitants" },
  { cle: "incidents", libelle: "Incidents" },
] as const;

/** Le téléservice officiel de notification d'une violation de données, à la CNIL. */
const TELESERVICE_CNIL = "https://notifications.cnil.fr/notifications/index";

const MESSAGE_VIDE =
  "Importez le fichier registre.json rangé dans le Drive (04 · Administratif & Juridique › RGPD — Site Axion-IA).";

const headCls =
  "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";
const cellCls =
  "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";
const tableCls =
  "overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]";
const sousTexteCls = "text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]";

const fr = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ConformiteRgpdPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  }
  const sp = await searchParams;
  const base = `/fr/${adminPrefix}/conformite-rgpd`;
  const racine = `/fr/${adminPrefix}`;
  const onglet = ONGLETS.find((o) => o.cle === sp.onglet) ?? ONGLETS[0];

  const [lecture, demandes] = await Promise.all([lireRegistre(), listerDemandes()]);
  const registre = lecture.etat === "ok" ? lecture.registre : null;
  const points = registre ? pointsACorriger(registre) : [];
  const ouverts = registre ? compterOuverts(registre) : { total: 0, graves: 0 };
  const aTraiter = demandes.filter((d) => d.aTraiter).length;
  const nomsPublics = SUBPROCESSORS.map((s) => s.name);
  const absents = registre ? destinatairesAbsents(registre, nomsPublics) : [];
  const admin = peutImporterRegistre(acces.role);

  return (
    <AdminPageShell width="wide">
      <div className="flex flex-col gap-[var(--space-admin-5)]">
        <AdminPageHeader
          title="Conformité RGPD"
          description="Le registre des données personnelles, ce qu'il reste à corriger et les demandes à traiter."
          actions={
            registre ? (
              <a href={`${base}/registre-pdf`} className="admin-button-secondary">
                Télécharger le registre (PDF)
              </a>
            ) : undefined
          }
        />

        {sp.import === "ok" ? (
          <p role="status" className="admin-alert admin-alert-success">
            Registre mis à jour.
          </p>
        ) : null}
        {sp.erreur ? (
          <p role="alert" className="admin-alert admin-alert-error">
            Import refusé. {sp.erreur.slice(0, 400)}
          </p>
        ) : null}
        {lecture.etat === "non_configure" ? (
          <p role="status" className="admin-alert admin-alert-info">
            Le stockage privé n&apos;est pas configuré sur ce serveur : le registre ne peut être ni
            lu ni importé ici.
          </p>
        ) : null}
        {lecture.etat === "illisible" ? (
          <p role="alert" className="admin-alert admin-alert-error">
            Le registre enregistré ne peut pas être lu. {lecture.erreur} Importez-le de nouveau.
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-[var(--space-admin-3)] md:grid-cols-4">
          <AdminStatCard
            label="Activités au registre"
            value={registre ? registre.traitements.length : "—"}
            icon={BookOpenCheck}
            href={`${base}?onglet=registre`}
          />
          <AdminStatCard
            label="Demandes à traiter"
            value={aTraiter}
            tone={aTraiter > 0 ? "warning" : "default"}
            icon={Inbox}
            href={`${base}?onglet=demandes`}
          />
          <AdminStatCard
            label="Sous-traitants"
            value={SUBPROCESSORS.length}
            icon={Building2}
            href={`${base}?onglet=sous-traitants`}
          />
          <AdminStatCard
            label="Points à corriger"
            value={registre ? ouverts.total : "—"}
            tone={ouverts.graves > 0 ? "destructive" : ouverts.total > 0 ? "warning" : "default"}
            {...(ouverts.graves > 0
              ? { meta: `dont ${ouverts.graves} critique(s) ou élevé(s)` }
              : {})}
            icon={AlertTriangle}
            href={`${base}?onglet=points`}
          />
        </div>

        {admin && lecture.etat !== "non_configure" ? (
          <form
            action={importerRegistreAction}
            className="flex flex-wrap items-end gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
          >
            <label className="flex flex-col gap-[var(--space-admin-1)]">
              <span className="admin-label">Fichier registre.json (2 Mo au plus)</span>
              <input
                type="file"
                name="registre"
                accept="application/json,.json"
                required
                className="admin-input"
              />
            </label>
            <AdminSubmitButton pendingLabel="Envoi…">Mettre à jour le registre</AdminSubmitButton>
          </form>
        ) : null}

        <nav aria-label="Onglets" className="flex flex-wrap gap-[var(--space-admin-2)]">
          {ONGLETS.map((o) => (
            <Link
              key={o.cle}
              href={`${base}?onglet=${o.cle}`}
              aria-current={o.cle === onglet.cle ? "page" : undefined}
              className={o.cle === onglet.cle ? "admin-button" : "admin-button-secondary"}
            >
              {o.libelle}
              {o.cle === "points" && registre ? ` (${ouverts.total})` : ""}
              {o.cle === "demandes" && aTraiter > 0 ? ` (${aTraiter})` : ""}
            </Link>
          ))}
        </nav>

        {onglet.cle === "registre" ? (
          registre === null || registre.traitements.length === 0 ? (
            <AdminEmptyState title="Aucun registre importé." description={MESSAGE_VIDE} />
          ) : (
            <div className={tableCls}>
              <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
                <thead className="border-b border-[color:var(--color-admin-border)]">
                  <tr>
                    <th className={headCls}>Activité</th>
                    <th className={headCls}>Repères</th>
                    <th className={headCls}>État</th>
                  </tr>
                </thead>
                <tbody>
                  {registre.traitements.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                    >
                      <td className={cellCls}>
                        <Link
                          href={`${base}/${t.id}`}
                          className="font-semibold underline-offset-2 hover:underline"
                        >
                          {t.nom}
                        </Link>
                        <div className={sousTexteCls}>
                          {texteOuTiret(t.personnes.join(", "))} ·{" "}
                          {texteOuTiret(t.donnees.join(", "))}
                        </div>
                      </td>
                      <td className={cellCls}>
                        <div className="flex flex-wrap gap-[var(--space-admin-2)]">
                          <AdminBadge tone="outline">
                            Conservation : {texteOuTiret(t.conservationAnnoncee)}
                          </AdminBadge>
                          <AdminBadge tone="outline">{texteOuTiret(t.baseLegale)}</AdminBadge>
                          {transfereHorsUE(t) ? (
                            <AdminBadge tone="warning">Hors UE</AdminBadge>
                          ) : null}
                        </div>
                      </td>
                      <td className={cellCls}>
                        <PastilleEtat traitement={t} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {onglet.cle === "points" ? (
          registre === null ? (
            <AdminEmptyState title="Aucun registre importé." description={MESSAGE_VIDE} />
          ) : points.length === 0 ? (
            <AdminEmptyState
              title="Rien à corriger."
              description="Aucun point ouvert au registre."
            />
          ) : (
            <ul className="flex flex-col gap-[var(--space-admin-3)]">
              {points.map((e, i) => (
                <CarteEcart
                  key={`${e.traitementId}-${i}`}
                  ecart={e}
                  contexte={
                    <Link
                      href={`${base}/${e.traitementId}`}
                      className="text-[length:var(--text-admin-xs)] font-semibold underline-offset-2 hover:underline"
                    >
                      {e.traitementNom}
                    </Link>
                  }
                />
              ))}
            </ul>
          )
        ) : null}

        {onglet.cle === "demandes" ? (
          <>
            {demandes.length === 0 ? (
              <AdminEmptyState
                title="Aucune demande."
                description="Les demandes d'accès ou d'effacement apparaissent ici."
              />
            ) : (
              <div className={tableCls}>
                <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
                  <thead className="border-b border-[color:var(--color-admin-border)]">
                    <tr>
                      <th className={headCls}>Personne</th>
                      <th className={headCls}>Demande</th>
                      <th className={headCls}>Reçue le</th>
                      <th className={headCls}>Délai</th>
                      <th className={headCls}>Répondre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandes.map((d) => {
                      const delai = pastilleDelai(joursRestants(d.demandeLe));
                      return (
                        <tr
                          key={`${d.origine}-${d.id}`}
                          className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                        >
                          <td className={cellCls}>
                            <div className="font-medium">{d.personne}</div>
                            <div className={sousTexteCls}>{LIBELLE_ORIGINE[d.origine]}</div>
                          </td>
                          <td className={cellCls}>
                            {d.type === "effacement" ? "Effacement" : "Accès"}
                          </td>
                          <td className={cellCls}>{fr(d.demandeLe)}</td>
                          <td className={cellCls}>
                            {d.aTraiter ? (
                              <AdminBadge tone={delai.ton} dot>
                                {delai.libelle}
                              </AdminBadge>
                            ) : (
                              <AdminBadge tone="success">
                                Faite{d.faiteLe ? ` le ${fr(d.faiteLe)}` : ""}
                              </AdminBadge>
                            )}
                          </td>
                          <td className={cellCls}>
                            <Link href={`${racine}/${d.outil}`} className="admin-button-secondary">
                              Ouvrir
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className={`mt-[var(--space-admin-3)] ${sousTexteCls}`}>
              Délai de réponse : un mois. Les demandes reçues par e-mail n&apos;apparaissent pas
              ici.
            </p>
          </>
        ) : null}

        {onglet.cle === "sous-traitants" ? (
          <>
            {absents.length > 0 ? (
              <div className="mb-[var(--space-admin-5)]">
                <p className="mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
                  Cités dans le registre, mais pas sur la page publique :
                </p>
                <div className="flex flex-wrap gap-[var(--space-admin-2)]">
                  {absents.map((d) => (
                    <AdminBadge key={d.nom} tone="warning" dot>
                      {d.nom} — absent de la page publique
                    </AdminBadge>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={tableCls}>
              <table className="w-full border-collapse text-[length:var(--text-admin-sm)]">
                <thead className="border-b border-[color:var(--color-admin-border)]">
                  <tr>
                    <th className={headCls}>Sous-traitant</th>
                    <th className={headCls}>Pour quoi</th>
                    <th className={headCls}>Où</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBPROCESSORS.map((s) => (
                    <tr
                      key={s.name}
                      className="border-b border-[color:var(--color-admin-border)] last:border-b-0"
                    >
                      <td className={cellCls}>
                        <span className="font-medium">{s.name}</span>
                      </td>
                      <td className={cellCls}>{s.purposeFr}</td>
                      <td className={cellCls}>
                        <div>{s.serversLocation}</div>
                        {s.transferFramework === "scc" ||
                        s.transferFramework === "adequacy_decision" ? (
                          <AdminBadge tone="warning">Hors UE</AdminBadge>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={`mt-[var(--space-admin-3)] ${sousTexteCls}`}>
              Même liste que la page publique{" "}
              <Link href="/fr/sous-processeurs" className="underline underline-offset-2">
                /sous-processeurs
              </Link>
              .
            </p>
          </>
        ) : null}

        {onglet.cle === "incidents" ? (
          <div className="flex flex-col gap-[var(--space-admin-5)]">
            <ol className="flex flex-col gap-[var(--space-admin-3)]">
              <li className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
                <p className="font-semibold">1. Tout de suite : noter</p>
                <p className="text-[color:var(--color-admin-fg-soft)]">
                  Ce qui s&apos;est passé, quand, quelles données, combien de personnes.
                </p>
              </li>
              <li className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
                <p className="font-semibold">2. Avant 72 h : prévenir la CNIL</p>
                <p className="text-[color:var(--color-admin-fg-soft)]">
                  Sur le{" "}
                  <a
                    href={TELESERVICE_CNIL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    téléservice de notification de la CNIL
                  </a>
                  .
                </p>
              </li>
              <li className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]">
                <p className="font-semibold">3. Si le risque est élevé : prévenir les personnes</p>
                <p className="text-[color:var(--color-admin-fg-soft)]">
                  Leur dire ce qui s&apos;est passé et ce qu&apos;elles peuvent faire.
                </p>
              </li>
            </ol>
            <AdminEmptyState
              title="Aucun incident déclaré."
              description="Bientôt : déclarer un incident depuis cette page."
            />
          </div>
        ) : null}
      </div>
    </AdminPageShell>
  );
}
