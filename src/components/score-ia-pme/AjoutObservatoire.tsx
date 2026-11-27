"use client";
// use-client: case à cocher, jeton anti-robot, code de retrait généré dans le navigateur.
//
// Score IA TPE-PME — E16-bis (ajout volontaire à l'Observatoire) et E17 (confirmation).
// Garantie centrale (plan V2-10 §4.2) : TANT QUE LA CASE N'EST PAS COCHÉE ET LE BOUTON PRESSÉ,
// RIEN NE PART — ni Server Action, ni `fetch`, ni balise. Turnstile n'est monté qu'au cochage.

import * as React from "react";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { ajouterALObservatoire } from "@/server/actions/score-ia-pme/ajouter-a-l-observatoire";
import { CONSENT_VERSION } from "@/lib/score-ia-pme/constantes";
import { empreinteDuCode, formaterCode, genererCode } from "@/lib/score-ia-pme/code-retrait";
import { trackEvent } from "@/lib/analytics/plausible-tracker";
import { AJOUT, TEXTE_CONSENTEMENT } from "@/content/score-ia-pme/textes";

const MARQUEUR = "score-ia-pme:ajoute";

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

export interface AjoutObservatoireProps {
  /** Les 15 réponses, telles que saisies (aucune autre clé). */
  reponses: Readonly<Record<string, string | readonly string[]>>;
  /** Instant du début du parcours (anti-robot : délai minimal côté serveur). */
  debutParcours: number;
  /** Paragraphes de l'encadré d'information (texte validé, lu des constantes côté serveur). */
  encadre: readonly string[];
  hrefConfidentialite: string;
}

export function AjoutObservatoire({
  reponses,
  debutParcours,
  encadre,
  hrefConfidentialite,
}: AjoutObservatoireProps) {
  const [coche, setCoche] = React.useState(false);
  const [statut, setStatut] = React.useState<"repos" | "envoi" | "ok">("repos");
  const [erreur, setErreur] = React.useState<string | null>(null);
  const [erreurCase, setErreurCase] = React.useState(false);
  const [code, setCode] = React.useState<string | null>(null);
  const [copie, setCopie] = React.useState(false);
  const honeypot = React.useRef<HTMLInputElement>(null);
  const titreConfirmation = React.useRef<HTMLHeadingElement>(null);
  const { token, widget, blocked, reset } = useTurnstileToken("score-ia-pme");
  const siteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"];

  React.useEffect(() => {
    if (statut === "ok") titreConfirmation.current?.focus();
  }, [statut]);

  const envoyer = React.useCallback(async () => {
    if (statut === "envoi") return;
    setErreur(null);
    if (!coche) {
      // Aucun envoi : message lié à la case.
      setErreurCase(true);
      return;
    }
    if (marqueurPresent()) {
      setErreur(AJOUT.dejaAjoute);
      return;
    }
    if (blocked) {
      setErreur(AJOUT.antiRobotBloque);
      return;
    }
    const jeton = token || (siteKey ? "" : "sans-widget");
    if (!jeton) {
      setErreur(AJOUT.antiRobotEnCours);
      return;
    }
    setStatut("envoi");
    try {
      const codeBrut = genererCode();
      const codeRetraitHash = await empreinteDuCode(codeBrut);
      const resultat = await ajouterALObservatoire({
        ...reponses,
        locale: "fr",
        consentement: true,
        consentVersion: CONSENT_VERSION,
        codeRetraitHash,
        turnstileToken: jeton,
        website: honeypot.current?.value ?? "",
        startedAt: debutParcours,
      });
      if (resultat.ok) {
        poserMarqueur();
        setCode(formaterCode(codeBrut));
        setStatut("ok");
        trackEvent("Observatoire ajouté");
      } else {
        setStatut("repos");
        setErreur(resultat.error || AJOUT.echec);
        reset();
      }
    } catch {
      setStatut("repos");
      setErreur(AJOUT.echec);
      reset();
    }
  }, [statut, coche, blocked, token, siteKey, reponses, debutParcours, reset]);

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
        aria-labelledby="score-ajout-confirmation"
        className="border-ink/15 rounded-xl border bg-white p-5 sm:p-6"
      >
        <h3
          id="score-ajout-confirmation"
          ref={titreConfirmation}
          tabIndex={-1}
          className="text-lg font-semibold outline-none"
        >
          {AJOUT.confirmation}
        </h3>
        <p className="mt-3 text-sm font-medium">{AJOUT.codeTitre}</p>
        <p
          className="mt-1 font-mono text-2xl tracking-wider select-all"
          aria-label={`${AJOUT.codeTitre} : ${[...code.replace(/ /g, "")].join(" ")}`}
        >
          {code}
        </p>
        <p className="mt-3 text-sm">{AJOUT.codeAvertissement}</p>
        <button
          type="button"
          onClick={copier}
          className="border-ink/60 mt-3 inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-medium"
        >
          {AJOUT.copier}
        </button>
        <p role="status" aria-live="polite" className="mt-2 min-h-[1.5rem] text-sm">
          {copie ? AJOUT.copie : ""}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="score-ajout-titre"
      className="border-ink/15 rounded-xl border bg-white p-5 sm:p-6"
    >
      <h3 id="score-ajout-titre" className="text-lg font-semibold">
        {AJOUT.titre}
      </h3>
      <div className="mt-3 space-y-2 text-sm leading-relaxed">
        {encadre.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p>
          <a className="underline" href={hrefConfidentialite}>
            {AJOUT.lienConfidentialite}
          </a>
        </p>
      </div>
      <label className="mt-4 flex min-h-[44px] cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={coche}
          onChange={(e) => {
            setCoche(e.target.checked);
            if (e.target.checked) setErreurCase(false);
          }}
          aria-describedby={erreurCase ? "score-ajout-erreur-case" : undefined}
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>{TEXTE_CONSENTEMENT}</span>
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
        <p id="score-ajout-erreur-case" role="alert" className="text-terracotta mt-2 text-sm">
          {AJOUT.caseManquante}
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
        type="button"
        onClick={envoyer}
        className="bg-ink mt-4 inline-flex min-h-[44px] items-center rounded-lg px-5 text-sm font-semibold text-white"
      >
        {statut === "envoi" ? AJOUT.enCours : AJOUT.bouton}
      </button>
    </section>
  );
}
