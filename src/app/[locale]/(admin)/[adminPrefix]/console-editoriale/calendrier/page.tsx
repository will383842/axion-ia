// Console éditoriale — calendrier mensuel (lot 0, critères 4 et 5 du §7).
//
// 🔴 Zéro JavaScript client, et ce n'est pas une coquetterie : `MonthGridCalendar`
// est une grille RSC qui navigue par querystring, et le filtre d'identité est
// une simple série de liens. Un filtre en composant client aurait coûté un
// bundle pour trois valeurs mutuellement exclusives.

import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import {
  AdminPageShell,
  AdminPageHeader,
  AdminCard,
  AdminEmptyState,
  AdminButton,
  AdminBadge,
} from "@/components/admin/ui";
import { MonthGridCalendar, type MonthGridDay } from "@/components/admin/ui/MonthGridCalendar";
import { deplacerPublicationAction } from "@/server/actions/editorial/publications";
import { GrilleDeplacable } from "./GrilleDeplacable";
import { dayKeyOfGridDate } from "@/lib/calendar-grid";
import {
  listerPublicationsDuMois,
  compterParJour,
  estFiltreIdentite,
  moisVoisin,
  lireMois,
  lireAnnee,
  type FiltreIdentite,
} from "@/server/editorial/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

const FILTRES: { valeur: FiltreIdentite; libelle: string }[] = [
  { valeur: "toutes", libelle: "Toutes" },
  { valeur: "perso", libelle: "Personnel" },
  { valeur: "pro", libelle: "Professionnel" },
];

/** Construit une URL de la page en ne gardant que les paramètres utiles. */
function lien(
  base: string,
  annee: number,
  mois: number,
  identite: FiltreIdentite,
  jour?: string,
): string {
  const p = new URLSearchParams({ year: String(annee), month: String(mois) });
  if (identite !== "toutes") p.set("identite", identite);
  if (jour) p.set("jour", jour);
  return `${base}?${p.toString()}`;
}

export default async function CalendrierEditorialPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user) redirect(`/fr/${adminPrefix}/login`);

  const base = `/fr/${adminPrefix}/console-editoriale/calendrier`;

  // Le mois affiché par défaut est celui d'aujourd'hui — en UTC, pour rester
  // cohérent avec les colonnes `@db.Date` que la grille regroupe.
  const maintenant = new Date();
  const annee = lireAnnee(sp.year, maintenant.getUTCFullYear());
  const mois = lireMois(sp.month, maintenant.getUTCMonth() + 1);
  const identite = estFiltreIdentite(sp.identite);

  const publications = await listerPublicationsDuMois(annee, mois, identite);
  const parJour = compterParJour(publications);

  const jourSelectionne = sp.jour && /^\d{4}-\d{2}-\d{2}$/.test(sp.jour) ? sp.jour : null;
  // Le mode « replanifier » charge la grille déplaçable — et son JavaScript.
  // Consulter reste gratuit : c’est l’usage le plus fréquent, et il ne doit
  // pas payer le coût d’une fonctionnalité qu’il n’utilise pas.
  const modeDeplacement = sp.mode === "replanifier";
  const duJour = jourSelectionne ? publications.filter((p) => p.dayKey === jourSelectionne) : [];

  const jours: MonthGridDay[] = [...parJour.entries()].map(([dayKey, count]) => ({
    dayKey,
    count,
    href: lien(base, annee, mois, identite, dayKey),
    selected: dayKey === jourSelectionne,
  }));

  const precedent = moisVoisin(annee, mois, -1);
  const suivant = moisVoisin(annee, mois, 1);

  return (
    <AdminPageShell>
      <AdminPageHeader
        title={`Calendrier — ${MOIS[mois - 1]} ${annee}`}
        description={`${publications.length} publication${publications.length > 1 ? "s" : ""} ${
          identite === "toutes" ? "tous canaux confondus" : `sur l'identité « ${identite} »`
        }.`}
        actions={
          <AdminButton href={`/fr/${adminPrefix}/console-editoriale`} variant="ghost" size="sm">
            Tableau de bord
          </AdminButton>
        }
      />

      <AdminCard>
        {/* Navigation de mois — trois liens, aucun état client. */}
        <div className="mb-[var(--space-admin-4)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AdminButton
              href={lien(base, precedent.annee, precedent.mois, identite)}
              variant="ghost"
              size="sm"
            >
              ← {MOIS[precedent.mois - 1]}
            </AdminButton>
            <AdminButton
              href={lien(base, maintenant.getUTCFullYear(), maintenant.getUTCMonth() + 1, identite)}
              variant="ghost"
              size="sm"
            >
              Aujourd&apos;hui
            </AdminButton>
            <AdminButton
              href={lien(base, suivant.annee, suivant.mois, identite)}
              variant="ghost"
              size="sm"
            >
              {MOIS[suivant.mois - 1]} →
            </AdminButton>
            <AdminButton
              href={`${lien(base, annee, mois, identite)}${modeDeplacement ? "" : "&mode=replanifier"}`}
              variant={modeDeplacement ? "primary" : "ghost"}
              size="sm"
            >
              {modeDeplacement ? "Terminer" : "Replanifier"}
            </AdminButton>
          </div>

          {/* Le filtre d'identité — critère 5 du lot 0. */}
          <nav aria-label="Filtrer par identité" className="flex items-center gap-1">
            {FILTRES.map((f) => {
              const actif = f.valeur === identite;
              return (
                <Link
                  key={f.valeur}
                  href={lien(base, annee, mois, f.valeur)}
                  aria-current={actif ? "true" : undefined}
                  className={
                    actif
                      ? "rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-accent)] px-3 py-1.5 text-[length:var(--text-admin-sm)] font-semibold text-white"
                      : "rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] px-3 py-1.5 text-[length:var(--text-admin-sm)] hover:bg-[color:var(--color-admin-surface-hover)]"
                  }
                >
                  {f.libelle}
                </Link>
              );
            })}
          </nav>
        </div>

        {modeDeplacement && publications.length > 0 ? (
          <GrilleDeplacable
            annee={annee}
            mois={mois}
            aujourdhui={dayKeyOfGridDate(
              new Date(
                Date.UTC(
                  maintenant.getUTCFullYear(),
                  maintenant.getUTCMonth(),
                  maintenant.getUTCDate(),
                ),
              ),
            )}
            publications={publications.map((p) => ({
              id: p.id,
              dayKey: p.dayKey,
              heurePrevue: p.heurePrevue,
              titreInterne: p.titreInterne,
              compteLibelle: p.compteLibelle,
            }))}
            deplacer={deplacerPublicationAction}
          />
        ) : publications.length === 0 ? (
          <AdminEmptyState
            title={`Aucune publication en ${MOIS[mois - 1]} ${annee}`}
            description={
              identite === "toutes"
                ? "Ce mois est vide. Naviguez vers un autre mois, ou importez le dossier du trimestre avec « pnpm editorial:import »."
                : `Aucune publication sur l'identité « ${identite} » ce mois-ci. Le filtre « Toutes » montre les autres canaux.`
            }
            secondaryAction={
              identite !== "toutes" ? (
                <AdminButton href={lien(base, annee, mois, "toutes")} variant="ghost" size="sm">
                  Voir toutes les identités
                </AdminButton>
              ) : undefined
            }
          />
        ) : (
          <MonthGridCalendar
            year={annee}
            month={mois}
            days={jours}
            todayKey={dayKeyOfGridDate(
              new Date(
                Date.UTC(
                  maintenant.getUTCFullYear(),
                  maintenant.getUTCMonth(),
                  maintenant.getUTCDate(),
                ),
              ),
            )}
            unitLabel="publication"
          />
        )}

        {jourSelectionne && (
          <div className="mt-[var(--space-admin-6)]">
            <h2 className="admin-h2">Le {jourSelectionne.split("-").reverse().join("/")}</h2>
            {duJour.length === 0 ? (
              <p className="mt-2 text-[color:var(--color-admin-fg-muted)]">
                Aucune publication ce jour avec le filtre courant.
              </p>
            ) : (
              <ul className="mt-[var(--space-admin-3)] space-y-2">
                {duJour.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                          {p.heurePrevue}
                        </span>
                        <span className="truncate font-medium">{p.titreInterne}</span>
                      </div>
                      <div className="mt-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                        {p.compteLibelle}
                        {p.estReprise && " · reprise"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <AdminBadge tone={p.identite === "pro" ? "info" : "neutral"}>
                        {p.identite}
                      </AdminBadge>
                      <AdminBadge tone={p.statutAsset === "pret" ? "success" : "warning"}>
                        {p.statutAsset}
                      </AdminBadge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </AdminCard>
    </AdminPageShell>
  );
}
