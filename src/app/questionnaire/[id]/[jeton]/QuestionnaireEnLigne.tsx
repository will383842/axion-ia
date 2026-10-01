"use client";
// use-client: une question par écran, brouillon gardé dans le navigateur (localStorage), relecture avant envoi.

// Le questionnaire de cadrage EN LIGNE, version pas à pas (2026-10-01).
// Textes et mise en page : `2-ux.md` (UX du 01/10), repris dans `./textes`.
//
// Sans JavaScript, ce composant est masqué (`<noscript><style>` de la page) et
// la page montre un formulaire d'un seul tenant : les deux versions postent la
// MÊME action serveur, avec les mêmes noms de champs (`reponse_<id>`,
// `repondant`). Le brouillon ne quitte jamais le navigateur avant l'envoi.
//
// ⛔ Aucun appel réseau ici hors de l'envoi du formulaire, aucune dépendance :
// React seul (icônes en SVG en ligne), pour tenir le budget de la page. La
// règle des puces est appliquée par le SERVEUR (`decouperQuestion`) : le
// navigateur reçoit titre, aide et puces déjà séparés.

import { useEffect, useRef, useState } from "react";

import {
  MAX_QUI_REPOND,
  REPONSE_JE_NE_SAIS_PAS,
} from "@/server/visio/questionnaire-en-ligne/constantes";
import { composerReponse } from "@/server/visio/questionnaire-en-ligne/decouper";
import { envoyerReponsesAction } from "./actions";
import {
  dureeRestante,
  dureeTotale,
  MESSAGES_ERREUR,
  mMinutes,
  nQuestions,
  TEXTES,
} from "./textes";

export interface QuestionAffichee {
  readonly id: string;
  readonly titre: string;
  readonly aide: string | null;
  readonly puces: ReadonlyArray<string>;
}

interface Props {
  readonly questionnaireId: string;
  readonly jeton: string;
  readonly questions: ReadonlyArray<QuestionAffichee>;
  /** Retour d'un envoi refusé (`?erreur=`), à afficher sur l'écran de relecture. */
  readonly erreur: "vide" | "trop" | null;
}

/** Une réponse : puces cochées, texte libre, et « Je ne sais pas » (qui l'emporte). */
interface Reponse {
  p: string[];
  t: string;
  j: boolean;
}

interface Brouillon {
  r: Record<string, Reponse>;
  qui: string;
}

const CLE = (id: string) => `axion-questionnaire:${id}`;

/** Le brouillon du navigateur — illisible ou absent : rien (mode privé, quota…). */
function lireBrouillon(id: string): Brouillon | null {
  try {
    const brut = window.localStorage.getItem(CLE(id));
    if (!brut) return null;
    const b = JSON.parse(brut) as Partial<Brouillon>;
    const r: Record<string, Reponse> = {};
    if (b.r && typeof b.r === "object") {
      for (const [k, v] of Object.entries(b.r)) {
        if (!v || typeof v !== "object") continue;
        r[k] = {
          p: Array.isArray(v.p) ? v.p.filter((x): x is string => typeof x === "string") : [],
          t: typeof v.t === "string" ? v.t : "",
          j: v.j === true,
        };
      }
    }
    return { r, qui: typeof b.qui === "string" ? b.qui : "" };
  } catch {
    return null;
  }
}

function ecrireBrouillon(id: string, b: Brouillon): boolean {
  try {
    window.localStorage.setItem(CLE(id), JSON.stringify(b));
    return true;
  } catch {
    return false; // Navigation privée, quota plein : le questionnaire marche sans brouillon.
  }
}

/** Efface le brouillon une fois les réponses reçues (écran « Merci »). */
export function EffacerBrouillon({ questionnaireId }: { readonly questionnaireId: string }) {
  useEffect(() => {
    try {
      window.localStorage.removeItem(CLE(questionnaireId));
    } catch {
      // rien à effacer
    }
  }, [questionnaireId]);
  return null;
}

/** La valeur envoyée : « Je ne sais pas. », ou les puces puis le texte libre. */
const valeur = (r: Reponse | undefined): string =>
  r === undefined ? "" : r.j ? REPONSE_JE_NE_SAIS_PAS : composerReponse(r.p, r.t);

// ── Icônes (SVG en ligne, aucune dépendance) ────────────────────────────────
const I = ({ d, className = "h-5 w-5" }: { d: string; className?: string }) => (
  <svg
    className={`${className} shrink-0`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);
const FLECHE = "M5 12h14M13 6l6 6-6 6";
const RETOUR = "M15 6l-6 6 6 6";
const COCHE = "M5 12.5l4.5 4.5L19 7.5";
const HORLOGE = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2";
const INFO = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01";
const AIDE =
  "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.2M12 17h.01";
const CADENAS = "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z";
const CRAYON = "M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4";
const ENVOI = "M4 12l16-8-6 16-3-7-7-1z";
const COMPTE = "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0";
const BOUCLIER = "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z";

const focus =
  "focus-visible:outline-terracotta focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-solid";
const boutonPrincipal = `bg-terracotta hover:bg-terracotta-deep shadow-cta-terracotta inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full px-8 text-[19px] font-bold text-white motion-safe:transition-colors disabled:opacity-70 ${focus}`;
const boutonSecondaire = `border-border-strong text-fg hover:border-terracotta bg-paper inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border-2 px-5 text-[18px] font-semibold motion-safe:transition-colors ${focus}`;
const champ = `border-border-strong focus:border-terracotta bg-bg focus:bg-paper text-fg w-full rounded-2xl border-2 p-4 text-[18px] leading-relaxed motion-safe:transition-colors focus:outline-none ${focus}`;
const carte = "bg-paper shadow-card rounded-3xl";
const pastille =
  "bg-terracotta-soft text-terracotta-deep inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[16px] font-semibold";
/** Barre du bas : collée en bas de l'écran sur téléphone, à sa place sur ordinateur. */
const barreBas =
  "bg-bg/95 border-border sticky bottom-0 -mx-5 mt-5 border-t px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0";

export function QuestionnaireEnLigne({ questionnaireId, jeton, questions, erreur }: Props) {
  const n = questions.length;
  // -1 : accueil · 0..n-1 : une question · n : relecture.
  const [etape, setEtape] = useState<number>(erreur ? n : -1);
  const [reponses, setReponses] = useState<Record<string, Reponse>>({});
  const [qui, setQui] = useState("");
  const [depuisRelecture, setDepuisRelecture] = useState(false);
  const [reprise, setReprise] = useState<number | null>(null);
  const [enregistre, setEnregistre] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [horsLigne, setHorsLigne] = useState(false);
  const titre = useRef<HTMLHeadingElement>(null);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Le brouillon se lit APRÈS l'hydratation (le rendu serveur ne le connaît
  // pas), différé d'une micro-tâche comme le reste du site
  // (`react-hooks/set-state-in-effect`, voir `AdminSidebarNav.tsx`).
  useEffect(() => {
    let actif = true;
    queueMicrotask(() => {
      const b = actif ? lireBrouillon(questionnaireId) : null;
      if (!b) return;
      setReponses(b.r);
      setQui(b.qui);
      if (Object.values(b.r).some((v) => valeur(v) !== "")) {
        // Reprendre à la première question sans réponse (ou à la relecture).
        const premiere = questions.findIndex((q) => valeur(b.r[q.id]) === "");
        setReprise(premiere < 0 ? n : premiere);
      }
    });
    return () => {
      actif = false;
    };
  }, [questionnaireId, questions, n]);

  useEffect(
    () => () => {
      if (minuterie.current) clearTimeout(minuterie.current);
    },
    [],
  );

  /** Chaque saisie est gardée sur l'appareil ; « Enregistré » s'affiche 1,5 s. */
  const garder = (r: Record<string, Reponse>, q: string) => {
    if (!ecrireBrouillon(questionnaireId, { r, qui: q })) return;
    setEnregistre(true);
    if (minuterie.current) clearTimeout(minuterie.current);
    minuterie.current = setTimeout(() => setEnregistre(false), 1500);
  };

  // Chaque changement d'écran porte le focus sur son titre, et remonte en haut.
  const premierRendu = useRef(true);
  useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    titre.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [etape]);

  const aller = (e: number) => setEtape(Math.max(-1, Math.min(n, e)));
  const suivant = () => {
    if (depuisRelecture) {
      setDepuisRelecture(false);
      aller(n);
    } else aller(etape + 1);
  };
  const modifier = (id: string, m: Partial<Reponse>) => {
    const avant = reponses[id] ?? { p: [], t: "", j: false };
    const suite = { ...reponses, [id]: { ...avant, ...m } };
    setReponses(suite);
    garder(suite, qui);
  };
  const changerQui = (v: string) => {
    setQui(v);
    garder(reponses, v);
  };

  const temoin = (
    <p
      role="status"
      className={`bg-sage-soft text-sage fixed top-3.5 right-4 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[16px] font-semibold motion-safe:transition-opacity ${enregistre ? "opacity-100" : "opacity-0"}`}
    >
      <I d={COCHE} /> {enregistre ? TEXTES.enregistre : ""}
    </p>
  );

  // ── Accueil ────────────────────────────────────────────────────────────────
  if (etape === -1) {
    const minutes = dureeTotale(n);
    const tuiles = [
      { icone: HORLOGE, texte: mMinutes(minutes) },
      { icone: COMPTE, texte: TEXTES.tuileSansCompte },
      { icone: AIDE, texte: TEXTES.tuileJeNeSaisPas },
      { icone: BOUCLIER, texte: TEXTES.tuileRienDeConfidentiel },
    ];
    return (
      <section aria-labelledby="q-titre">
        {temoin}
        <div className={`${carte} bg-halo-warm p-6 sm:p-9`}>
          {reprise !== null ? (
            <span className={pastille}>{TEXTES.vousEnEtiez(Math.min(reprise + 1, n))}</span>
          ) : null}
          <h1
            id="q-titre"
            ref={titre}
            tabIndex={-1}
            className="mt-4 font-serif text-[40px] leading-[1.05] font-medium tracking-tight focus:outline-none sm:text-[48px]"
          >
            {nQuestions(n)},
            <br />
            <span className="text-terracotta italic">
              {TEXTES.environ} {mMinutes(minutes)}
            </span>
          </h1>
          <p className="text-fg-soft mt-4 text-[20px] leading-relaxed">{TEXTES.accueilLigne}</p>
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {tuiles.map((t) => (
            <li key={t.texte} className={`${carte} flex flex-col items-start gap-2.5 p-4`}>
              <span className="bg-terracotta-soft text-terracotta-deep grid h-11 w-11 place-items-center rounded-xl">
                <I d={t.icone} />
              </span>
              <span className="text-[17px] leading-tight font-semibold">{t.texte}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`${boutonPrincipal} mt-7 min-h-[60px] w-full text-[20px] sm:w-auto`}
          onClick={() => aller(reprise ?? 0)}
        >
          {reprise !== null ? TEXTES.reprendre : TEXTES.commencer} <I d={FLECHE} />
        </button>
        <p className="text-fg-soft mt-4 text-[17px]">{TEXTES.accueilGarde}</p>
      </section>
    );
  }

  // ── Une question ───────────────────────────────────────────────────────────
  if (etape < n) {
    const q = questions[etape];
    if (!q) return null;
    const r = reponses[q.id];
    const jsp = r?.j === true;
    return (
      <section aria-labelledby="q-titre">
        {temoin}
        <div className="flex items-center justify-between gap-3">
          <p id="q-progression" className="text-terracotta-deep text-[18px] font-bold">
            {TEXTES.questionNsurM(etape + 1, n)}
          </p>
          <p className="text-fg-soft inline-flex items-center gap-1.5 text-[17px]">
            <I d={HORLOGE} /> {TEXTES.environMin(dureeRestante(n - etape))}
          </p>
        </div>
        <div
          className="mt-3 flex gap-1.5"
          role="progressbar"
          aria-labelledby="q-progression"
          aria-valuemin={1}
          aria-valuemax={n}
          aria-valuenow={etape + 1}
        >
          {questions.map((x, i) => (
            <span
              key={x.id}
              className={`h-2 flex-1 rounded-full ${i < etape ? "bg-terracotta" : i === etape ? "bg-terracotta/45" : "bg-sand-deep"}`}
            />
          ))}
        </div>

        <div className={`${carte} mt-6 p-5 sm:p-8`}>
          <h1
            id="q-titre"
            ref={titre}
            tabIndex={-1}
            className="text-[24px] leading-snug font-bold tracking-tight focus:outline-none sm:text-[28px]"
          >
            <label htmlFor={`r-${q.id}`}>{q.titre}</label>
          </h1>
          <p className="text-fg-soft mt-2 flex items-start gap-2 text-[18px]">
            <span className="text-terracotta mt-0.5">
              <I d={INFO} />
            </span>
            <span>{q.aide ?? TEXTES.aideParDefaut}</span>
          </p>
          {q.puces.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={TEXTES.puces}>
              {q.puces.map((p) => {
                const coche = r?.p.includes(p) === true;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={coche}
                    onClick={() =>
                      modifier(q.id, {
                        p: coche ? (r?.p ?? []).filter((x) => x !== p) : [...(r?.p ?? []), p],
                        j: false,
                      })
                    }
                    className={`inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-[17px] font-semibold motion-safe:transition-colors ${focus} ${
                      coche
                        ? "border-terracotta bg-terracotta-soft text-terracotta-deep"
                        : "border-border bg-paper text-fg hover:border-terracotta/50"
                    }`}
                  >
                    {coche ? <I d={COCHE} /> : null}
                    {p}
                  </button>
                );
              })}
            </div>
          ) : null}
          <textarea
            id={`r-${q.id}`}
            rows={3}
            className={`${champ} mt-4`}
            value={r?.t ?? ""}
            maxLength={5000}
            onChange={(e) => modifier(q.id, { t: e.target.value, j: false })}
            placeholder={q.puces.length > 0 ? TEXTES.placeholderPuces : TEXTES.placeholder}
          />
          <button
            type="button"
            aria-pressed={jsp}
            onClick={() => {
              if (jsp) {
                modifier(q.id, { j: false });
                return;
              }
              modifier(q.id, { j: true });
              setTimeout(suivant, 250);
            }}
            className={`mt-3 inline-flex min-h-12 items-center gap-2 rounded-2xl border-2 px-4 text-[17px] font-semibold motion-safe:transition-colors ${focus} ${
              jsp
                ? "border-fg-soft bg-paper text-fg border-solid"
                : "border-border-strong text-fg-soft hover:border-fg-soft border-dashed"
            }`}
          >
            <I d={jsp ? COCHE : AIDE} /> {TEXTES.jeNeSaisPas}
          </button>
        </div>

        <div className={barreBas}>
          <div className="flex items-center justify-between gap-3">
            <button type="button" className={boutonSecondaire} onClick={() => aller(etape - 1)}>
              <I d={RETOUR} /> {etape === 0 ? TEXTES.accueil : TEXTES.precedent}
            </button>
            <button
              type="button"
              className={`${boutonPrincipal} min-h-[52px] px-7`}
              onClick={suivant}
            >
              {depuisRelecture
                ? TEXTES.retourRelecture
                : etape === n - 1
                  ? TEXTES.relire
                  : TEXTES.suivant}
              <I d={FLECHE} />
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── Relecture, puis envoi ──────────────────────────────────────────────────
  const message = erreur ? MESSAGES_ERREUR[erreur] : undefined;
  return (
    <section aria-labelledby="q-titre">
      {temoin}
      <span className={pastille}>{TEXTES.derniereEtape}</span>
      <h1
        id="q-titre"
        ref={titre}
        tabIndex={-1}
        className="mt-4 font-serif text-[36px] leading-tight font-medium tracking-tight focus:outline-none"
      >
        {TEXTES.relectureTitre}
      </h1>
      <p className="text-fg-soft mt-2 text-[18px]">{TEXTES.relectureLigne}</p>
      {horsLigne ? (
        <div role="alert" className="bg-terracotta-soft mt-5 rounded-2xl p-4">
          <p className="text-[18px] font-bold">{TEXTES.horsLigneTitre}</p>
          <p className="text-fg-soft text-[18px]">{TEXTES.horsLigneTexte}</p>
          <button
            type="button"
            className={`${boutonSecondaire} mt-3`}
            onClick={() => setHorsLigne(false)}
          >
            {TEXTES.reessayer}
          </button>
        </div>
      ) : message ? (
        <div role="alert" className="bg-terracotta-soft mt-5 rounded-2xl p-4">
          <p className="text-[18px] font-semibold">{message}</p>
          {erreur === "vide" ? (
            <button type="button" className={`${boutonSecondaire} mt-3`} onClick={() => aller(0)}>
              {TEXTES.revenirAuxQuestions}
            </button>
          ) : null}
        </div>
      ) : null}
      <ol className="mt-6 space-y-3">
        {questions.map((q, i) => {
          const v = valeur(reponses[q.id]);
          return (
            <li key={q.id} className={`${carte} flex items-start gap-3 rounded-2xl p-4`}>
              <span
                aria-hidden="true"
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-[17px] font-bold ${v ? "bg-terracotta text-white" : "bg-sand text-fg-soft"}`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-semibold">{q.titre}</p>
                <p
                  className={`mt-1 text-[17px] break-words whitespace-pre-line ${v ? "text-fg-soft" : "text-fg-muted italic"}`}
                >
                  {v || TEXTES.sansReponse}
                </p>
                <button
                  type="button"
                  className={`text-terracotta-deep -ml-2 inline-flex min-h-12 items-center gap-1.5 rounded-full px-2 text-[16px] font-semibold ${focus}`}
                  onClick={() => {
                    setDepuisRelecture(true);
                    aller(i);
                  }}
                  aria-label={TEXTES.modifierLaReponse(i + 1)}
                >
                  <I d={CRAYON} className="h-4 w-4" /> {TEXTES.modifier}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <form
        action={envoyerReponsesAction}
        className="mt-6"
        onSubmit={(e) => {
          // Hors ligne : on ne quitte pas la page — le brouillon reste, on réessaie.
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            e.preventDefault();
            setHorsLigne(true);
            return;
          }
          setEnvoi(true);
        }}
      >
        <input type="hidden" name="questionnaireId" value={questionnaireId} />
        <input type="hidden" name="jeton" value={jeton} />
        {questions.map((q) => (
          <input key={q.id} type="hidden" name={`reponse_${q.id}`} value={valeur(reponses[q.id])} />
        ))}
        <div className={`${carte} rounded-2xl p-5`}>
          <label htmlFor="repondant" className="text-[18px] font-semibold">
            {TEXTES.nomFonction}{" "}
            <span className="text-fg-soft font-normal">{TEXTES.nomFonctionAide}</span>
          </label>
          <input
            id="repondant"
            name="repondant"
            type="text"
            autoComplete="name"
            maxLength={MAX_QUI_REPOND}
            className={`${champ} mt-2 min-h-[56px]`}
            value={qui}
            onChange={(e) => changerQui(e.target.value)}
          />
        </div>
        <p className="text-fg-soft mt-5 flex items-start gap-2 text-[18px] leading-relaxed">
          <span className="text-terracotta mt-1">
            <I d={CADENAS} />
          </span>
          {TEXTES.definitif}
        </p>
        <div className={barreBas}>
          <button
            type="submit"
            className={`${boutonPrincipal} min-h-[60px] w-full text-[20px]`}
            disabled={envoi}
          >
            {envoi ? TEXTES.envoiEnCours : TEXTES.envoyer} <I d={ENVOI} />
          </button>
        </div>
      </form>
    </section>
  );
}
