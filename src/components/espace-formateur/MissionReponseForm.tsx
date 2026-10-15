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
import {
  CHOIX_MOTIF_REFUS_LIBRE,
  PHRASE_LIBERTE,
  QUESTION_REFUS_LIBRE,
  REPONSE_ENREGISTREE,
  SUITE_APRES_REPONSE,
} from "@/components/espace-formateur/mission-copy";

export type MissionReponseCible = { token: string } | { missionId: string };

export interface MissionReponseFormProps {
  readonly cible: MissionReponseCible;
  /** Résumé lu au-dessus des boutons : titre, dates, lieu. */
  readonly resume: string;
  /** Longueur minimale du motif de refus — dite à l'écran, pas seulement refusée. */
  readonly motifMin: number;
  /**
   * Lot S2 (S-UX-6) — refus d'un formateur indépendant, interrupteur
   * `formateurs.affectation_sure` allumé : le motif n'est jamais exigé. Absent
   * ou faux : l'écran d'avant, motif demandé.
   */
  readonly refusLibre?: boolean;
}

// V2-N-10 — l'erreur n'est plus une phase : elle s'affiche AU-DESSUS de la phase en
// cours, et un refus refusé par le serveur garde son panneau ouvert, texte compris.
type Etat =
  { phase: "choix" } | { phase: "refus" } | { phase: "fait"; statut: "acceptee" | "refusee" };

export function MissionReponseForm({
  cible,
  resume,
  motifMin,
  refusLibre = false,
}: MissionReponseFormProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [etat, setEtat] = useState<Etat>({ phase: "choix" });
  const [motif, setMotif] = useState("");
  const [choix, setChoix] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function envoyer(reponse: "acceptee" | "refusee") {
    setErreur(null);
    startTransition(async () => {
      // Refus libre : le choix et le mot, s'il y en a, réunis ; rien sinon.
      const motifEnvoye = refusLibre
        ? [choix, motif.trim()].filter((x): x is string => Boolean(x)).join(" : ")
        : motif;
      const input = reponse === "refusee" ? { reponse, motif: motifEnvoye } : { reponse };
      const r =
        "token" in cible
          ? await repondreMissionParJetonAction({ token: cible.token, ...input })
          : await repondreMissionFormateurAction({ missionId: cible.missionId, ...input });
      if ("error" in r) {
        setErreur(r.error);
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

  if (etat.phase === "fait" && refusLibre && etat.statut === "refusee") {
    return (
      <div role="status" className="border-border rounded-lg border p-4">
        <p className="text-mocha text-base font-semibold">{REPONSE_ENREGISTREE}</p>
      </div>
    );
  }

  if (etat.phase === "fait") {
    const dit = SUITE_APRES_REPONSE[etat.statut];
    return (
      <div role="status" className="border-border rounded-lg border p-4">
        <p className="text-mocha text-sm font-semibold">{dit.titre}</p>
        <p className="text-fg-soft mt-1 text-sm">Merci. {dit.suite}</p>
      </div>
    );
  }

  return (
    <div className="border-border space-y-4 rounded-lg border p-4">
      <p className="text-mocha text-sm">{resume}</p>

      {erreur !== null ? (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {erreur}
        </p>
      ) : null}

      {refusLibre && etat.phase !== "refus" ? (
        <p className="text-mocha text-sm">{PHRASE_LIBERTE}</p>
      ) : null}

      {etat.phase === "refus" && refusLibre ? (
        <div className="space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-mocha text-base font-medium">
              {QUESTION_REFUS_LIBRE} <span className="text-fg-muted">(facultatif)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {CHOIX_MOTIF_REFUS_LIBRE.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={choix === c}
                  disabled={isPending}
                  onClick={() => setChoix(choix === c ? null : c)}
                  className={
                    choix === c
                      ? "border-terracotta bg-sand text-mocha inline-flex min-h-[48px] items-center rounded-md border-2 px-4 text-sm font-semibold"
                      : "border-border text-mocha inline-flex min-h-[48px] items-center rounded-md border px-4 text-sm"
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
          <label htmlFor="mission-motif" className="text-mocha block text-sm font-medium">
            Un mot si vous le souhaitez
          </label>
          <textarea
            id="mission-motif"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={2}
            // 2 000 au plus côté serveur, choix et « : » compris.
            maxLength={1960}
            disabled={isPending}
            className="border-border w-full rounded-md border px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={boutonPrimaire}
              disabled={isPending}
              onClick={() => envoyer("refusee")}
            >
              {isPending ? "…" : "Envoyer ma réponse"}
            </button>
            <button
              type="button"
              className={boutonSecondaire}
              disabled={isPending}
              onClick={() => {
                setErreur(null);
                setEtat({ phase: "choix" });
              }}
            >
              Revenir
            </button>
          </div>
        </div>
      ) : etat.phase === "refus" ? (
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
              onClick={() => {
                setErreur(null);
                setEtat({ phase: "choix" });
              }}
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
            {isPending ? "…" : refusLibre ? "J'accepte" : "J'accepte cette mission"}
          </button>
          <button
            type="button"
            className={boutonSecondaire}
            disabled={isPending}
            onClick={() => {
              setErreur(null);
              setEtat({ phase: "refus" });
            }}
          >
            {refusLibre ? "Je ne suis pas disponible" : "Je refuse (motif demandé)"}
          </button>
        </div>
      )}
    </div>
  );
}
