"use client";
// use-client: sélection réactive et avance automatique sur choix unique.
// Simulateur de gains v2 — un écran, une question.
//
// ── Contraintes mobiles qui gouvernent ce composant ───────────────────────
// • AUCUN champ de saisie. Un clavier virtuel qui s'ouvre décale la mise en
//   page, masque la question et fait abandonner. Tout se répond au pouce.
// • Cible tactile de 60 px minimum (recommandation WCAG 2.5.8 : 44 px ; on
//   prend large, un dirigeant répond souvent en marchant).
// • Options empilées sur toute la largeur. Deux colonnes seulement à partir de
//   `sm`, et uniquement quand les libellés sont courts.
// • Avance automatique sur les choix uniques : un appui, on passe. Le bouton
//   « Continuer » ne subsiste que là où il est indispensable (choix multiple),
//   parce que chaque appui supplémentaire coûte des abandons.
//
// ── Accessibilité ─────────────────────────────────────────────────────────
// Les options sont des `<input type="radio">` / `<input type="checkbox">`
// natifs masqués visuellement : navigation au clavier, annonce du rôle et de
// l'état par le lecteur d'écran, et regroupement par `<fieldset>/<legend>` —
// tout cela gratuitement, sans une ligne de JavaScript d'accessibilité.

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Step } from "./steps";

interface ChoiceScreenProps {
  step: Step;
  selected: readonly string[];
  onSelect: (optionIds: readonly string[]) => void;
  /** Appelé par l'écran à choix multiple, une fois la sélection validée. */
  onContinue: () => void;
}

export function ChoiceScreen({ step, selected, onSelect, onContinue }: ChoiceScreenProps) {
  const isMulti = step.kind === "multi";
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  // Deux colonnes soit sur demande explicite de l'écran (listes longues à
  // libellés courts : secteur, effectif), soit quand tous les libellés sont
  // assez courts pour ne pas produire une grille irrégulière — plus pénible à
  // lire qu'une simple pile.
  const compact =
    step.twoColumns ||
    (!isMulti &&
      step.options.every((o) => o.labelFr.length <= 18 && !o.hintFr) &&
      step.options.length >= 4);

  const toggle = React.useCallback(
    (optionId: string) => {
      if (!isMulti) {
        onSelect([optionId]);
        return;
      }
      const next = new Set(selectedSet);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      onSelect([...next]);
    },
    [isMulti, onSelect, selectedSet],
  );

  const canContinue = !isMulti || selected.length >= step.minChoices;

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 block">
        <span className="block text-[26px] leading-[1.15] font-bold tracking-tight text-balance text-[var(--sim-fg)] sm:text-[32px]">
          {step.titleFr}
        </span>
      </legend>

      {step.hintFr ? (
        <p className="mb-7 text-[15px] leading-relaxed text-pretty text-[var(--sim-fg-soft)] sm:text-base">
          {step.hintFr}
        </p>
      ) : (
        <div className="mb-7" />
      )}

      {/* `grid-cols-2` sans préfixe : la densité est nécessaire DÈS le plus
          petit écran, c'est précisément là que le défilement coûte le plus. */}
      <div className={cn("grid gap-2.5", compact && "grid-cols-2")}>
        {step.options.map((option) => {
          const isSelected = selectedSet.has(option.id);
          return (
            <label
              key={option.id}
              className={cn(
                "group relative flex cursor-pointer rounded-2xl border-2 transition-colors",
                // ── Deux dispositions, pour une raison mesurée ──────────────
                // En deux colonnes, une cellule ne fait que 153 px au pouce.
                // Disposition en RANGÉE (emoji · libellé · pastille), il ne
                // restait que 4 px entre la fin du texte et la pastille : pas
                // un chevauchement au sens du DOM, mais l'œil en lit un — et un
                // mot long d'un seul tenant (« Comptabilité ») ne peut pas se
                // couper pour se rattraper.
                // En COLONNE, le libellé dispose de toute la largeur utile et
                // la contention disparaît, pour ~10 px de hauteur en plus par
                // cellule. Mesuré sur iPhone 13 (390 px).
                compact
                  ? "min-h-[76px] flex-col justify-center gap-1 px-3 py-3 pr-9"
                  : "min-h-[60px] items-center gap-3 px-4 py-3.5",
                // `focus-within` porte l'anneau : l'input réel est masqué, mais
                // il reste la cible du focus clavier.
                "focus-within:ring-terracotta focus-within:ring-2 focus-within:ring-offset-2",
                isSelected
                  ? "border-[var(--sim-accent-border)] bg-[var(--sim-accent-soft)]"
                  : "border-[var(--sim-border)] bg-[var(--sim-surface)] hover:border-[var(--sim-border-strong)] active:bg-[var(--sim-subtle)]",
              )}
            >
              <input
                type={isMulti ? "checkbox" : "radio"}
                name={step.id}
                value={option.id}
                checked={isSelected}
                onChange={() => toggle(option.id)}
                className="sr-only"
              />

              {option.emoji ? (
                <span aria-hidden="true" className="shrink-0 text-xl leading-none">
                  {option.emoji}
                </span>
              ) : null}

              <span className={cn("min-w-0", !compact && "flex-1")}>
                <span
                  className={cn(
                    "block leading-snug font-semibold text-balance",
                    compact ? "text-[15px]" : "text-[16px]",
                    isSelected ? "text-[var(--sim-accent-strong)]" : "text-[var(--sim-fg)]",
                  )}
                >
                  {option.labelFr}
                </span>
                {option.hintFr ? (
                  <span className="mt-0.5 block text-[13px] leading-snug text-[var(--sim-fg-muted)]">
                    {option.hintFr}
                  </span>
                ) : null}
              </span>

              {/* Pastille d'état — le seul repère visuel qui ne dépend pas de la
                  couleur, exigé pour les daltonismes (WCAG 1.4.1). En deux
                  colonnes elle sort du flux et se cale en haut à droite : elle
                  reste visible sans disputer sa largeur au libellé. */}
              <span
                aria-hidden="true"
                className={cn(
                  "flex shrink-0 items-center justify-center border-2 transition-colors",
                  isMulti ? "rounded-md" : "rounded-full",
                  compact ? "absolute top-3 right-3 h-5 w-5" : "h-6 w-6",
                  isSelected
                    ? "bg-terracotta text-paper border-[var(--sim-accent-border)]"
                    : "border-[var(--sim-border-strong)] bg-transparent",
                )}
              >
                {isSelected ? (
                  <Check className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={3} />
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {isMulti ? (
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className={cn(
            "bg-terracotta text-paper mt-6 flex min-h-[56px] w-full items-center justify-center rounded-full px-6 text-[16px] font-bold transition",
            "focus-visible:ring-terracotta focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "hover:bg-terracotta-deep disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          Continuer
        </button>
      ) : null}
    </fieldset>
  );
}
