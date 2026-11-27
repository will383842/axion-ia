"use client";
// use-client: cases et filtres dépendant des réponses, jeton anti-robot, code de retrait généré
// dans le navigateur.
//
// Questionnaire du Baromètre 2027. Garantie centrale : TANT QUE LA CASE N'EST PAS COCHÉE ET LE
// BOUTON PRESSÉ, RIEN NE PART — ni Server Action, ni `fetch`. Turnstile n'est monté qu'au cochage.
// Les questions arrivent en props (résolues côté serveur) : aucun libellé n'est embarqué ici.

import * as React from "react";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { envoyerReponsesBarometre } from "@/server/actions/barometre-questionnaire/envoyer";
import { CONSENT_VERSION } from "@/lib/barometre-questionnaire/constantes";
import { empreinteDuCode, formaterCode, genererCode } from "@/lib/score-ia-pme/code-retrait";

export interface OptionProp {
  readonly value: string;
  readonly label: string;
  readonly exclusive?: boolean;
}

export interface QuestionsProp {
  readonly libelles: Readonly<Record<string, string>>;
  readonly sections: Readonly<Record<"entreprise" | "usage" | "freins" | "ouvertes", string>>;
  readonly aides: Readonly<Record<"q3" | "q4" | "q14", string>>;
  readonly options: Readonly<
    Record<
      | "q1"
      | "q2"
      | "q3"
      | "q4"
      | "q5"
      | "q6"
      | "q7"
      | "q8"
      | "q9"
      | "q10"
      | "q11"
      | "q12"
      | "q13"
      | "q14",
      ReadonlyArray<OptionProp>
    >
  >;
  /** Réponses « non » à q4. */
  readonly q4Non: ReadonlyArray<string>;
  /** Réponses de q12 masquées quand q1 = 0. */
  readonly q12AvecSalaries: ReadonlyArray<string>;
  readonly q10Max: number;
  readonly texteConsentement: string;
  readonly textes: Readonly<Record<string, string>>;
}

type Valeurs = Record<string, string | string[]>;

const OBLIGATOIRES_BASE = ["q1", "q2", "q3", "q4", "q10", "q11", "q12", "q13"] as const;

function melanger<T>(a: ReadonlyArray<T>): T[] {
  const b = [...a];
  const alea = new Uint32Array(b.length);
  crypto.getRandomValues(alea);
  for (let i = b.length - 1; i > 0; i--) {
    const j = alea[i]! % (i + 1);
    [b[i], b[j]] = [b[j]!, b[i]!];
  }
  return b;
}

const MARQUEUR = "barometre-questionnaire:envoye";

function marqueurPresent(): boolean {
  try {
    return window.sessionStorage.getItem(MARQUEUR) === "1";
  } catch {
    return false;
  }
}
function poserMarqueur(): void {
  try {
    window.sessionStorage.setItem(MARQUEUR, "1");
  } catch {
    /* sessionStorage indisponible : sans effet */
  }
}

export function FormulaireBarometre({ q }: { q: QuestionsProp }) {
  const [v, setV] = React.useState<Valeurs>({});
  const [coche, setCoche] = React.useState(false);
  const [statut, setStatut] = React.useState<"repos" | "envoi" | "ok">("repos");
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [erreurCase, setErreurCase] = React.useState(false);
  const [code, setCode] = React.useState<string | null>(null);
  const [copie, setCopie] = React.useState(false);
  const honeypot = React.useRef<HTMLInputElement>(null);
  const debut = React.useRef<number | null>(null);
  const titreConfirmation = React.useRef<HTMLHeadingElement>(null);
  const { token, widget, blocked, reset } = useTurnstileToken("barometre-questionnaire");
  const siteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"];

  // q10 : ordre mélangé APRÈS le montage (le rendu serveur est stable) ; « Aucun frein » dernier.
  const [ordreQ10, setOrdreQ10] = React.useState<OptionProp[]>(() => [...q.options.q10]);
  React.useEffect(() => {
    debut.current = Date.now();
    const normales = q.options.q10.filter((o) => !o.exclusive);
    const exclusives = q.options.q10.filter((o) => o.exclusive);
    // Microtâche : le mélange arrive après le montage sans setState synchrone dans l'effet.
    queueMicrotask(() => setOrdreQ10([...melanger(normales), ...exclusives]));
  }, [q.options.q10]);

  React.useEffect(() => {
    if (statut === "ok") titreConfirmation.current?.focus();
  }, [statut]);

  const nonUtilisateur = typeof v["q4"] === "string" && q.q4Non.includes(v["q4"]);
  const afficheUsage = typeof v["q4"] === "string" && v["q4"] !== "" && !nonUtilisateur;
  const afficheQ14 = v["q13"] === "oui";
  const optionsQ12 = q.options.q12.filter(
    (o) => !(v["q1"] === "0" && q.q12AvecSalaries.includes(o.value)),
  );

  const choisir = (id: string, valeur: string) => {
    setV((prev) => {
      const suite: Valeurs = { ...prev, [id]: valeur };
      if (id === "q4" && q.q4Non.includes(valeur)) {
        for (const k of ["q5", "q6", "q7", "q8", "q9"]) delete suite[k];
      }
      if (id === "q1" && valeur === "0" && typeof suite["q12"] === "string") {
        if (q.q12AvecSalaries.includes(suite["q12"])) delete suite["q12"];
      }
      if (id === "q13" && valeur !== "oui") delete suite["q14"];
      return suite;
    });
  };

  const basculer = (id: string, option: OptionProp, max: number) => {
    setV((prev) => {
      const actuel = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const est = actuel.includes(option.value);
      let suite: string[];
      if (est) suite = actuel.filter((x) => x !== option.value);
      else if (option.exclusive) suite = [option.value];
      else {
        const exclusives = (q.options[id as keyof QuestionsProp["options"]] ?? [])
          .filter((o) => o.exclusive)
          .map((o) => o.value);
        suite = [...actuel.filter((x) => !exclusives.includes(x)), option.value];
        if (suite.length > max) return prev;
      }
      return { ...prev, [id]: suite };
    });
  };

  const ecrire = (id: string, texte: string) => setV((prev) => ({ ...prev, [id]: texte }));

  const complet = (): boolean => {
    const requis: string[] = [...OBLIGATOIRES_BASE];
    if (afficheUsage) requis.push("q5", "q6", "q7", "q8", "q9");
    if (afficheQ14) requis.push("q14");
    return requis.every((k) => {
      const x = v[k];
      return Array.isArray(x) ? x.length > 0 : typeof x === "string" && x !== "";
    });
  };

  const envoyer = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (statut === "envoi") return;
      setErreur(null);
      if (!coche) {
        setErreurCase(true);
        return;
      }
      if (!complet()) {
        setErreur(q.textes["champsManquants"] ?? "");
        return;
      }
      if (marqueurPresent()) {
        setErreur(q.textes["dejaEnvoye"] ?? "");
        return;
      }
      if (blocked) {
        setErreur(q.textes["antiRobotBloque"] ?? "");
        return;
      }
      const jeton = token || (siteKey ? "" : "sans-widget");
      if (!jeton) {
        setErreur(q.textes["antiRobotEnCours"] ?? "");
        return;
      }
      setStatut("envoi");
      try {
        const codeBrut = genererCode();
        const codeRetraitHash = await empreinteDuCode(codeBrut);
        const reponses: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(v)) {
          if (typeof x === "string" && x.trim() === "") continue;
          reponses[k] = x;
        }
        const resultat = await envoyerReponsesBarometre({
          ...reponses,
          consentement: true,
          consentVersion: CONSENT_VERSION,
          codeRetraitHash,
          turnstileToken: jeton,
          website: honeypot.current?.value ?? "",
          startedAt: debut.current ?? Date.now(),
        });
        if (resultat.ok) {
          poserMarqueur();
          setCode(formaterCode(codeBrut));
          setStatut("ok");
        } else {
          setStatut("repos");
          setErreur(resultat.error || (q.textes["echec"] ?? ""));
          reset();
        }
      } catch {
        setStatut("repos");
        setErreur(q.textes["echec"] ?? "");
        reset();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statut, coche, v, blocked, token, siteKey, reset, q.textes],
  );

  const copier = React.useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.replace(/ /g, " "));
      setCopie(true);
    } catch {
      setCopie(false);
    }
  }, [code]);

  if (statut === "ok" && code) {
    return (
      <section
        aria-labelledby="bq-confirmation"
        className="border-ink/15 rounded-xl border bg-white p-5 sm:p-6"
      >
        <h2
          id="bq-confirmation"
          ref={titreConfirmation}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          {q.textes["confirmation"]}
        </h2>
        <p className="mt-3 text-sm font-medium">{q.textes["codeTitre"]}</p>
        <p
          className="mt-1 font-mono text-2xl tracking-wider select-all"
          aria-label={`${q.textes["codeTitre"]} : ${[...code.replace(/\s/g, "")].join(" ")}`}
          data-testid="code-retrait"
        >
          {code}
        </p>
        <p className="mt-3 text-sm">{q.textes["codeAvertissement"]}</p>
        <button
          type="button"
          onClick={copier}
          className="border-ink/60 mt-3 inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-medium"
        >
          {q.textes["copier"]}
        </button>
        <p role="status" aria-live="polite" className="mt-2 min-h-[1.5rem] text-sm">
          {copie ? q.textes["copie"] : ""}
        </p>
      </section>
    );
  }

  const choixUnique = (id: keyof QuestionsProp["options"], options: ReadonlyArray<OptionProp>) => (
    <fieldset key={id} data-question={id} className="mt-6">
      <legend className="text-sm font-semibold">
        {q.libelles[id]} <span aria-hidden="true">*</span>
        {id === "q4" ? (
          <span className="text-ink/70 mt-1 block font-normal">{q.aides.q4}</span>
        ) : null}
      </legend>
      <div className="mt-2 space-y-1">
        {options.map((o) => (
          <label
            key={o.value}
            className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm"
          >
            <input
              type="radio"
              name={id}
              value={o.value}
              checked={v[id] === o.value}
              onChange={() => choisir(id, o.value)}
              required
              className="h-5 w-5 shrink-0"
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  const choixMultiple = (
    id: keyof QuestionsProp["options"],
    options: ReadonlyArray<OptionProp>,
    max: number = options.length,
  ) => {
    const choisis = Array.isArray(v[id]) ? (v[id] as string[]) : [];
    const plein = choisis.length >= max;
    return (
      <fieldset key={id} data-question={id} className="mt-6">
        <legend className="text-sm font-semibold">
          {q.libelles[id]} <span aria-hidden="true">*</span>
          {id === "q14" ? (
            <span className="text-ink/70 mt-1 block font-normal">{q.aides.q14}</span>
          ) : null}
        </legend>
        <div className="mt-2 space-y-1">
          {options.map((o) => {
            const coch = choisis.includes(o.value);
            return (
              <label
                key={o.value}
                className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm"
              >
                <input
                  type="checkbox"
                  name={id}
                  value={o.value}
                  checked={coch}
                  disabled={!coch && !o.exclusive && plein}
                  onChange={() => basculer(id, o, max)}
                  className="h-5 w-5 shrink-0"
                />
                <span>{o.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  };

  return (
    <form onSubmit={envoyer} noValidate className="mt-6" aria-label={q.textes["formulaire"]}>
      <h2 className="text-xl font-semibold">{q.sections.entreprise}</h2>
      {choixUnique("q1", q.options.q1)}
      {choixUnique("q2", q.options.q2)}
      <div className="mt-6">
        <label htmlFor="bq-q3" className="text-sm font-semibold">
          {q.libelles["q3"]} <span aria-hidden="true">*</span>
        </label>
        <p className="text-ink/70 text-sm">{q.aides.q3}</p>
        <select
          id="bq-q3"
          name="q3"
          required
          value={typeof v["q3"] === "string" ? v["q3"] : ""}
          onChange={(e) => choisir("q3", e.target.value)}
          className="border-ink/60 mt-2 min-h-[44px] w-full max-w-sm rounded-lg border bg-white px-3 text-sm"
        >
          <option value="">{q.textes["choisir"]}</option>
          {q.options.q3.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <h2 className="mt-10 text-xl font-semibold">{q.sections.usage}</h2>
      {choixUnique("q4", q.options.q4)}
      {afficheUsage ? (
        <>
          {choixMultiple("q5", q.options.q5)}
          {choixUnique("q6", q.options.q6)}
          {choixMultiple("q7", q.options.q7)}
          {choixUnique("q8", q.options.q8)}
          {choixMultiple("q9", q.options.q9)}
        </>
      ) : null}

      <h2 className="mt-10 text-xl font-semibold">{q.sections.freins}</h2>
      {choixMultiple("q10", ordreQ10, q.q10Max)}
      {choixUnique("q11", q.options.q11)}
      {choixUnique("q12", optionsQ12)}
      {choixUnique("q13", q.options.q13)}
      {afficheQ14 ? choixMultiple("q14", q.options.q14) : null}

      <h2 className="mt-10 text-xl font-semibold">{q.sections.ouvertes}</h2>
      {(["q15", "q16"] as const).map((id) => (
        <div key={id} className="mt-6">
          <label htmlFor={`bq-${id}`} className="text-sm font-semibold">
            {q.libelles[id]} <span className="font-normal">{q.textes["facultatif"]}</span>
          </label>
          <textarea
            id={`bq-${id}`}
            name={id}
            maxLength={1000}
            rows={4}
            value={typeof v[id] === "string" ? v[id] : ""}
            onChange={(e) => ecrire(id, e.target.value)}
            className="border-ink/60 mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>
      ))}

      <label className="mt-8 flex min-h-[44px] cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="consentement"
          checked={coche}
          onChange={(e) => {
            setCoche(e.target.checked);
            if (e.target.checked) setErreurCase(false);
          }}
          aria-describedby={erreurCase ? "bq-erreur-case" : undefined}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>{q.texteConsentement}</span>
      </label>
      {/* Pot de miel : invisible, jamais rempli par une personne. */}
      <input
        ref={honeypot}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      {erreurCase ? (
        <p id="bq-erreur-case" role="alert" className="text-terracotta mt-2 text-sm">
          {q.textes["caseManquante"]}
        </p>
      ) : null}
      {erreur ? (
        <p role="alert" className="text-terracotta mt-2 text-sm">
          {erreur}
        </p>
      ) : null}
      {/* Turnstile : monté seulement une fois la case cochée. */}
      {coche ? widget : null}
      <button
        type="submit"
        className="bg-ink mt-4 inline-flex min-h-[44px] items-center rounded-lg px-5 text-sm font-semibold text-white"
      >
        {statut === "envoi" ? q.textes["enCours"] : q.textes["bouton"]}
      </button>
    </form>
  );
}
