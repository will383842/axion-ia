"use client";
// use-client: saisie du code, empreinte calculée dans le navigateur, jeton anti-robot.
//
// Questionnaire du Baromètre 2027 — « Retirer mes réponses ». Ouverture à la demande : aucune
// saisie, aucun réseau, aucun Turnstile tant que la personne n'a pas cliqué.
// Le navigateur n'envoie que SHA-256(code). Réponse identique que le code existe ou non.

import * as React from "react";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { retirerReponsesQuestionnaire } from "@/server/actions/barometre-questionnaire/retirer";
import { codeValide, empreinteDuCode, normaliserCode } from "@/lib/score-ia-pme/code-retrait";

export interface RetraitTextes {
  readonly ouvrir: string;
  readonly champ: string;
  readonly bouton: string;
  readonly vide: string;
  readonly invalide: string;
  readonly antiRobotBloque: string;
  readonly antiRobotEnCours: string;
  readonly erreur: string;
}

function Formulaire({ t }: { t: RetraitTextes }) {
  const [saisie, setSaisie] = React.useState("");
  const [message, setMessage] = React.useState<{ ok: boolean; texte: string } | null>(null);
  const [envoi, setEnvoi] = React.useState(false);
  const champRef = React.useRef<HTMLInputElement>(null);
  const { token, widget, blocked, reset } = useTurnstileToken("barometre-questionnaire-retrait");
  const siteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"];

  React.useEffect(() => {
    champRef.current?.focus();
  }, []);

  const retirer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    const code = normaliserCode(saisie);
    if (!codeValide(code)) {
      setMessage({ ok: false, texte: code === "" ? t.vide : t.invalide });
      return;
    }
    if (blocked) {
      setMessage({ ok: false, texte: t.antiRobotBloque });
      return;
    }
    const jeton = token || (siteKey ? "" : "sans-widget");
    if (!jeton) {
      setMessage({ ok: false, texte: t.antiRobotEnCours });
      return;
    }
    setEnvoi(true);
    try {
      const r = await retirerReponsesQuestionnaire({
        empreinte: await empreinteDuCode(code),
        turnstileToken: jeton,
      });
      setMessage(r.ok ? { ok: true, texte: r.message } : { ok: false, texte: r.error });
    } catch {
      setMessage({ ok: false, texte: t.erreur });
    } finally {
      setEnvoi(false);
      reset();
    }
  };

  return (
    <form onSubmit={retirer} className="mt-3 space-y-3" noValidate>
      <label className="block text-sm font-medium" htmlFor="bq-retrait-code">
        {t.champ}
      </label>
      <input
        id="bq-retrait-code"
        ref={champRef}
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        className="border-ink/60 min-h-[44px] w-full max-w-xs rounded-lg border px-3 font-mono tracking-wider"
      />
      {widget}
      <button
        type="submit"
        className="border-ink/60 inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-semibold"
      >
        {t.bouton}
      </button>
      <div className="min-h-[1.5rem] text-sm">
        <p role="status" aria-live="polite">
          {message?.ok ? message.texte : ""}
        </p>
        <p role="alert">{message && !message.ok ? message.texte : ""}</p>
      </div>
    </form>
  );
}

export function RetraitQuestionnaire({ t }: { t: RetraitTextes }) {
  const [ouvert, setOuvert] = React.useState(false);
  return (
    <div className="min-h-[3rem]">
      {ouvert ? (
        <Formulaire t={t} />
      ) : (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="border-ink/60 inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-medium"
        >
          {t.ouvrir}
        </button>
      )}
    </div>
  );
}
