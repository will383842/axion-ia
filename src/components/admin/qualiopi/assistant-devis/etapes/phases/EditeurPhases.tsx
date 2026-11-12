"use client";
// use-client: éditeur de lignes contrôlées (modèles, ajout/retrait, focus après retrait).

/**
 * Éditeur de phases (fiche E11), pour l'étape 1b et pour l'échéancier de la formule B.
 * Contrôlé : l'état vit dans l'assistant, l'éditeur reçoit `phases` et rend `onChange`.
 *
 * Les montants PAR PHASE ne se calculent pas ici (D-architecte : ils viennent de l'aperçu
 * serveur, S07) ; `montants` est une PROP, affichée telle quelle. Le total des pourcentages
 * n'est pas un montant : il est sommé ici et doit valoir 100.
 */
import { useEffect, useRef, useState } from "react";

import {
  MODELES_ECHEANCIER,
  MODELES_PHASES,
  phasesDepuisModele,
  type ModelePhases,
} from "../../modeles";
import type { PhaseAssistant } from "../../types";

export interface ModeleProposable {
  cle: string;
  modele: ModelePhases;
}

/** Les six modèles de l'étape 1b : découpage du travail, puis échéanciers courts. */
export const MODELES_PAR_DEFAUT: readonly ModeleProposable[] = [
  { cle: "complet", modele: MODELES_PHASES.complet },
  { cle: "court", modele: MODELES_PHASES.court },
  { cle: "cent", modele: MODELES_ECHEANCIER.cent },
  { cle: "moitie", modele: MODELES_ECHEANCIER.moitie },
  { cle: "trente", modele: MODELES_ECHEANCIER.trente_trente_solde },
  { cle: "composer", modele: MODELES_PHASES.composer },
];

export interface PropsEditeurPhases {
  phases: readonly PhaseAssistant[];
  onChange: (phases: PhaseAssistant[]) => void;
  /** Sert d'identifiant de zone et de préfixe d'étiquettes (ex. « Phases »). */
  nom: string;
  modeles?: readonly ModeleProposable[];
  /** Centimes par phase, calculés par le SERVEUR ; absent = colonne masquée, `null` = pas encore connu. */
  montants?: ReadonlyArray<number | null> | undefined;
  /** Sans livrable ni délai (échéancier de la formule B). */
  compact?: boolean | undefined;
}

const entier = (s: string): number | null => (/^\d+$/.test(s.trim()) ? Number(s) : null);
/** Un versement vaut au moins 1 % et au plus 100 % (une phase à 0 % n'est pas un versement). */
const pctValide = (s: string): boolean => {
  const n = entier(s);
  return n !== null && n >= 1 && n <= 100;
};
const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** Phases laissées telles quelles par le départ ou issues d'un modèle : rien à perdre à les remplacer. */
function estIntacte(
  phases: readonly PhaseAssistant[],
  modeles: readonly ModeleProposable[],
): boolean {
  if (
    phases.every(
      (p) =>
        p.livrable.trim() === "" && p.delaiSemaines === "" && ["", "Solde"].includes(p.libelle),
    )
  ) {
    return phases.length <= 1;
  }
  return modeles.some(
    ({ modele }) =>
      modele.phases.length === phases.length &&
      modele.phases.every((m, i) => {
        const p = phases[i]!;
        return (
          p.libelle === m.libelle &&
          p.livrable === m.livrable &&
          p.delaiSemaines === (m.delaiSemaines > 0 ? String(m.delaiSemaines) : "") &&
          p.pourcentage === String(m.pourcentage)
        );
      }),
  );
}

const rediges = (p: PhaseAssistant): boolean =>
  p.libelle.trim() !== "" || p.livrable.trim() !== "" || p.delaiSemaines !== "";

export function EditeurPhases({
  phases,
  onChange,
  nom,
  modeles = MODELES_PAR_DEFAUT,
  montants,
  compact,
}: PropsEditeurPhases) {
  const [attente, setAttente] = useState<ModeleProposable | null>(null);
  const [aRetirer, setARetirer] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLInputElement>());
  const focusApres = useRef<string | null>(null);
  const compteur = useRef(0);
  // Boutons de confirmation du retrait : le bouton cliqué disparaît, le focus ne doit pas tomber sur la page.
  const refGarder = useRef<HTMLButtonElement>(null);
  const refRetirer = useRef(new Map<string, HTMLButtonElement>());
  const focusConfirmation = useRef<"garder" | { retirer: string } | null>(null);

  useEffect(() => {
    const id = focusApres.current;
    if (id === null) return;
    focusApres.current = null;
    refs.current.get(id)?.focus();
  }, [phases]);

  useEffect(() => {
    const f = focusConfirmation.current;
    if (f === null) return;
    focusConfirmation.current = null;
    if (f === "garder") refGarder.current?.focus();
    else refRetirer.current.get(f.retirer)?.focus();
  }, [aRetirer]);

  const nouvelId = (): string => {
    let id: string;
    do {
      compteur.current += 1;
      id = `phase-n${compteur.current}`;
    } while (phases.some((p) => p.id === id));
    return id;
  };

  const maj = (id: string, patch: Partial<PhaseAssistant>) =>
    onChange(phases.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  function appliquer(m: ModeleProposable) {
    setAttente(null);
    onChange(phasesDepuisModele(m.modele, nouvelId));
  }

  function retirer(id: string) {
    const i = phases.findIndex((p) => p.id === id);
    if (phases.length <= 1 || i < 0) return;
    const voisine = phases[i - 1] ?? phases[i + 1];
    focusApres.current = voisine ? voisine.id : null;
    setARetirer(null);
    onChange(phases.filter((p) => p.id !== id));
  }

  const valeurs = phases.map((p) => entier(p.pourcentage));
  const illisible = phases.length === 0 || valeurs.some((v) => v === null);
  const horsBornes = phases.some((p) => !pctValide(p.pourcentage));
  const total = valeurs.reduce<number>((s, v) => s + (v ?? 0), 0);
  const juste = !illisible && total === 100 && !horsBornes;
  const repartition = phases.map((p) => `${entier(p.pourcentage) ?? 0} %`).join(", ");

  return (
    <section aria-label={nom} className="mb-[var(--space-admin-6,16px)]">
      <div className="mb-3 flex flex-wrap gap-2">
        {modeles.map((m) => (
          <button
            key={m.cle}
            type="button"
            className="min-h-[44px] rounded border px-3"
            onClick={() => (estIntacte(phases, modeles) ? appliquer(m) : setAttente(m))}
          >
            {m.modele.nom}
          </button>
        ))}
      </div>
      {attente ? (
        <div className="mb-3 rounded border p-3">
          <p>
            Remplacer vos phases par « {attente.modele.nom} » ? Ce que vous avez écrit sera perdu.
          </p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              className="min-h-[44px] rounded border px-3"
              onClick={() => appliquer(attente)}
            >
              Remplacer mes phases
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded border px-3"
              onClick={() => setAttente(null)}
            >
              Garder mes phases
            </button>
          </div>
        </div>
      ) : null}

      <ol className="list-none p-0">
        {phases.map((p, i) => {
          const rang = i + 1;
          return (
            <li key={p.id} className="mb-3 rounded border p-3">
              <div className="grid gap-3 sm:grid-cols-6">
                <label className="flex flex-col sm:col-span-2">
                  Phase {rang}
                  <input
                    ref={(el) => {
                      if (el) refs.current.set(p.id, el);
                      else refs.current.delete(p.id);
                    }}
                    className="min-h-[44px] rounded border px-2"
                    value={p.libelle}
                    onChange={(e) => maj(p.id, { libelle: e.target.value })}
                  />
                </label>
                {compact ? null : (
                  <label className="flex flex-col sm:col-span-2">
                    Livrable de la phase {rang}
                    <input
                      className="min-h-[44px] rounded border px-2"
                      value={p.livrable}
                      onChange={(e) => maj(p.id, { livrable: e.target.value })}
                    />
                  </label>
                )}
                {compact ? null : (
                  <label className="flex flex-col">
                    Délai de la phase {rang} (semaines)
                    <input
                      inputMode="numeric"
                      className="min-h-[44px] rounded border px-2"
                      value={p.delaiSemaines}
                      onChange={(e) => {
                        if (/^\d*$/.test(e.target.value))
                          maj(p.id, { delaiSemaines: e.target.value });
                      }}
                    />
                  </label>
                )}
                <label className="flex flex-col">
                  Versement de la phase {rang} (%)
                  <input
                    inputMode="numeric"
                    className="min-h-[44px] rounded border px-2"
                    value={p.pourcentage}
                    aria-invalid={!pctValide(p.pourcentage)}
                    aria-describedby={pctValide(p.pourcentage) ? undefined : `${nom}-pct-${p.id}`}
                    onChange={(e) => {
                      if (/^\d{0,3}$/.test(e.target.value))
                        maj(p.id, { pourcentage: e.target.value });
                    }}
                  />
                  {pctValide(p.pourcentage) ? null : (
                    <span id={`${nom}-pct-${p.id}`}>
                      Le versement doit être compris entre 1 et 100 %.
                    </span>
                  )}
                </label>
                {montants ? (
                  <p className="flex flex-col">
                    <span>Montant HT</span>
                    <span>{montants[i] == null ? "—" : EUROS.format(montants[i]! / 100)}</span>
                  </p>
                ) : null}
              </div>
              <div className="mt-2 flex gap-3">
                {aRetirer === p.id ? (
                  <>
                    <button
                      type="button"
                      className="min-h-[44px] rounded border px-3"
                      onClick={() => retirer(p.id)}
                    >
                      Confirmer le retrait
                    </button>
                    <button
                      type="button"
                      ref={refGarder}
                      className="min-h-[44px] rounded border px-3"
                      onClick={() => {
                        focusConfirmation.current = { retirer: p.id };
                        setARetirer(null);
                      }}
                    >
                      Garder la phase
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="min-h-[44px] rounded border px-3"
                    ref={(el) => {
                      if (el) refRetirer.current.set(p.id, el);
                      else refRetirer.current.delete(p.id);
                    }}
                    disabled={phases.length <= 1}
                    onClick={() => {
                      if (rediges(p)) {
                        focusConfirmation.current = "garder";
                        setARetirer(p.id);
                      } else retirer(p.id);
                    }}
                  >
                    Retirer la phase {rang}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        className="min-h-[44px] rounded border px-3"
        onClick={() =>
          onChange([
            ...phases,
            {
              id: nouvelId(),
              libelle: "",
              pourcentage: "0",
              declencheur: "avancement",
              livrable: "",
              delaiSemaines: "",
            },
          ])
        }
      >
        + Ajouter une phase
      </button>

      <div
        role="img"
        aria-label={`Répartition des versements : ${repartition}`}
        className="my-3 flex h-3 w-full overflow-hidden rounded border"
      >
        {phases.map((p, i) => (
          <span
            key={p.id}
            className={
              i % 2 === 0
                ? "bg-[color:var(--color-admin-accent)]"
                : "bg-[color:var(--color-admin-border)]"
            }
            style={{ width: `${Math.min(100, entier(p.pourcentage) ?? 0)}%` }}
          />
        ))}
      </div>
      <p className="font-medium">Total des versements : {total} %</p>
      {!juste ? (
        <p>
          {illisible
            ? "Chaque phase demande un pourcentage entier."
            : total !== 100
              ? `Le total des versements doit valoir 100 % (actuellement ${total} %).`
              : "Chaque versement doit être compris entre 1 et 100 %."}
        </p>
      ) : null}
      {/* Une seule annonce polie, sobre : le total, pas le message d'erreur qui change à chaque frappe. */}
      <p role="status" aria-live="polite" className="sr-only">
        Total : {total} % sur 100.
      </p>
    </section>
  );
}
