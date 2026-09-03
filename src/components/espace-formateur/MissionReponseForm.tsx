"use client";
// use-client: formulaire de réponse à une mission — état local (choix, motif), transition serveur.

/**
 * Espace formateur — accepter ou refuser une mission (2026-09-03).
 *
 * Un seul composant pour les deux chemins : le lien de l'e-mail (jeton, sans
 * connexion) et la page de session de l'espace connecté (identifiant de
 * mission). Le refus exige un MOTIF : sans lui, l'organisme ne saurait ni
 * pourquoi il change de formateur, ni quoi corriger.
 *
 * L'état est dans le TEXTE, jamais dans la seule couleur (WCAG 1.4.1).
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  repondreMissionParJetonAction,
  repondreMissionFormateurAction,
} from "@/server/actions/qualiopi/mission-formateur";

export type MissionReponseCible = { token: string } | { missionId: string };

export interface MissionReponseFormProps {
  readonly cible: MissionReponseCible;
  /** Résumé lu au-dessus des boutons : titre, dates, lieu. */
  readonly resume: string;
  /** Longueur minimale du motif de refus — dite à l'écran, pas seulement refusée. */
  readonly motifMin: number;
}

type Etat =
  | { phase: "choix" }
  | { phase: "refus" }
  | { phase: "fait"; statut: "acceptee" | "refusee" }
  | { phase: "erreur"; message: string };

export function MissionReponseForm({
  cible,
  resume,
  motifMin,
}: MissionReponseFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [etat, setEtat] = useState<Etat>({ phase: "choix" });
  const [motif, setMotif] = useState("");

  function envoyer(reponse: "acceptee" | "refusee") {
    startTransition(async () => {
      const input = reponse === "refusee" ? { reponse, motif } : { reponse };
      const r =
        "token" in cible
          ? await repondreMissionParJetonAction({ token: cible.token, ...input })
          : await repondreMissionFormateurAction({ missionId: cible.missionId, ...input });
      if ("error" in r) {
        setEtat({ phase: "erreur", message: r.error });
        return;
      }
      setEtat({ phase: "fait", statut: reponse });
      router.refresh();
    });
  }

  const boutonPrimaire =
    "inline-flex min-h-[44px] items-center justify-center rounded-md bg-terracotta px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50";
  const boutonSecondaire =
    "inline-flex min-h-[44px] items-center justify-center rounded-md border border-border px-5 py-2 text-sm font-semibold text-mocha hover:bg-sand disabled:opacity-50";

  if (etat.phase === "fait") {
    return (
      <div role="status" className="border-border rounded-lg border p-4">
        <p className="text-mocha text-sm font-semibold">
          {etat.statut === "acceptee" ? "Mission acceptée." : "Refus enregistré."}
        </p>
        <p className="text-fg-soft mt-1 text-sm">
          {etat.statut === "acceptee"
            ? "Merci. Les informations pratiques (adresse, salle, contact sur place, consignes d'accès) vous parviendront une semaine avant le démarrage, et restent consultables dans votre espace."
            : "L'organisme est prévenu et va confier la session à un autre intervenant. Merci d'avoir répondu vite."}
        </p>
      </div>
    );
  }

  return (
    <div className="border-border space-y-4 rounded-lg border p-4">
      <p className="text-mocha text-sm">{resume}</p>

      {etat.phase === "erreur" ? (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {etat.message}
        </p>
      ) : null}

      {etat.phase === "refus" ? (
        <div className="space-y-2">
          <label htmlFor="mission-motif" className="text-mocha block text-sm font-medium">
            Motif du refus{" "}
            <span className="text-fg-muted">(obligatoire, {motifMin} caractères au moins)</span>
          </label>
          <textarea
            id="mission-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={isPending}
            className="border-border w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Ex. : indisponible ces dates, déjà engagé ailleurs, formation hors de mon périmètre…"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={boutonPrimaire}
              disabled={isPending || motif.trim().length < motifMin}
              onClick={() => envoyer("refusee")}
            >
              {isPending ? "…" : "Confirmer le refus"}
            </button>
            <button
              type="button"
              className={boutonSecondaire}
              disabled={isPending}
              onClick={() => setEtat({ phase: "choix" })}
            >
              Revenir
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={boutonPrimaire}
            disabled={isPending}
            onClick={() => envoyer("acceptee")}
          >
            {isPending ? "…" : "J'accepte cette mission"}
          </button>
          <button
            type="button"
            className={boutonSecondaire}
            disabled={isPending}
            onClick={() => setEtat({ phase: "refus" })}
          >
            Je refuse (motif demandé)
          </button>
        </div>
      )}
    </div>
  );
}
