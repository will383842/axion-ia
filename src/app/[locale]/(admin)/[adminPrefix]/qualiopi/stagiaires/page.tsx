/**
 * Admin — Qualiopi · Stagiaires (R10 audit E2E 2026-06-06).
 *
 * Liste des stagiaires (PII ; détail handicap chiffré jamais affiché ici).
 * Server Component force-dynamic.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminBadge } from "@/components/admin/ui";
import { AdminStatCard } from "@/components/admin/ui/AdminStatCard";
import { countTrainees, listTrainees } from "@/server/qualiopi/trainees/trainees";
import { Hash, Accessibility, ShieldCheck } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Qualiopi — Stagiaires | Axion-IA Admin",
  robots: { index: false, follow: false },
};

/**
 * Plafond de lignes rendues, et sa raison.
 *
 * 🔴 2026-09-02 (audit certificateur). `listTrainees()` était appelé sans
 * argument — alors que sa signature porte `limit`, `offset` ET `search`. Mesuré
 * sur la base de recette : **3 003 stagiaires**, rendus d'un bloc. 338 Ko de
 * texte, ~69 s de chargement, et AUCUN champ de recherche sur la page.
 *
 * Or c'est très exactement l'écran où l'auditrice dit « montrez-moi le dossier
 * de madame X » : sans recherche, il n'y avait pas de réponse à cette
 * demande-là, seulement un `Ctrl+F` sur une page de trois mille lignes.
 *
 * ⚠️ Le plafond se DIT, et l'écran dit par quoi le contourner. Une troncature
 * muette se lirait « voilà tous nos stagiaires ».
 */
const PLAFOND_STAGIAIRES = 100;

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function QualiopiStagiairesPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const base = `/${locale}/${adminPrefix}/qualiopi/stagiaires`;
  const recherche = ((await searchParams).q ?? "").trim();

  // Les trois tuiles portent sur le REGISTRE ENTIER, jamais sur la page
  // affichée : elles ne bougent donc pas quand on filtre, et un total qui
  // dépend de ce qu'on regarde ne serait pas un total.
  const [totalRegistre, handicap, consentis, trainees] = await Promise.all([
    countTrainees(),
    countTrainees({ situationHandicap: true }),
    countTrainees({ consentementFormation: true }),
    listTrainees({
      limit: PLAFOND_STAGIAIRES,
      ...(recherche !== "" ? { search: recherche } : {}),
    }),
  ]);
  const tronque = recherche === "" && totalRegistre > trainees.length;

  const cellCls = "px-[var(--space-admin-4)] py-[var(--space-admin-3)] align-top";
  const headCls =
    "px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-left text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)]";

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Stagiaires"
        description="Les données personnelles sont protégées : la nature du handicap est chiffrée en base et n'apparaît jamais sur cet écran."
      />

      <div className="mb-[var(--space-admin-6)] flex flex-wrap items-center gap-[var(--space-admin-4)]">
        <Link href={`${base}/new`} className="admin-button">
          + Nouveau stagiaire
        </Link>
        {/* Recherche serveur (GET), aucun JS : c'est le recours que le plafond
            doit offrir, et la réponse à « montrez-moi le dossier de madame X ». */}
        <form method="get" action={base} className="flex items-center gap-[var(--space-admin-2)]">
          <label htmlFor="recherche-stagiaire" className="sr-only">
            Rechercher un stagiaire par nom, prénom, e-mail ou entreprise
          </label>
          <input
            id="recherche-stagiaire"
            type="search"
            name="q"
            defaultValue={recherche}
            placeholder="Nom, prénom, e-mail, entreprise…"
            className="admin-input min-w-[260px]"
          />
          <button type="submit" className="admin-button-secondary">
            Rechercher
          </button>
          {recherche !== "" && (
            <Link href={base} className="admin-button-ghost">
              Effacer
            </Link>
          )}
        </form>
      </div>

      <div className="mb-[var(--space-admin-6)] grid grid-cols-1 gap-[var(--space-admin-5)] sm:grid-cols-3">
        <AdminStatCard label="Total au registre" value={totalRegistre} icon={Hash} />
        <AdminStatCard label="Situation de handicap" value={handicap} icon={Accessibility} />
        <AdminStatCard
          label="Consentement formation"
          value={consentis}
          tone="success"
          icon={ShieldCheck}
        />
      </div>

      {recherche !== "" && (
        <p className="mb-[var(--space-admin-4)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          {`${trainees.length} résultat${trainees.length > 1 ? "s" : ""} pour « ${recherche} »${trainees.length >= PLAFOND_STAGIAIRES ? ` (affichage plafonné à ${PLAFOND_STAGIAIRES} — affinez la recherche)` : ""}.`}
        </p>
      )}

      {tronque && (
        <p className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface)] px-[var(--space-admin-4)] py-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-soft)]">
          {`Liste plafonnée : ${totalRegistre} stagiaires au registre, ${trainees.length} affichés ici par ordre alphabétique. Utilisez la recherche pour retrouver un dossier précis.`}
        </p>
      )}

      {trainees.length === 0 ? (
        <AdminEmptyState
          title="Aucun stagiaire enregistré"
          description="Les stagiaires s'inscrivent ensuite à une session depuis le dossier de celle-ci."
          primaryAction={
            <Link href={`${base}/new`} className="admin-button">
              + Nouveau stagiaire
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          <table className="w-full border-collapse bg-[color:var(--color-admin-paper)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]">
            <thead className="border-b border-[color:var(--color-admin-border)]">
              <tr>
                <th className={headCls}>Nom</th>
                <th className={headCls}>Email</th>
                <th className={headCls}>Entreprise</th>
                <th className={headCls}>Handicap</th>
                <th className={headCls}>Consentement</th>
                {/* En-tête vide sur la colonne d'actions : le tableau annonçait
                    six colonnes et n'en nommait que cinq. */}
                <th className={headCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trainees.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-[color:var(--color-admin-border)] last:border-0"
                >
                  <td className={cellCls}>
                    <div className="font-medium">
                      {t.prenom} {t.nom}
                    </div>
                  </td>
                  <td className={cellCls}>
                    <span className="text-[length:var(--text-admin-xs)]">{t.email}</span>
                  </td>
                  <td className={cellCls}>
                    {t.entreprise ?? (
                      <em className="text-[color:var(--color-admin-fg-muted)] not-italic">—</em>
                    )}
                  </td>
                  <td className={cellCls}>
                    {t.situationHandicap ? (
                      <AdminBadge tone="warning" dot>
                        Oui
                      </AdminBadge>
                    ) : (
                      <span className="text-[color:var(--color-admin-fg-muted)]">Non</span>
                    )}
                  </td>
                  {/* 🔴 CETTE COLONNE NE PORTAIT QUE « ● » ou « ○ » — aucun
                      texte, aucune infobulle, aucun nom accessible. Vérifié
                      dans le DOM en production : la cellule ne contenait
                      littéralement que le caractère. L'information était portée
                      par la COULEUR SEULE : illisible en vision des couleurs
                      déficiente, muette pour un lecteur d'écran, et ambiguë
                      même à l'œil — un rond vert ne dit pas si le consentement
                      est donné ou attendu. Sur une donnée qui engage
                      juridiquement, c'est le pire endroit pour deviner. */}
                  <td className={cellCls}>
                    {t.consentementFormation ? (
                      <AdminBadge tone="success" dot>
                        Donné
                      </AdminBadge>
                    ) : (
                      <AdminBadge tone="neutral" dot>
                        Non recueilli
                      </AdminBadge>
                    )}
                  </td>
                  <td className={cellCls}>
                    <Link href={`${base}/${t.id}`} className="admin-button-ghost">
                      Gérer
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPageShell>
  );
}
