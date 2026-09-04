"use client";
// use-client: quatre champs dont la valeur recompose le lien à chaque frappe, et une copie dans le presse-papiers — intrinsèquement client.
//
// LA FABRIQUE DE LIENS DE CAMPAGNE.
//
// Will écrivait ses liens de publicité à la main, une fois, puis les perdait.
// Une faute de frappe dans `utm_content` ne casse RIEN : la page s'affiche, le
// visiteur candidate, et la seule chose détruite est la comparaison entre deux
// visuels — c'est-à-dire la décision de remettre ou non de l'argent dans une
// publicité.
//
// Cet écran ne stocke aucun lien : il les REDÉRIVE. Deux fois les mêmes choix
// donnent deux fois le même lien, donc « retrouver » un lien, c'est le refaire.
// Ce que la page montre en regard, ce sont les campagnes qui ont RÉELLEMENT
// amené quelqu'un (`features/campagnes/campagnes-vues.ts`).

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";

import { AdminButton } from "@/components/admin/ui/AdminButton";
import {
  CANAUX_CAMPAGNE,
  DESTINATIONS_CAMPAGNE,
  construireLienCampagne,
  type CanalCampagne,
  type DestinationCampagne,
} from "@/lib/campagnes/lien-campagne";

const CHAMP =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300 " +
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
const LABEL =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";

export function FabriqueLienCampagne({ origine }: { origine: string }) {
  const [destination, setDestination] = useState<DestinationCampagne>("apporteur-affaires");
  const [canal, setCanal] = useState<CanalCampagne>("facebook");
  const [campagne, setCampagne] = useState("");
  const [visuel, setVisuel] = useState("");
  const [copie, setCopie] = useState(false);

  const lien = useMemo(
    () => construireLienCampagne(origine, { destination, canal, campagne, visuel }),
    [origine, destination, canal, campagne, visuel],
  );

  const aide = DESTINATIONS_CAMPAGNE.find((d) => d.id === destination)?.aide ?? "";

  async function copier() {
    try {
      await navigator.clipboard.writeText(lien.url);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le lien
      // reste sélectionnable à la main juste au-dessus. On ne montre pas
      // d'erreur pour un geste de confort qui a une solution de repli visible.
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="campagne-destination">
            Vers quelle page
          </label>
          <select
            id="campagne-destination"
            className={CHAMP}
            value={destination}
            onChange={(e) => setDestination(e.target.value as DestinationCampagne)}
          >
            {DESTINATIONS_CAMPAGNE.map((d) => (
              <option key={d.id} value={d.id}>
                {d.libelle}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 dark:text-slate-400">{aide}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="campagne-canal">
            Depuis quel canal
          </label>
          <select
            id="campagne-canal"
            className={CHAMP}
            value={canal}
            onChange={(e) => setCanal(e.target.value as CanalCampagne)}
          >
            {CANAUX_CAMPAGNE.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Le type de canal est déduit, jamais saisi — deux orthographes du même canal produiraient
            deux lignes de statistiques.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="campagne-nom">
            Nom de la campagne
          </label>
          <input
            id="campagne-nom"
            className={CHAMP}
            value={campagne}
            onChange={(e) => setCampagne(e.target.value)}
            placeholder="Apporteurs septembre"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL} htmlFor="campagne-visuel">
            Visuel ou variante
          </label>
          <input
            id="campagne-visuel"
            className={CHAMP}
            value={visuel}
            onChange={(e) => setVisuel(e.target.value)}
            placeholder="Vidéo A"
            autoComplete="off"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Une valeur par création. C'est ce qui permet de comparer deux publicités.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
        <span className={LABEL}>Le lien à coller dans le gestionnaire de publicités</span>
        <code className="block font-mono text-sm break-all text-slate-900 dark:text-slate-100">
          {lien.url}
        </code>
        <div className="flex items-center gap-3 pt-1">
          <AdminButton type="button" onClick={copier} variant="secondary">
            {copie ? (
              <>
                <Check className="size-4" aria-hidden /> Copié
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden /> Copier le lien
              </>
            )}
          </AdminButton>
          <span aria-live="polite" className="sr-only">
            {copie ? "Lien copié dans le presse-papiers" : ""}
          </span>
        </div>
      </div>

      {lien.avertissements.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200">
          {lien.avertissements.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
