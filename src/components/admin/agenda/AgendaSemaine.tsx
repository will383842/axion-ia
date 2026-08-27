/**
 * Vue semaine — sept colonnes proportionnelles au temps (2026-08-27).
 *
 * POURQUOI ELLE EXISTE ENTRE LE MOIS ET LE JOUR
 * ----------------------------------------------
 * Le mois répond à « quelle semaine est chargée ? », le jour à « que fais-je
 * aujourd'hui ? ». Aucun des deux ne répond à « où puis-je caser deux heures
 * cette semaine ? » — qui est la question qu'on se pose en décrochant le
 * téléphone. Il y faut sept journées côte à côte, à la même échelle, avec des
 * trous dont la taille se compare d'un coup d'œil.
 *
 * L'ÉCHELLE EST LA MÊME QUE CELLE DE LA FRISE DU JOUR
 * ---------------------------------------------------
 * 7 h → 21 h, comme `AgendaTimeline`. Passer d'une vue à l'autre ne demande donc
 * aucune réadaptation du regard : un bloc de deux heures a la même allure ici et
 * là. Les deux constantes sont volontairement dupliquées plutôt qu'importées :
 * si l'une devait changer un jour, ce serait un choix, pas un effet de bord.
 *
 * MOBILE
 * ------
 * Sept colonnes d'heures ne tiennent pas sur un téléphone. La grille défile donc
 * horizontalement dans son propre conteneur — jamais la page, dont le
 * débordement latéral est interdit par le budget.
 */

import Link from "next/link";
import type { AgendaItem } from "@/features/admin-agenda/types";
import { semaineDe, quantieme, type CleJour } from "@/features/admin-agenda/calendrier";

const HEURE_DEBUT = 7;
const HEURE_FIN = 21;
const AMPLITUDE_MINUTES = (HEURE_FIN - HEURE_DEBUT) * 60;
const HAUTEUR_REM = 40;
/** Sans plancher, un rendez-vous de 30 min sur 14 h ferait 3,6 % — un trait. */
const HAUTEUR_MIN_PCT = 3.4;

const JOURS_COURTS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;

const COULEUR_SOURCE: Record<AgendaItem["source"], string> = {
  calendly: "var(--color-admin-id-bleu)",
  google: "var(--color-admin-id-teal)",
  console: "var(--color-admin-id-terracotta)",
};

const FOND_SOURCE: Record<AgendaItem["source"], string> = {
  calendly: "var(--color-admin-id-bleu-soft)",
  google: "var(--color-admin-id-teal-soft)",
  console: "var(--color-admin-id-terracotta-soft)",
};

export interface AgendaSemaineProps {
  readonly base: string;
  readonly jour: CleJour;
  readonly aujourdhui: CleJour;
  readonly items: readonly AgendaItem[];
  readonly sources: readonly string[];
}

/**
 * Minutes depuis minuit à Paris.
 *
 * ⚠️ On demande l'heure ET les minutes : en français, une heure SEULE se rend
 * « 14 h », avec un suffixe qui fait rendre `NaN` à `Number()`. C'est
 * exactement ce qui a mis l'agenda à terre en production le 2026-08-27.
 * Avec les minutes, le format est « 14:30 » et le découpage est sûr.
 */
function minutesDepuisMinuitParis(d: Date): number {
  const f = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [h, m] = f.format(d).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function placer(debut: Date, fin: Date | null): { top: number; hauteur: number } {
  const d = minutesDepuisMinuitParis(debut) - HEURE_DEBUT * 60;
  // Sans fin connue, une demi-heure : la durée par défaut d'un rendez-vous ici.
  const duree = fin
    ? Math.max(15, minutesDepuisMinuitParis(fin) - minutesDepuisMinuitParis(debut))
    : 30;
  const top = Math.max(0, (d / AMPLITUDE_MINUTES) * 100);
  const hauteur = Math.max(HAUTEUR_MIN_PCT, (duree / AMPLITUDE_MINUTES) * 100);
  return { top: Math.min(top, 100 - HAUTEUR_MIN_PCT), hauteur: Math.min(hauteur, 100 - top) };
}

function heureCourte(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function AgendaSemaine({
  base,
  jour,
  aujourdhui,
  items,
  sources,
}: AgendaSemaineProps): React.ReactElement {
  const jours = semaineDe(jour);
  const heures = Array.from({ length: HEURE_FIN - HEURE_DEBUT + 1 }, (_, i) => HEURE_DEBUT + i);

  const parJour = new Map<CleJour, AgendaItem[]>();
  for (const it of items) {
    const liste = parJour.get(it.jour);
    if (liste) liste.push(it);
    else parJour.set(it.jour, [it]);
  }

  const url = (cle: CleJour): string => {
    const p = new URLSearchParams({ vue: "jour", jour: cle });
    if (sources.length > 0) p.set("sources", sources.join(","));
    return `${base}?${p.toString()}`;
  };

  return (
    <div className="overflow-x-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg)]">
      <div className="min-w-[44rem]">
        {/* En-têtes de colonnes — cliquables : un jour de la semaine mène à sa journée. */}
        <div className="grid grid-cols-[2.75rem_repeat(7,1fr)] border-b border-[color:var(--color-admin-border-strong)]">
          <div aria-hidden="true" />
          {jours.map((cle, i) => {
            const estAujourdhui = cle === aujourdhui;
            return (
              <Link
                key={cle}
                href={url(cle)}
                className={`flex flex-col items-center gap-[1px] border-l border-[color:var(--color-admin-border)] py-[var(--space-admin-2)] hover:bg-[color:var(--color-admin-hover)] ${
                  estAujourdhui ? "bg-[color:var(--color-admin-info-soft)]" : ""
                }`}
              >
                <span className="text-[length:var(--text-admin-xs)] tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase">
                  {JOURS_COURTS[i]}
                </span>
                <span
                  className={`flex h-[1.75rem] min-w-[1.75rem] items-center justify-center rounded-full text-[length:var(--text-admin-md)] tabular-nums ${
                    estAujourdhui
                      ? "bg-[color:var(--color-admin-accent)] font-bold text-[color:var(--color-admin-accent-fg)]"
                      : "font-medium"
                  }`}
                >
                  {quantieme(cle)}
                </span>
              </Link>
            );
          })}
        </div>

        <div
          className="relative grid grid-cols-[2.75rem_repeat(7,1fr)]"
          style={{ height: `${String(HAUTEUR_REM)}rem` }}
        >
          {/* Colonne des heures. */}
          <div className="relative">
            {heures.map((h, i) => (
              <span
                key={h}
                className="absolute right-[var(--space-admin-1)] -translate-y-1/2 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] tabular-nums"
                style={{ top: `${String((i / (heures.length - 1)) * 100)}%` }}
              >
                {String(h).padStart(2, "0")}h
              </span>
            ))}
          </div>

          {jours.map((cle) => {
            const duJour = (parJour.get(cle) ?? []).filter((it) => !it.journeeEntiere && it.debut);
            const pleinJour = (parJour.get(cle) ?? []).filter((it) => it.journeeEntiere);
            const estAujourdhui = cle === aujourdhui;
            return (
              <div
                key={cle}
                className={`relative border-l border-[color:var(--color-admin-border)] ${
                  estAujourdhui ? "bg-[color:var(--color-admin-bg-subtle)]" : ""
                }`}
              >
                {/* Lignes d'heures — repères visuels, purement décoratifs. */}
                {heures.slice(0, -1).map((h, i) => (
                  <div
                    key={h}
                    aria-hidden="true"
                    className="absolute inset-x-0 border-t border-[color:var(--color-admin-border)] opacity-50"
                    style={{ top: `${String((i / (heures.length - 1)) * 100)}%` }}
                  />
                ))}

                {pleinJour.map((it) => (
                  <span
                    key={it.key}
                    className="absolute inset-x-[2px] top-[2px] truncate rounded-[var(--radius-admin-sm)] px-[3px] text-[length:var(--text-admin-xs)]"
                    style={{
                      backgroundColor: FOND_SOURCE[it.source],
                      borderLeft: `3px solid ${COULEUR_SOURCE[it.source]}`,
                    }}
                  >
                    {it.titre}
                  </span>
                ))}

                {duJour.map((it) => {
                  const { top, hauteur } = placer(it.debut as Date, it.fin);
                  return (
                    <Link
                      key={it.key}
                      href={it.detailHref ?? url(cle)}
                      title={`${heureCourte(it.debut)} – ${heureCourte(it.fin)} · ${it.titre}`}
                      className={`absolute inset-x-[2px] flex flex-col overflow-hidden rounded-[var(--radius-admin-sm)] px-[3px] py-[1px] text-[length:var(--text-admin-xs)] leading-tight hover:brightness-95 ${
                        it.annule ? "line-through opacity-60" : ""
                      }`}
                      style={{
                        top: `${String(top)}%`,
                        height: `${String(hauteur)}%`,
                        backgroundColor: FOND_SOURCE[it.source],
                        borderLeft: `3px solid ${COULEUR_SOURCE[it.source]}`,
                        color: "var(--color-admin-fg)",
                      }}
                    >
                      <span className="truncate tabular-nums opacity-75">
                        {heureCourte(it.debut)}
                      </span>
                      <span className="truncate font-medium">{it.titre}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
