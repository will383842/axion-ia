/**
 * Vue mois — la vision d'ensemble qui manquait (2026-08-27).
 *
 * CE QU'ELLE DOIT RÉPONDRE, ET QUE LA FRISE DU JOUR NE POUVAIT PAS
 * ----------------------------------------------------------------
 * « Où suis-je libre le mois prochain ? », « quelle semaine est chargée ? »,
 * « ai-je bloqué la semaine de la formation ? ». Ces questions se posent sur
 * trente jours, pas sur un. Une frise horaire, si bonne soit-elle, ne les
 * atteint jamais : elle montre une journée à la fois.
 *
 * TROIS PARTIS PRIS
 * -----------------
 * 1. **Six lignes, toujours.** Une grille qui passe de 5 à 6 semaines selon le
 *    mois fait sauter tout ce qui la suit à chaque navigation. Le budget de la
 *    console impose `CLS = 0` ; la hauteur est donc constante, et les jours hors
 *    du mois affiché sont estompés plutôt que retirés.
 *
 * 2. **La densité se lit avant le détail.** Chaque cellule porte jusqu'à trois
 *    pastilles nommées, puis un « +N ». Au-delà, lire les titres dans une case de
 *    la taille d'un timbre ne sert personne — c'est le panneau latéral qui prend
 *    le relais.
 *
 * 3. **Le clic ne recharge rien.** Chaque jour est un `Link` : le routeur de Next
 *    ne rejoue que le rendu serveur du segment, l'écran ne clignote pas, et le
 *    panneau se met à jour. Aucun composant client, aucun octet de bundle.
 *
 * LE CONTRASTE EST UN CHOIX, PAS UNE DÉCORATION
 * ----------------------------------------------
 * Trois couleurs d'identité distinguent les sources — réservation, personnel,
 * blocage — parce que ce sont trois choses qu'on ne traite pas pareil. Mais la
 * couleur ne porte jamais seule : chaque pastille est aussi nommée, et le jour
 * courant est marqué par une bordure épaisse en plus de sa teinte. Un agenda
 * doit rester lisible en niveaux de gris et pour qui distingue mal les couleurs.
 */

import Link from "next/link";
import type { AgendaItem } from "@/features/admin-agenda/types";
import {
  grilleDuMois,
  memeMois,
  quantieme,
  semaineDe,
  type CleJour,
  type VueAgenda,
} from "@/features/admin-agenda/calendrier";

const JOURS_COURTS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"] as const;

/** Combien de pastilles nommées avant de basculer sur un compteur. */
const PASTILLES_MAX = 3;

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

export interface AgendaMoisProps {
  readonly base: string;
  readonly jour: CleJour;
  readonly aujourdhui: CleJour;
  readonly items: readonly AgendaItem[];
  readonly sources: readonly string[];
}

function heureCourte(d: Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function urlJour(base: string, vue: VueAgenda, cle: CleJour, sources: readonly string[]): string {
  const p = new URLSearchParams({ vue, jour: cle });
  if (sources.length > 0) p.set("sources", sources.join(","));
  return `${base}?${p.toString()}`;
}

export function AgendaMois({
  base,
  jour,
  aujourdhui,
  items,
  sources,
}: AgendaMoisProps): React.ReactElement {
  const cellules = grilleDuMois(jour);

  // Un index par jour plutôt qu'un filtre dans chaque cellule : 42 filtres sur
  // la liste complète, c'est 42 parcours pour un seul qui suffit.
  const parJour = new Map<CleJour, AgendaItem[]>();
  for (const it of items) {
    const liste = parJour.get(it.jour);
    if (liste) liste.push(it);
    else parJour.set(it.jour, [it]);
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)] lg:flex-row">
      <div className="min-w-0 flex-1">
        {/* En-tête des jours de semaine. */}
        <div className="grid grid-cols-7 gap-[2px] pb-[2px]">
          {JOURS_COURTS.map((j) => (
            <div
              key={j}
              className="px-[var(--space-admin-1)] py-[var(--space-admin-1)] text-center text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
            >
              {j}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-[2px] overflow-hidden rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-border-strong)]">
          {cellules.map((cle) => {
            const duJour = parJour.get(cle) ?? [];
            const dansLeMois = memeMois(cle, jour);
            const estAujourdhui = cle === aujourdhui;
            const estSelectionne = cle === jour;
            const visibles = duJour.slice(0, PASTILLES_MAX);
            const reste = duJour.length - visibles.length;

            return (
              <Link
                key={cle}
                href={urlJour(base, "mois", cle, sources)}
                aria-current={estSelectionne ? "date" : undefined}
                aria-label={`${cle} — ${String(duJour.length)} événement${duJour.length > 1 ? "s" : ""}`}
                className={`flex min-h-[5.5rem] flex-col gap-[2px] p-[var(--space-admin-1)] transition-colors ${
                  dansLeMois
                    ? "bg-[color:var(--color-admin-bg)]"
                    : "bg-[color:var(--color-admin-bg-subtle)]"
                } ${
                  estSelectionne
                    ? "outline outline-2 -outline-offset-2 outline-[color:var(--color-admin-accent)]"
                    : "hover:bg-[color:var(--color-admin-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-full px-[0.25rem] text-[length:var(--text-admin-sm)] tabular-nums ${
                      estAujourdhui
                        ? "bg-[color:var(--color-admin-accent)] font-bold text-[color:var(--color-admin-accent-fg)]"
                        : dansLeMois
                          ? "font-medium text-[color:var(--color-admin-fg)]"
                          : "text-[color:var(--color-admin-fg-disabled)]"
                    }`}
                  >
                    {quantieme(cle)}
                  </span>
                  {duJour.length > 0 && (
                    <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] tabular-nums">
                      {duJour.length}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-[1px]">
                  {visibles.map((it) => (
                    <span
                      key={it.key}
                      className={`flex items-center gap-[3px] truncate rounded-[var(--radius-admin-sm)] px-[3px] py-[1px] text-[length:var(--text-admin-xs)] ${
                        it.annule ? "line-through opacity-60" : ""
                      }`}
                      style={{
                        backgroundColor: FOND_SOURCE[it.source],
                        color: "var(--color-admin-fg)",
                        borderLeft: `3px solid ${COULEUR_SOURCE[it.source]}`,
                      }}
                    >
                      {!it.journeeEntiere && (
                        <span className="shrink-0 tabular-nums opacity-70">
                          {heureCourte(it.debut)}
                        </span>
                      )}
                      <span className="truncate">{it.titre}</span>
                    </span>
                  ))}
                  {reste > 0 && (
                    <span className="px-[3px] text-[length:var(--text-admin-xs)] font-medium text-[color:var(--color-admin-fg-muted)]">
                      +{reste} autre{reste > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <p className="pt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Cliquez sur un jour pour le détailler à droite. La semaine en cours va du{" "}
          {semaineDe(aujourdhui)[0]} au {semaineDe(aujourdhui)[6]}.
        </p>
      </div>

      <PanneauJour
        base={base}
        jour={jour}
        aujourdhui={aujourdhui}
        items={parJour.get(jour) ?? []}
      />
    </div>
  );
}

/**
 * Panneau latéral — le détail du jour sélectionné, sans quitter la vue mois.
 *
 * Il tient le rôle qu'aurait joué un composant client : on clique un jour, le
 * détail apparaît, la grille reste à l'écran. La différence est qu'il ne coûte
 * rien — c'est le rendu serveur du segment qui se rejoue, pas un état local.
 */
function PanneauJour({
  base,
  jour,
  aujourdhui,
  items,
}: {
  readonly base: string;
  readonly jour: CleJour;
  readonly aujourdhui: CleJour;
  readonly items: readonly AgendaItem[];
}): React.ReactElement {
  const libelle = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${jour}T12:00:00Z`));

  return (
    <aside
      aria-label={`Détail du ${libelle}`}
      className="flex w-full shrink-0 flex-col gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg)] p-[var(--space-admin-3)] lg:w-[20rem]"
    >
      <div className="flex items-baseline justify-between gap-[var(--space-admin-2)]">
        <h3 className="text-[length:var(--text-admin-md)] font-semibold first-letter:uppercase">
          {libelle}
        </h3>
        {jour === aujourdhui && (
          <span className="rounded-full bg-[color:var(--color-admin-info-soft)] px-[var(--space-admin-2)] py-[1px] text-[length:var(--text-admin-xs)] font-medium">
            aujourd&apos;hui
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucun rendez-vous ce jour-là.
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-2)]">
          {items.map((it) => (
            <li
              key={it.key}
              className="flex flex-col gap-[2px] rounded-[var(--radius-admin-sm)] p-[var(--space-admin-2)]"
              style={{
                backgroundColor: FOND_SOURCE[it.source],
                borderLeft: `3px solid ${COULEUR_SOURCE[it.source]}`,
              }}
            >
              <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] tabular-nums">
                {it.journeeEntiere
                  ? "toute la journée"
                  : `${heureCourte(it.debut)} – ${heureCourte(it.fin)}`}
              </span>
              <span
                className={`text-[length:var(--text-admin-sm)] font-medium ${it.annule ? "line-through opacity-70" : ""}`}
              >
                {it.detailHref ? (
                  <Link href={it.detailHref} className="underline underline-offset-2">
                    {it.titre}
                  </Link>
                ) : (
                  it.titre
                )}
              </span>
              {it.contact && (
                <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                  {it.contact}
                  {it.telephone ? ` · ${it.telephone}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Link
        href={`${base}?vue=jour&jour=${jour}`}
        className="mt-auto rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-center text-[length:var(--text-admin-sm)] font-medium hover:bg-[color:var(--color-admin-hover)]"
      >
        Ouvrir la journée
      </Link>
    </aside>
  );
}
