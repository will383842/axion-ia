"use client";
// use-client: useActionState + fetch — état d'envoi et message d'erreur du formulaire.

// Formulaire de la page `/completer-ma-candidature` — MOBILE D'ABORD
// (2026-09-28, Will : « beaucoup de blabla pour pas grand-chose »).
//
// Les questions consécutives d'un même `groupe` s'affichent sous un seul
// titre : les PRIX en grille de trois cases sous leur libellé `court`
// (« 30 s », « 60 s »…), les autres champs l'un sous l'autre. `attendus`
// devient une ligne de pastilles — le cahier des charges en mots courts.
// Sans `groupe`, une question garde son libellé complet.
// Un prix est UN montant (clavier numérique, 16 px pour que Safari iOS ne
// zoome pas) ; le serveur refuse de toute façon une fourchette.

import { useActionState } from "react";

import type { ScreeningQuestion } from "@/lib/careers/screening-answers";
import type { EtatComplement } from "@/features/job-application/complement-envoi";

/**
 * Envoi par une ROUTE FIXE, pas par une Server Action : une page restée ouverte
 * pendant une mise en ligne doit pouvoir envoyer (cf. `complement-envoi.ts`).
 */
async function envoyer(_prev: EtatComplement, formData: FormData): Promise<EtatComplement> {
  try {
    const rep = await fetch("/api/candidature/complement", { method: "POST", body: formData });
    const json = (await rep.json().catch(() => null)) as EtatComplement;
    if (json) return json;
  } catch {
    // réseau coupé : dit ci-dessous
  }
  return {
    ok: false,
    error:
      "L'envoi n'a pas abouti. Vérifiez votre connexion et réessayez — vos réponses sont toujours là.",
  };
}

const FIELD =
  "border-border bg-bg focus:border-terracotta focus:ring-terracotta/20 w-full rounded-lg border px-3 py-3 text-[16px] outline-none focus:ring-4";

interface Props {
  jeton: string;
  questions: ScreeningQuestion[];
  reponses: Record<string, string>;
}

interface Bloc {
  titre: string | null;
  attendus: string[];
  questions: ScreeningQuestion[];
}

/** Regroupe les questions CONSÉCUTIVES d'un même `groupe`. */
export function enBlocs(questions: readonly ScreeningQuestion[]): Bloc[] {
  const blocs: Bloc[] = [];
  for (const q of questions) {
    const dernier = blocs.at(-1);
    if (q.groupe && dernier?.titre === q.groupe) {
      dernier.questions.push(q);
      if (dernier.attendus.length === 0 && q.attendus) dernier.attendus = q.attendus;
    } else {
      blocs.push({ titre: q.groupe ?? null, attendus: q.attendus ?? [], questions: [q] });
    }
  }
  return blocs;
}

export function CompleterCandidatureForm({ jeton, questions, reponses }: Props) {
  const [etat, action, envoi] = useActionState<EtatComplement, FormData>(envoyer, null);

  if (etat?.ok) {
    return (
      <div role="status" className="border-sage/40 bg-sage/10 rounded-xl border-2 p-5">
        <p className="text-fg text-lg font-semibold">Merci, c’est enregistré ✅</p>
        <p className="text-fg-soft mt-1 text-sm">
          Nous revenons vers vous après avoir comparé les propositions. Ce lien reste valable pour
          corriger un prix.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="jeton" value={jeton} />

      {enBlocs(questions).map((bloc, i) => {
        const prix = bloc.titre !== null && bloc.questions.every((q) => q.type === "price");
        return (
          <fieldset key={bloc.titre ?? `q-${i}`} className="min-w-0 space-y-3">
            {bloc.titre ? (
              <legend className="text-fg mb-1 text-base font-semibold">{bloc.titre}</legend>
            ) : null}
            {bloc.attendus.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5" aria-label="Ce qui est attendu">
                {bloc.attendus.map((a) => (
                  <li
                    key={a}
                    className="bg-terracotta-soft/40 text-fg rounded-full px-2.5 py-1 text-xs font-medium"
                  >
                    {a}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className={prix ? "grid grid-cols-3 gap-2" : "space-y-3"}>
              {bloc.questions.map((q) => (
                <Champ
                  key={q.id}
                  q={q}
                  groupe={bloc.titre !== null}
                  defaut={reponses[q.id] ?? ""}
                  envoi={envoi}
                />
              ))}
            </div>
          </fieldset>
        );
      })}

      {etat && !etat.ok ? (
        <p role="alert" className="text-accent-red text-sm font-medium">
          {etat.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={envoi}
        className="bg-terracotta hover:bg-terracotta-deep w-full rounded-full px-6 py-4 text-base font-semibold text-white transition-colors disabled:opacity-60"
      >
        {envoi ? "Envoi…" : "Envoyer mes tarifs"}
      </button>
    </form>
  );
}

function Champ({
  q,
  groupe,
  defaut,
  envoi,
}: {
  q: ScreeningQuestion;
  groupe: boolean;
  defaut: string;
  envoi: boolean;
}) {
  const id = `answer_${q.id}`;
  const libelle = (groupe ? q.court : undefined) ?? q.labelFr ?? q.labelEn ?? q.id;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-fg-soft mb-1 block text-sm font-medium">
        {libelle}
        {q.required ? <span className="text-terracotta"> *</span> : null}
      </label>
      {q.type === "price" ? (
        <div className="relative">
          <input
            id={id}
            name={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            required={q.required}
            maxLength={12}
            pattern="[0-9 ]+([.,][0-9]{1,2})?"
            title="Un seul montant en euros, sans fourchette"
            placeholder="ex. 25"
            defaultValue={defaut.replace(/\s*€\s*$/, "")}
            className={`${FIELD} pr-7`}
            disabled={envoi}
          />
          <span
            aria-hidden="true"
            className="text-fg-muted pointer-events-none absolute inset-y-0 right-2.5 flex items-center"
          >
            €
          </span>
        </div>
      ) : q.type === "short" ? (
        <input
          id={id}
          name={id}
          type="text"
          required={q.required}
          maxLength={300}
          defaultValue={defaut}
          className={FIELD}
          disabled={envoi}
        />
      ) : (
        <textarea
          id={id}
          name={id}
          required={q.required}
          rows={2}
          maxLength={2000}
          placeholder={groupe ? "Un lien par ligne" : undefined}
          defaultValue={defaut}
          className={FIELD}
          disabled={envoi}
        />
      )}
    </div>
  );
}
