"use client";
// use-client: grille de notation (état local par compétence, saisie libre,
// useTransition pour l'enregistrement). Aucune donnée n'est calculée ici — le
// score et le niveau sont établis par le serveur, cf. `evaluations-service`.

/**
 * Grille d'évaluation des acquis — indicateur 11.
 *
 * 🔴 `D4-1-C` (2026-08-20). L'évaluation des acquis est l'acte propre du
 * formateur, et elle n'existait sur aucun de ses écrans.
 *
 * ## Ce que ce composant NE fait pas
 *
 * Il ne calcule ni score, ni niveau, ni réussite. Ces trois valeurs sont
 * établies côté serveur (`computeEvaluationScore`, `niveauFromScore`,
 * `reussiteFromScore` avec le seuil de la configuration).
 *
 * 🔑 Les calculer aussi ici donnerait deux vérités pour le même chiffre, et
 * celle qui s'afficherait serait la moins fiable. Le formateur note ; le
 * système mesure.
 *
 * ## Trois niveaux, et pas cinq
 *
 * Non acquis / partiellement / acquis. C'est ce que le moteur attend
 * (`note: 1 | 2 | 3`), et c'est ce qu'on peut observer honnêtement en fin de
 * session. Une échelle plus fine donnerait une précision qu'aucune observation
 * ne soutient.
 *
 * ⚠️ Une compétence NON NOTÉE reste non notée. Elle n'est pas envoyée avec une
 * note par défaut : « non observé » et « non acquis » sont deux choses
 * différentes, et les confondre ferait porter à un stagiaire un échec qu'on n'a
 * pas constaté.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export interface CompetenceProposee {
  ref: string;
  libelle: string;
}

export interface GrilleEvaluationProps {
  sessionId: string;
  enrollmentId: string;
  nomComplet: string;
  competencesProposees: ReadonlyArray<CompetenceProposee>;
  /** Types déjà saisis — pour dire ce qui existe, pas pour l'interdire. */
  typesDejaSaisis: ReadonlyArray<string>;
  enregistrerAction: (input: {
    sessionId: string;
    enrollmentId: string;
    type: "initiale" | "intermediaire" | "finale";
    dateEvaluation: string;
    competences: Array<{
      libelle: string;
      note?: 1 | 2 | 3;
      observations?: string;
      objectifRef?: string;
    }>;
    recommandations?: string;
  }) => Promise<{ ok: true; id: string } | { ok: false; message: string }>;
}

type Note = 1 | 2 | 3 | null;

interface LigneGrille {
  ref: string;
  libelle: string;
  note: Note;
  observations: string;
}

const LIBELLE_NOTE: Record<1 | 2 | 3, string> = {
  1: "Non acquis",
  2: "Partiellement",
  3: "Acquis",
};

const LIBELLE_TYPE: Record<string, string> = {
  initiale: "à l'entrée",
  intermediaire: "en cours",
  finale: "à la fin",
};

export function GrilleEvaluation({
  sessionId,
  enrollmentId,
  nomComplet,
  competencesProposees,
  typesDejaSaisis,
  enregistrerAction,
}: GrilleEvaluationProps): React.ReactElement {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [type, setType] = useState<"initiale" | "intermediaire" | "finale">("finale");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lignes, setLignes] = useState<LigneGrille[]>(() =>
    competencesProposees.map((c) => ({
      ref: c.ref,
      libelle: c.libelle,
      note: null,
      observations: "",
    })),
  );
  const [recommandations, setRecommandations] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [enCours, startTransition] = useTransition();

  function modifier(i: number, champ: Partial<LigneGrille>): void {
    setLignes((prev) => prev.map((l, k) => (k === i ? { ...l, ...champ } : l)));
  }

  function ajouterLigne(): void {
    setLignes((prev) => [
      ...prev,
      { ref: `libre-${prev.length + 1}`, libelle: "", note: null, observations: "" },
    ]);
  }

  function enregistrer(): void {
    setErreur(null);
    setSucces(null);

    const competences = lignes
      .filter((l) => l.libelle.trim() !== "")
      .map((l) => ({
        libelle: l.libelle.trim(),
        // ⚠️ La note n'est envoyée que si elle a été POSÉE. Voir l'en-tête :
        // « non observé » n'est pas « non acquis ».
        ...(l.note !== null ? { note: l.note } : {}),
        ...(l.observations.trim() !== "" ? { observations: l.observations.trim() } : {}),
        ...(l.ref.startsWith("libre-") ? {} : { objectifRef: l.ref }),
      }));

    if (competences.length === 0) {
      setErreur("Ajoutez au moins une compétence avec son libellé.");
      return;
    }

    startTransition(async () => {
      const res = await enregistrerAction({
        sessionId,
        enrollmentId,
        type,
        dateEvaluation: date,
        competences,
        ...(recommandations.trim() !== "" ? { recommandations: recommandations.trim() } : {}),
      });
      if (!res.ok) {
        setErreur(res.message);
        return;
      }
      setSucces(`Évaluation ${LIBELLE_TYPE[type]} enregistrée pour ${nomComplet}.`);
      router.refresh();
    });
  }

  return (
    <div className="border-border rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-mocha text-sm font-medium">
          {nomComplet}
          {typesDejaSaisis.length > 0 && (
            <span className="text-fg-muted ml-2 text-xs font-normal">
              déjà évalué&nbsp;: {typesDejaSaisis.map((t) => LIBELLE_TYPE[t] ?? t).join(", ")}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setOuvert((o) => !o)}
          className="text-terracotta text-xs underline underline-offset-2"
        >
          {ouvert ? "Fermer" : "Évaluer"}
        </button>
      </div>

      {ouvert && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-mocha text-xs">
              Moment
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="border-border ml-2 rounded border px-2 py-1"
              >
                <option value="initiale">À l&apos;entrée</option>
                <option value="intermediaire">En cours</option>
                <option value="finale">À la fin</option>
              </select>
            </label>
            <label className="text-mocha text-xs">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="border-border ml-2 rounded border px-2 py-1"
              />
            </label>
          </div>

          {lignes.length === 0 && (
            // ⚠️ On DIT pourquoi la grille est vide. Un écran vide sans phrase
            // laisse croire à une panne, et le formateur cherche au mauvais
            // endroit.
            <p className="text-fg-muted text-xs">
              Cette formation n&apos;a pas d&apos;objectifs pédagogiques saisis : ajoutez les
              compétences que vous avez évaluées.
            </p>
          )}

          <ul className="space-y-2">
            {lignes.map((l, i) => (
              <li key={`${l.ref}-${i}`} className="border-border rounded border px-3 py-2">
                <input
                  value={l.libelle}
                  onChange={(e) => modifier(i, { libelle: e.target.value })}
                  placeholder="Compétence évaluée"
                  className="border-border w-full rounded border px-2 py-1 text-sm"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {([1, 2, 3] as const).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => modifier(i, { note: l.note === n ? null : n })}
                      aria-pressed={l.note === n}
                      className={`rounded border px-2 py-1 text-xs ${
                        l.note === n
                          ? "border-terracotta text-terracotta font-medium"
                          : "border-border"
                      }`}
                    >
                      {LIBELLE_NOTE[n]}
                    </button>
                  ))}
                </div>
                <input
                  value={l.observations}
                  onChange={(e) => modifier(i, { observations: e.target.value })}
                  placeholder="Observation (facultatif)"
                  className="border-border mt-2 w-full rounded border px-2 py-1 text-xs"
                />
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={ajouterLigne}
            className="text-terracotta text-xs underline underline-offset-2"
          >
            Ajouter une compétence
          </button>

          <textarea
            value={recommandations}
            onChange={(e) => setRecommandations(e.target.value)}
            placeholder="Recommandations pour la suite (facultatif)"
            rows={2}
            className="border-border w-full rounded border px-2 py-1 text-xs"
          />

          {erreur !== null && (
            <p role="alert" className="text-sm text-red-700">
              {erreur}
            </p>
          )}
          {succes !== null && (
            <p role="status" className="text-mocha text-sm">
              {succes}
            </p>
          )}

          <button
            type="button"
            onClick={enregistrer}
            disabled={enCours}
            className="bg-terracotta rounded px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            {enCours ? "Enregistrement…" : "Enregistrer l'évaluation"}
          </button>
        </div>
      )}
    </div>
  );
}
