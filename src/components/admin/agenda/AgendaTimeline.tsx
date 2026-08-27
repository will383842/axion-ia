/**
 * Frise horaire d'une journée — le cœur visuel de l'Agenda (2026-08-26).
 *
 * POURQUOI UNE FRISE ET PAS UNE LISTE
 * -----------------------------------
 * Une liste répond à « qu'est-ce que j'ai ? ». Elle ne répond pas à « où
 * suis-je libre ? », qui est la question posée : les trous n'y ont pas de
 * taille, donc deux heures de battement et dix minutes se ressemblent. Sur une
 * frise proportionnelle, le vide est visible et mesurable — c'est tout l'intérêt.
 *
 * AUCUN JAVASCRIPT, DÉLIBÉRÉMENT
 * ------------------------------
 * Ce composant est un composant serveur. Le seul élément qui aurait justifié du
 * client — le trait de l'heure courante — est calculé au rendu, et la page est
 * `force-dynamic` : il est donc juste à l'affichage. Le rendre interactif
 * coûterait un bundle client pour faire avancer un trait de quelques pixels par
 * minute. Le budget `First Load JS` de la console n'a pas à payer ça.
 *
 * MOBILE D'ABORD
 * --------------
 * La colonne des heures est étroite (2,75 rem) et les blocs occupent tout le
 * reste. Un bloc court garde une hauteur minimale lisible : sans plancher, un
 * rendez-vous de 30 minutes sur une amplitude de 14 heures ferait 3,6 % de la
 * hauteur — un trait, illisible et intouchable au doigt.
 */

import Link from "next/link";
import { AGENDA_SOURCE_LABELS, type AgendaItem } from "@/features/admin-agenda/types";
import { RetirerIndisponibiliteButton } from "./RetirerIndisponibiliteButton";
import { RendezVousForm } from "./RendezVousForm";

/**
 * Amplitude affichée. 7 h → 21 h couvre la plage réservable (9 h – 19 h) avec
 * deux heures de marge de chaque côté, pour qu'un rendez-vous tôt ou tard ne
 * soit pas coupé par le bord.
 */
const HEURE_DEBUT = 7;
const HEURE_FIN = 21;
const AMPLITUDE_MINUTES = (HEURE_FIN - HEURE_DEBUT) * 60;

/** Hauteur de la frise, en rem. ~3,2 rem par heure : lisible au pouce. */
const HAUTEUR_REM = 45;

/** Hauteur plancher d'un bloc, en pourcentage de la frise. */
const HAUTEUR_MIN_PCT = 3.4;

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

/**
 * « HH:MM » a Paris, pour pre-remplir un `<input type="time">`.
 *
 * ⚠️ On demande l'heure ET les minutes. En francais, une heure SEULE se rend
 * « 14 h » : c'est ce suffixe qui a mis l'agenda a terre en production le
 * 2026-08-27. Avec les minutes, le format est « 14:30 » et il alimente
 * directement le champ.
 */
function heureSaisie(d: Date | null): string {
  if (!d) return "09:00";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function heureParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Position et hauteur d'un bloc, en pourcentage de l'amplitude affichée. */
function placer(debut: Date, fin: Date | null): { top: number; hauteur: number } {
  const d = minutesDepuisMinuitParis(debut) - HEURE_DEBUT * 60;
  // Sans fin connue, on donne au bloc une demi-heure : la durée par défaut d'un
  // rendez-vous ici. Le faire disparaître serait pire que l'approximer.
  const duree = fin
    ? Math.max(1, minutesDepuisMinuitParis(fin) - minutesDepuisMinuitParis(debut))
    : 30;
  const top = Math.max(0, (d / AMPLITUDE_MINUTES) * 100);
  const brute = (duree / AMPLITUDE_MINUTES) * 100;
  return { top, hauteur: Math.max(HAUTEUR_MIN_PCT, Math.min(100 - top, brute)) };
}

/** Classes de couleur par source — le badge ne porte jamais seul l'information. */
function styleSource(item: AgendaItem): string {
  if (item.annule) {
    return "border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-2)] text-[color:var(--color-admin-fg-muted)] line-through";
  }
  switch (item.source) {
    case "calendly":
      return "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-info-soft)] text-[color:var(--color-admin-fg)]";
    case "console":
      // Rayé : une indisponibilité n'est pas un rendez-vous, elle doit se lire
      // comme une plage barrée même sans lire son libellé.
      return "border-[color:var(--color-admin-border-strong)] bg-[image:repeating-linear-gradient(45deg,var(--color-admin-surface-2)_0,var(--color-admin-surface-2)_6px,var(--color-admin-bg-subtle)_6px,var(--color-admin-bg-subtle)_12px)] text-[color:var(--color-admin-fg-muted)]";
    default:
      return "border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-surface-2)] text-[color:var(--color-admin-fg)]";
  }
}

export interface AgendaTimelineProps {
  readonly items: readonly AgendaItem[];
  /** `true` quand la journée affichée est aujourd'hui — pilote le trait d'heure. */
  readonly estAujourdhui: boolean;
  /** Instant du rendu, injectable pour les tests. */
  readonly maintenant?: Date;
}

export function AgendaTimeline({
  items,
  estAujourdhui,
  maintenant = new Date(),
}: AgendaTimelineProps): React.ReactElement {
  const heures = Array.from({ length: HEURE_FIN - HEURE_DEBUT + 1 }, (_, i) => HEURE_DEBUT + i);

  const journeeEntiere = items.filter((i) => i.journeeEntiere);
  const horaires = items.filter((i) => !i.journeeEntiere && i.debut);

  const minutesNow = minutesDepuisMinuitParis(maintenant) - HEURE_DEBUT * 60;
  const traitVisible = estAujourdhui && minutesNow >= 0 && minutesNow <= AMPLITUDE_MINUTES;
  const traitTop = (minutesNow / AMPLITUDE_MINUTES) * 100;

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      {journeeEntiere.length > 0 && (
        <ul className="flex flex-col gap-[var(--space-admin-2)]">
          {journeeEntiere.map((i) => (
            <li
              key={i.key}
              className={`rounded-[var(--radius-admin-sm)] border px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] ${styleSource(i)}`}
            >
              <span className="font-medium">{i.titre}</span>
              <span className="ml-[var(--space-admin-2)] opacity-70">toute la journée</span>
            </li>
          ))}
        </ul>
      )}

      <div
        className="relative flex"
        style={{ height: `${HAUTEUR_REM}rem` }}
        role="list"
        aria-label="Rendez-vous de la journée, par heure"
      >
        {/* Colonne des heures + lignes de fond. `aria-hidden` : ce sont des
            repères visuels, les horaires réels sont dans chaque bloc. */}
        <div className="relative w-[2.75rem] shrink-0" aria-hidden>
          {heures.map((h) => (
            <div
              key={h}
              className="absolute -translate-y-1/2 text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)] tabular-nums"
              style={{ top: `${(((h - HEURE_DEBUT) * 60) / AMPLITUDE_MINUTES) * 100}%` }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        <div className="relative flex-1 border-l border-[color:var(--color-admin-border)]">
          {heures.map((h) => (
            <div
              key={h}
              aria-hidden
              className="absolute right-0 left-0 border-t border-[color:var(--color-admin-border-default)]"
              style={{ top: `${(((h - HEURE_DEBUT) * 60) / AMPLITUDE_MINUTES) * 100}%` }}
            />
          ))}

          {traitVisible && (
            <div
              className="absolute right-0 left-0 z-10 border-t-2 border-[color:var(--color-admin-danger)]"
              style={{ top: `${traitTop}%` }}
            >
              <span className="sr-only">Il est {heureParis(maintenant)}</span>
              <span
                aria-hidden
                className="absolute -top-[4px] -left-[4px] h-[7px] w-[7px] rounded-full bg-[color:var(--color-admin-danger)]"
              />
            </div>
          )}

          {horaires.length === 0 && (
            <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
              Aucun rendez-vous ce jour-là.
            </p>
          )}

          {horaires.map((i) => {
            const { top, hauteur } = placer(i.debut as Date, i.fin);
            const contenu = (
              <>
                <span className="block truncate font-medium">{i.titre}</span>
                <span className="block truncate text-[length:var(--text-admin-xs)] tabular-nums opacity-80">
                  {heureParis(i.debut as Date)}
                  {i.fin ? ` – ${heureParis(i.fin)}` : ""} · {AGENDA_SOURCE_LABELS[i.source]}
                  {i.annule ? " · annulé" : ""}
                </span>
              </>
            );
            return (
              <div
                key={i.key}
                role="listitem"
                className={`absolute right-[var(--space-admin-2)] left-[var(--space-admin-2)] overflow-hidden rounded-[var(--radius-admin-sm)] border px-[var(--space-admin-2)] py-[2px] text-[length:var(--text-admin-sm)] ${styleSource(i)}`}
                style={{ top: `${top}%`, height: `${hauteur}%` }}
              >
                {i.detailHref ? (
                  <Link
                    href={i.detailHref}
                    className="block h-full focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {contenu}
                  </Link>
                ) : (
                  contenu
                )}
                {/* Retrait proposé UNIQUEMENT sur les blocages posés par la
                    console : `googleEventId` n'est renseigné que là (cf.
                    `features/admin-agenda/queries.ts`). Un vrai rendez-vous ne
                    doit pas offrir de bouton de suppression — la console n'a
                    aucune raison légitime d'en effacer un, et une suppression
                    d'agenda ne se rattrape pas. Le serveur revérifie de toute
                    façon avant de supprimer : cette condition est du confort,
                    pas la garde. */}
                {i.googleEventId && (
                  <span className="mt-[2px] flex flex-wrap gap-[var(--space-admin-2)]">
                    {/* Modification proposee a la meme condition que le retrait,
                        et pour la meme raison : seul ce que la console a pose
                        peut etre reecrit ici. Le formulaire s'ouvre PRE-REMPLI,
                        note comprise — sinon enregistrer effacerait la note
                        existante sans que rien ne l'ait annonce. */}
                    <RendezVousForm
                      jour={i.jour}
                      actif
                      existant={{
                        eventId: i.googleEventId,
                        titre: i.titre,
                        heureDebut: heureSaisie(i.debut),
                        heureFin: heureSaisie(i.fin),
                        contact: i.contact ?? "",
                        telephone: i.telephone ?? "",
                        note: i.note ?? "",
                      }}
                    />
                    <RetirerIndisponibiliteButton eventId={i.googleEventId} titre={i.titre} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
