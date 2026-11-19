"use client";
// use-client: groupe de boutons radio contrôlé (gestionnaires d événements).

/**
 * Étape 1 — « Que vendez-vous ? » (fiche E08). Vrais boutons radio (flèches du clavier) habillés
 * en cartes, dans un groupe nommé. Aucun montant : le modèle ne fait que poser l'activité ; les
 * lignes se chiffrent à la main. Le choix se lit sans la couleur : coche visible, texte gras,
 * contour en mode contraste forcé ; la place de la coche est réservée (CLS = 0).
 */
import { Bot, Check, ClipboardCheck, GraduationCap, Globe, UserRound } from "lucide-react";
import type { Dispatch } from "react";

import { AdminCard } from "@/components/admin/ui/AdminCard";

import type { ActionAssistant } from "../../etat";
import { MODELES_ACTIVITE } from "../../modeles";
import type { EtatAssistant } from "../../types";

export interface PropsChoixModele {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
}

const ICONES = {
  formation: GraduationCap,
  un_a_un: UserRound,
  audit: ClipboardCheck,
  implementation: Bot,
  site_web: Globe,
} as const;

export function ChoixModele({ etat, dispatch }: PropsChoixModele) {
  return (
    <AdminCard as="section" variant="informational">
      <div role="radiogroup" aria-labelledby="titre-modele">
        <h3
          id="titre-modele"
          className="mb-[var(--space-admin-4,8px)] text-[length:var(--text-admin-lg)] font-semibold"
        >
          Que vendez-vous ?
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {MODELES_ACTIVITE.map((m) => {
            const id = `modele-${m.activite}`;
            const Icone = (ICONES as Record<string, typeof Bot>)[m.activite];
            return (
              <label
                key={m.activite}
                htmlFor={id}
                className="group relative flex min-h-[132px] cursor-pointer flex-col items-start gap-3 rounded-[var(--radius-admin-md)] border-2 border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3 transition-colors hover:bg-[color:var(--color-admin-paper-alt)] has-[:checked]:border-[color:var(--color-admin-accent)] has-[:checked]:font-semibold has-[:checked]:ring-4 has-[:checked]:ring-[color:var(--color-admin-accent-track)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 forced-colors:has-[:checked]:outline forced-colors:has-[:checked]:outline-2"
              >
                <input
                  id={id}
                  type="radio"
                  name="modele-devis"
                  className="sr-only"
                  aria-describedby={`${id}-detail`}
                  checked={etat.modele === m.activite}
                  onChange={() => dispatch({ type: "modele", modele: m.activite })}
                />
                <span className="flex w-full items-start justify-between">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-accent-track)] text-[color:var(--color-admin-fg)]"
                  >
                    {Icone ? <Icone size={22} /> : null}
                  </span>
                  <Check
                    size={20}
                    aria-hidden="true"
                    className="invisible text-[color:var(--color-admin-accent)] group-has-[:checked]:visible"
                  />
                </span>
                <span className="font-medium">{m.libelle}</span>
                <span id={`${id}-detail`} className="sr-only">
                  {m.detail}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </AdminCard>
  );
}
