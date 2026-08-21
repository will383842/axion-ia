"use client";
// use-client: le glisser-déposer du critère 13 exige les événements HTML5
// `dragstart`/`drop`, qu'aucun Server Component ne peut produire. C'est le
// SECOND et dernier composant client de la console éditoriale.

/**
 * Console éditoriale — la grille où l'on DÉPLACE une publication (critère 13).
 *
 * > « Déplacer une publication du 12 au 14 par glisser-déposer : elle est
 * >   TOUJOURS AU 14 après rechargement. »
 *
 * Le mot qui compte est « après rechargement » : le critère ne juge pas
 * l'animation, il juge la PERSISTANCE. D'où le parti pris : on ne bricole pas
 * un état optimiste sophistiqué, on appelle l'action serveur et on rafraîchit.
 * Si l'écriture échoue, la publication revient visiblement à sa place — plutôt
 * que de rester au 14 à l'écran et au 12 en base, ce qui serait le pire des
 * deux mondes.
 *
 * ── Pourquoi une grille dédiée plutôt que `MonthGridCalendar` ─────────────
 *
 * `MonthGridCalendar` est une primitive PARTAGÉE (planning, contacts, …). Y
 * introduire du glisser-déposer imposerait du JavaScript client à tous ses
 * appelants, dont aucun ne l'a demandé. On duplique donc une grille — quelques
 * lignes — plutôt que d'alourdir trois écrans étrangers.
 *
 * ── L'accessibilité, qui n'est pas optionnelle ────────────────────────────
 *
 * Le glisser-déposer natif est INUTILISABLE au clavier et au lecteur d'écran.
 * Chaque publication porte donc aussi deux boutons « ← » et « → » qui la
 * déplacent d'un jour : le même geste, atteignable sans souris. La passe 3 du
 * protocole exige « la navigation entièrement au clavier, sans souris ».
 */

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface PublicationDeplacable {
  id: string;
  dayKey: string;
  heurePrevue: string;
  titreInterne: string;
  compteLibelle: string;
}

interface Props {
  annee: number;
  mois: number;
  publications: PublicationDeplacable[];
  /** Clé du jour courant, pour le mettre en avant. */
  aujourdhui: string;
  /** Action serveur de déplacement, passée depuis le Server Component. */
  deplacer: (input: {
    id: string;
    datePrevue: string;
  }) => Promise<{ data: unknown } | { error: string }>;
}

/** Grille lundi→dimanche, en UTC — cohérente avec les colonnes `@db.Date`. */
function construireGrille(annee: number, mois: number): (string | null)[] {
  const premier = new Date(Date.UTC(annee, mois - 1, 1));
  const nbJours = new Date(Date.UTC(annee, mois, 0)).getUTCDate();
  const decalage = (premier.getUTCDay() + 6) % 7; // lundi = 0

  const cases: (string | null)[] = Array.from({ length: decalage }, () => null);
  for (let j = 1; j <= nbJours; j += 1) {
    cases.push(`${annee}-${String(mois).padStart(2, "0")}-${String(j).padStart(2, "0")}`);
  }
  while (cases.length % 7 !== 0) cases.push(null);
  return cases;
}

/** `2026-09-12` + n jours → `2026-09-14`. En UTC, toujours. */
function decalerJour(cle: string, jours: number): string {
  const [a, m, j] = cle.split("-").map(Number);
  const d = new Date(Date.UTC(a as number, (m as number) - 1, j as number));
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function GrilleDeplacable({
  annee,
  mois,
  publications,
  aujourdhui,
  deplacer,
}: Props): React.ReactElement {
  const router = useRouter();
  const [enCours, demarrerTransition] = useTransition();
  const [saisie, setSaisie] = useState<string | null>(null);
  const [cible, setCible] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const parJour = new Map<string, PublicationDeplacable[]>();
  for (const p of publications) {
    const liste = parJour.get(p.dayKey);
    if (liste) liste.push(p);
    else parJour.set(p.dayKey, [p]);
  }

  const lancerDeplacement = useCallback(
    (id: string, vers: string) => {
      setErreur(null);
      demarrerTransition(async () => {
        const r = await deplacer({ id, datePrevue: vers });
        if ("error" in r) {
          // On DIT l'échec. Sans cela, la publication semblerait déplacée à
          // l'écran alors qu'elle serait restée en place en base.
          setErreur(r.error);
          return;
        }
        // `refresh()` relit depuis le serveur : ce qui s'affiche ensuite est
        // ce qui est RÉELLEMENT en base — c'est le critère, littéralement.
        router.refresh();
      });
    },
    [deplacer, router],
  );

  const cases = construireGrille(annee, mois);

  return (
    <div>
      {erreur && (
        <p
          role="alert"
          className="mb-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-destructive)] bg-[color:var(--color-admin-destructive-soft)] p-3 text-[color:var(--color-admin-destructive-fg)]"
        >
          {erreur}
        </p>
      )}

      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Glissez une publication sur un autre jour pour la replanifier. Au clavier, utilisez les
        boutons « jour précédent » et « jour suivant » de chaque publication.
      </p>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {JOURS.map((j) => (
          <div
            key={j}
            className="py-1 text-center text-[length:var(--text-admin-xs)] font-semibold tracking-wide text-[color:var(--color-admin-fg-muted)] uppercase"
          >
            {j}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1" aria-busy={enCours}>
        {cases.map((cle, index) => {
          if (!cle) {
            return (
              <div
                key={`vide-${index}`}
                aria-hidden="true"
                className="min-h-24 rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-surface-hover)]"
              />
            );
          }
          const dedans = parJour.get(cle) ?? [];
          const estCible = cible === cle;
          const estAujourdhui = cle === aujourdhui;

          return (
            <div
              key={cle}
              // La case EST une cible de dépôt : le rôle et le nom accessible
              // le disent, faute de quoi un lecteur d'écran ne voit qu'une
              // boîte muette. Les boutons « ← / → » de chaque publication
              // restent le chemin clavier ; cette case n'est qu'un raccourci
              // à la souris, d'où `tabIndex={-1}`.
              role="listbox"
              tabIndex={-1}
              aria-label={`Jour ${Number(cle.slice(-2))} — déposer ici pour replanifier`}
              onDragOver={(e) => {
                // Sans `preventDefault`, le navigateur REFUSE le dépôt — c'est
                // le piège classique du glisser-déposer HTML5.
                e.preventDefault();
                setCible(cle);
              }}
              onDragLeave={() => setCible((c) => (c === cle ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setCible(null);
                const id = e.dataTransfer.getData("text/plain") || saisie;
                if (id) lancerDeplacement(id, cle);
                setSaisie(null);
              }}
              className={[
                "min-h-24 rounded-[var(--radius-admin-md)] border p-1 transition-colors",
                estCible
                  ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-info-soft)]"
                  : "border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]",
                estAujourdhui ? "ring-2 ring-[color:var(--color-admin-accent)]" : "",
              ].join(" ")}
            >
              <div className="mb-1 text-right text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                {Number(cle.slice(-2))}
              </div>

              <ul className="space-y-1">
                {dedans.map((p) => (
                  <li
                    key={p.id}
                    role="option"
                    aria-selected={false}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", p.id);
                      e.dataTransfer.effectAllowed = "move";
                      setSaisie(p.id);
                    }}
                    onDragEnd={() => {
                      setSaisie(null);
                      setCible(null);
                    }}
                    className="cursor-grab rounded-[var(--radius-admin-sm)] bg-[color:var(--color-admin-info-soft)] p-1 text-[length:var(--text-admin-xs)] active:cursor-grabbing"
                    title={`${p.heurePrevue} — ${p.titreInterne} (${p.compteLibelle})`}
                  >
                    <span className="block truncate font-medium">{p.titreInterne}</span>
                    <span className="mt-0.5 flex items-center justify-between gap-1">
                      <span className="font-mono text-[color:var(--color-admin-fg-muted)]">
                        {p.heurePrevue}
                      </span>
                      {/* Le même geste, au clavier. Le glisser-déposer natif
                          est inutilisable au lecteur d'écran. */}
                      <span className="flex gap-0.5">
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => lancerDeplacement(p.id, decalerJour(cle, -1))}
                          aria-label={`Déplacer « ${p.titreInterne} » au jour précédent`}
                          className="px-1 leading-none hover:underline"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => lancerDeplacement(p.id, decalerJour(cle, 1))}
                          aria-label={`Déplacer « ${p.titreInterne} » au jour suivant`}
                          className="px-1 leading-none hover:underline"
                        >
                          →
                        </button>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
