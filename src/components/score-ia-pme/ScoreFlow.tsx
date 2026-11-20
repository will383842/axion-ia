"use client";
// use-client: parcours à état (15 écrans), calcul du score dans le navigateur, gestion du focus.
//
// Score IA TPE-PME — E1 à E15 (questions) et E16 (résultat). Plan V2-10 §2, §3, §8 + amendements.
// 🔒 Aucun envoi réseau d'ici : ni `fetch`, ni Server Action, ni balise. L'ajout à l'Observatoire
// vit dans `AjoutObservatoire`, qui n'agit qu'après la case cochée ET le bouton pressé.
// Poids : pas de Zod, pas de bibliothèque de graphiques (barres CSS), aucune icône ; tous les
// libellés arrivent en props depuis le serveur.

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { calculerScore, POIDS, type CritereId } from "@/lib/score-ia-pme/formule";
import { pourcentageInferieur, type SegmentComparaison } from "@/lib/score-ia-pme/comparaison";
import { SECTEUR_AUTRE } from "@/lib/score-ia-pme/libelles";
import { pistesPour } from "@/content/score-ia-pme/pistes";
import {
  BOUTON_COMMENCER,
  COMPARAISON,
  CRITERES_LIBELLES,
  ECRANS,
  NB_QUESTIONS,
  PHRASE_NEUTRE,
  RETRAIT,
} from "@/content/score-ia-pme/textes";
import { trackEvent } from "@/lib/analytics/plausible-tracker";
import { AjoutObservatoire } from "./AjoutObservatoire";
import type { OptionProps, QuestionProps } from "@/content/score-ia-pme/types";

export type { OptionProps, QuestionProps } from "@/content/score-ia-pme/types";

export interface SnapshotComparaison {
  readonly genereLe: string;
  readonly global: SegmentComparaison | null;
  readonly parTaille: Readonly<Record<string, SegmentComparaison>>;
  readonly parSecteur: Readonly<Record<string, SegmentComparaison>>;
}

export interface ScoreFlowProps {
  readonly questions: readonly QuestionProps[];
  readonly libellesTaille: Readonly<Record<string, string>>;
  readonly snapshot: SnapshotComparaison | null;
  readonly encadre: readonly string[];
  readonly hrefConfidentialite: string;
  readonly prixJournee: string;
}

type Reponse = string | string[];
type Reponses = Record<string, Reponse>;

const SCORE_MAX = 100;

function melangerOptions(options: readonly OptionProps[], exclusif?: string): OptionProps[] {
  const fin = options.filter((o) => o.value === exclusif);
  const reste = options.filter((o) => o.value !== exclusif);
  for (let i = reste.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [reste[i], reste[j]] = [reste[j] as OptionProps, reste[i] as OptionProps];
  }
  return [...reste, ...fin];
}

function formaterDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function nombre(n: number): string {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

export function ScoreFlow({
  questions,
  libellesTaille,
  snapshot,
  encadre,
  hrefConfidentialite,
  prixJournee,
}: ScoreFlowProps) {
  // -1 = accueil (bouton « Commencer »), 0..N-1 = questions, N = résultat.
  const [etape, setEtape] = React.useState(-1);
  const [reponses, setReponses] = React.useState<Reponses>({});
  const [ordres, setOrdres] = React.useState<Record<string, readonly OptionProps[]>>({});
  const [erreur, setErreur] = React.useState(false);
  const [annonce, setAnnonce] = React.useState("");
  const [debut, setDebut] = React.useState(0);
  const titreRef = React.useRef<HTMLHeadingElement>(null);
  const resultatRef = React.useRef<HTMLHeadingElement>(null);
  const [, startTransition] = React.useTransition();

  const total = questions.length;
  const enResultat = etape === total;

  // Focus : sur la question à chaque écran, sur le titre du résultat à la fin.
  React.useEffect(() => {
    if (etape >= 0 && etape < total) titreRef.current?.focus();
    if (enResultat) resultatRef.current?.focus();
  }, [etape, total, enResultat]);

  const commencer = () => {
    const o: Record<string, readonly OptionProps[]> = {};
    for (const q of questions) {
      o[q.id] = q.melanger ? melangerOptions(q.options, q.exclusif) : q.options;
    }
    setOrdres(o);
    setDebut(Date.now());
    trackEvent("Score commencé");
    startTransition(() => setEtape(0));
    setAnnonce(ECRANS.question(1));
  };

  const aller = (cible: number) => {
    setErreur(false);
    startTransition(() => setEtape(cible));
    if (cible >= 0 && cible < total) setAnnonce(ECRANS.question(cible + 1));
  };

  const choisirUnique = (q: QuestionProps, valeur: string) => {
    setErreur(false);
    setReponses((r) => ({ ...r, [q.id]: valeur }));
  };

  const basculerMultiple = (q: QuestionProps, valeur: string, coche: boolean) => {
    setErreur(false);
    const actuel = (reponses[q.id] as string[] | undefined) ?? [];
    let suivant: string[];
    if (!coche) {
      suivant = actuel.filter((v) => v !== valeur);
    } else if (q.exclusif && valeur === q.exclusif) {
      suivant = [valeur];
      if (actuel.some((v) => v !== valeur)) setAnnonce(ECRANS.exclusifRetire);
    } else {
      const sansExclusif = actuel.filter((v) => v !== q.exclusif);
      if (q.exclusif && actuel.includes(q.exclusif)) setAnnonce(ECRANS.exclusifRetire);
      if (q.max !== undefined && sansExclusif.length >= q.max) {
        setAnnonce(ECRANS.plafond(q.max));
        return;
      }
      suivant = [...sansExclusif, valeur];
    }
    setReponses((r) => ({ ...r, [q.id]: suivant }));
  };

  const suivant = () => {
    const q = questions[etape];
    if (!q) return;
    const rep = reponses[q.id];
    const ok = q.type === "multi" ? Array.isArray(rep) && rep.length > 0 : typeof rep === "string";
    if (!ok) {
      setErreur(true);
      return;
    }
    if (etape + 1 === total) trackEvent("Score terminé");
    aller(etape + 1);
  };

  // ── Accueil : le seul élément rendu avant « Commencer » est le bouton ──────────────────────
  if (etape < 0) {
    return (
      <div className="min-h-[7rem]">
        <p className="mb-4 text-sm">{PHRASE_NEUTRE}</p>
        <button
          type="button"
          onClick={commencer}
          className="bg-terracotta inline-flex min-h-[48px] items-center rounded-lg px-6 text-base font-semibold text-white"
        >
          {BOUTON_COMMENCER}
        </button>
      </div>
    );
  }

  const zoneAnnonce = (
    <p role="status" aria-live="polite" className="sr-only">
      {annonce}
    </p>
  );

  // ── Questions ─────────────────────────────────────────────────────────────────────────────
  if (!enResultat) {
    const q = questions[etape] as QuestionProps;
    const options = ordres[q.id] ?? q.options;
    const rep = reponses[q.id];
    const erreurId = `err-${q.id}`;
    const noteId = `note-${q.id}`;
    const incoherent =
      q.id === "useCases" &&
      reponses["maturityLevel"] === "none" &&
      Array.isArray(rep) &&
      rep.some((v) => v !== "none");

    return (
      <div className="min-h-[30rem]">
        {zoneAnnonce}
        <div className="mb-4 flex items-center justify-between text-sm">
          <span>{ECRANS.question(etape + 1)}</span>
        </div>
        <div aria-hidden="true" className="bg-ink/10 mb-6 h-1.5 w-full overflow-hidden rounded">
          <div
            className="bg-terracotta h-full motion-safe:transition-[width]"
            style={{ width: `${((etape + 1) / NB_QUESTIONS) * 100}%` }}
          />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            suivant();
          }}
          noValidate
        >
          <fieldset
            aria-describedby={
              [erreur ? erreurId : null, q.note ? noteId : null].filter(Boolean).join(" ") ||
              undefined
            }
          >
            <legend className="mb-4">
              <h2 ref={titreRef} tabIndex={-1} className="text-xl font-semibold outline-none">
                {q.label}
              </h2>
            </legend>
            <div className="space-y-2">
              {options.map((o, i) => {
                const titreGroupe =
                  i === 0 || o.groupe !== options[i - 1]?.groupe ? o.groupe : undefined;
                const coche =
                  q.type === "multi"
                    ? Array.isArray(rep) && rep.includes(o.value)
                    : rep === o.value;
                return (
                  <React.Fragment key={o.value}>
                    {titreGroupe ? (
                      <p className="text-ink/70 pt-3 text-sm font-semibold">{titreGroupe}</p>
                    ) : null}
                    <label className="border-ink/20 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border bg-white px-4 py-2">
                      <input
                        type={q.type === "multi" ? "checkbox" : "radio"}
                        name={q.id}
                        value={o.value}
                        checked={coche}
                        onChange={(e) =>
                          q.type === "multi"
                            ? basculerMultiple(q, o.value, e.target.checked)
                            : choisirUnique(q, o.value)
                        }
                        className="h-5 w-5 shrink-0"
                      />
                      <span>{o.label}</span>
                    </label>
                  </React.Fragment>
                );
              })}
            </div>
          </fieldset>
          {q.note ? (
            <p id={noteId} className="text-ink/70 mt-3 text-sm">
              {q.note}
            </p>
          ) : null}
          {incoherent ? (
            <p role="status" className="mt-3 text-sm">
              {ECRANS.incoherence}
            </p>
          ) : null}
          <p id={erreurId} role="alert" className="text-terracotta mt-3 min-h-[1.5rem] text-sm">
            {erreur ? ECRANS.choisirReponse : ""}
          </p>
          <div className="mt-4 flex gap-3">
            {etape > 0 ? (
              <button
                type="button"
                onClick={() => aller(etape - 1)}
                className="border-ink/60 inline-flex min-h-[44px] items-center rounded-lg border px-5 text-sm font-medium"
              >
                {ECRANS.precedent}
              </button>
            ) : null}
            <button
              type="submit"
              className="bg-terracotta inline-flex min-h-[44px] items-center rounded-lg px-6 text-sm font-semibold text-white"
            >
              {etape + 1 === total ? ECRANS.voirResultat : ECRANS.suivant}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Résultat ──────────────────────────────────────────────────────────────────────────────
  return (
    <Resultat
      questions={questions}
      reponses={reponses}
      libellesTaille={libellesTaille}
      snapshot={snapshot}
      encadre={encadre}
      hrefConfidentialite={hrefConfidentialite}
      prixJournee={prixJournee}
      debut={debut}
      titreRef={resultatRef}
      onModifier={() => aller(0)}
      zoneAnnonce={zoneAnnonce}
    />
  );
}

interface ResultatProps extends ScoreFlowProps {
  reponses: Reponses;
  debut: number;
  titreRef: React.RefObject<HTMLHeadingElement | null>;
  onModifier: () => void;
  zoneAnnonce: React.ReactElement;
}

function Resultat({
  reponses,
  libellesTaille,
  snapshot,
  encadre,
  hrefConfidentialite,
  prixJournee,
  debut,
  titreRef,
  onModifier,
  zoneAnnonce,
}: ResultatProps) {
  const r = React.useMemo(
    () =>
      calculerScore({
        maturityLevel: reponses["maturityLevel"] as string,
        hasStrategy: reponses["hasStrategy"] as string,
        useCases: reponses["useCases"] as string[],
        teamTrained: reponses["teamTrained"] as string,
        timeSavedPerDay: reponses["timeSavedPerDay"] as string,
        annualBudget: reponses["annualBudget"] as string,
        tools: reponses["tools"] as string[],
      }),
    [reponses],
  );

  const taille = reponses["companySize"] as string;
  const secteur = reponses["sector"] as string;
  const segTaille = snapshot?.parTaille[taille];
  const segSecteur = secteur === SECTEUR_AUTRE ? undefined : snapshot?.parSecteur[secteur];
  const date = snapshot ? formaterDate(snapshot.genereLe) : "";
  const pistes = pistesPour((reponses["barriers"] as string[]) ?? [], 3);

  return (
    <div className="min-h-[30rem]">
      {zoneAnnonce}
      <h2 ref={titreRef} tabIndex={-1} className="text-xl font-semibold outline-none">
        {ECRANS.votreScore}
      </h2>
      <p className="mt-2 text-5xl font-bold">
        {r.score} <span className="text-2xl font-medium">sur {SCORE_MAX}</span>
      </p>
      <p className="mt-1 text-lg">
        {ECRANS.niveau} : <strong>{r.niveau}</strong>
      </p>

      <h3 className="mt-6 text-base font-semibold">{ECRANS.detail}</h3>
      <ul className="mt-2 space-y-3">
        {r.detail.map((d) => (
          <li key={d.critere}>
            <p className="text-sm">
              {CRITERES_LIBELLES[d.critere]} : {nombre(d.obtenus)} points sur{" "}
              {POIDS[d.critere as CritereId]}
            </p>
            <div aria-hidden="true" className="bg-ink/10 mt-1 h-2 w-full overflow-hidden rounded">
              <div
                className="bg-terracotta h-full"
                style={{ width: `${(d.obtenus / d.possibles) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <section aria-labelledby="score-comparaison" className="mt-6 min-h-[7rem]">
        <h3 id="score-comparaison" className="text-base font-semibold">
          {COMPARAISON.titre}
        </h3>
        {snapshot ? (
          <div className="mt-2 space-y-2 text-sm">
            {segTaille ? (
              <p>
                {COMPARAISON.parTaille(
                  segTaille.n,
                  libellesTaille[taille] ?? taille,
                  pourcentageInferieur(segTaille, r.score),
                )}
              </p>
            ) : snapshot.global ? (
              <p>
                {COMPARAISON.global(
                  snapshot.global.n,
                  pourcentageInferieur(snapshot.global, r.score),
                )}
              </p>
            ) : (
              <p>{COMPARAISON.tailleAbsente}</p>
            )}
            {secteur === SECTEUR_AUTRE ? (
              <p>{COMPARAISON.secteurAutre}</p>
            ) : segSecteur ? (
              <p>
                {COMPARAISON.parSecteur(segSecteur.n, pourcentageInferieur(segSecteur, r.score))}
              </p>
            ) : (
              <p>{COMPARAISON.secteurPasAssez}</p>
            )}
            <p className="text-ink/70">{COMPARAISON.methode(date)}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm">{COMPARAISON.bientot}</p>
        )}
      </section>

      {pistes.length > 0 ? (
        <section aria-labelledby="score-pistes" className="mt-6">
          <h3 id="score-pistes" className="text-base font-semibold">
            {ECRANS.pistesTitre}
          </h3>
          <p className="text-ink/70 text-sm">{ECRANS.pistesIntro}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {pistes.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="score-sorties" className="mt-6 print:hidden">
        <h3 id="score-sorties" className="text-base font-semibold">
          {ECRANS.sortiesTitre}
        </h3>
        <ul className="mt-2 grid gap-3 sm:grid-cols-3">
          <li className="border-ink/15 rounded-lg border bg-white p-4 text-sm">
            <Link href="/roi" className="font-semibold underline">
              {ECRANS.sorties.roi.titre}
            </Link>
            <p className="mt-1">{ECRANS.sorties.roi.texte}</p>
          </li>
          <li className="border-ink/15 rounded-lg border bg-white p-4 text-sm">
            <Link href="/journee-ia" className="font-semibold underline">
              {ECRANS.sorties.journee.titre}
            </Link>
            <p className="mt-1">
              {ECRANS.sorties.journee.texte} {prixJournee}
            </p>
          </li>
          <li className="border-ink/15 rounded-lg border bg-white p-4 text-sm">
            <Link href="/appel" className="font-semibold underline">
              {ECRANS.sorties.appel.titre}
            </Link>
            <p className="mt-1">{ECRANS.sorties.appel.texte}</p>
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="border-ink/60 inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-medium"
          >
            {ECRANS.imprimer}
          </button>
          <button
            type="button"
            onClick={onModifier}
            className="border-ink/60 inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-medium"
          >
            {ECRANS.modifier}
          </button>
        </div>
      </section>

      <div id="observatoire-ajout" className="mt-8 print:hidden">
        <AjoutObservatoire
          reponses={reponses}
          debutParcours={debut}
          encadre={encadre}
          hrefConfidentialite={hrefConfidentialite}
        />
      </div>

      <p className="mt-6 text-sm print:hidden">
        <a href="#retrait" className="underline">
          {RETRAIT.titre}
        </a>
      </p>
    </div>
  );
}
