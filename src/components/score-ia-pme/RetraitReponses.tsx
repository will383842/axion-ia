"use client";
// use-client: saisie du code, empreinte calculée dans le navigateur, jeton anti-robot.
//
// Score IA TPE-PME — E-R « Retirer mes réponses ». Chargé à la demande (next/dynamic) au clic.
// Le navigateur n'envoie que SHA-256(code). Réponse identique que le code existe ou non.

import * as React from "react";
import { useTurnstileToken } from "@/components/forms/TurnstileWidget";
import { retirerReponsesScore } from "@/server/actions/score-ia-pme/retirer";
import { codeValide, empreinteDuCode, normaliserCode } from "@/lib/score-ia-pme/code-retrait";
import { trackEvent } from "@/lib/analytics/plausible-tracker";
import { RETRAIT } from "@/content/score-ia-pme/textes";

export function RetraitReponses() {
  const [saisie, setSaisie] = React.useState("");
  const [message, setMessage] = React.useState<{ ok: boolean; texte: string } | null>(null);
  const champRef = React.useRef<HTMLInputElement>(null);
  // Le bouton d'ouverture disparaît au clic : le focus passe au champ (WCAG 2.4.3).
  React.useEffect(() => {
    champRef.current?.focus();
  }, []);
  const [envoi, setEnvoi] = React.useState(false);
  const { token, widget, blocked, reset } = useTurnstileToken("score-ia-pme-retrait");
  const siteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"];

  const retirer = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (envoi) return;
      const code = normaliserCode(saisie);
      if (!codeValide(code)) {
        setMessage({ ok: false, texte: code === "" ? RETRAIT.vide : RETRAIT.invalide });
        return;
      }
      if (blocked) {
        setMessage({ ok: false, texte: RETRAIT.antiRobotBloque });
        return;
      }
      const jeton = token || (siteKey ? "" : "sans-widget");
      if (!jeton) {
        setMessage({ ok: false, texte: RETRAIT.antiRobotEnCours });
        return;
      }
      setEnvoi(true);
      try {
        const r = await retirerReponsesScore({
          empreinte: await empreinteDuCode(code),
          turnstileToken: jeton,
        });
        setMessage(r.ok ? { ok: true, texte: r.message } : { ok: false, texte: r.error });
        if (r.ok) trackEvent("Réponse retirée");
      } catch {
        setMessage({ ok: false, texte: RETRAIT.erreur });
      } finally {
        setEnvoi(false);
        reset();
      }
    },
    [envoi, saisie, blocked, token, siteKey, reset],
  );

  return (
    <form onSubmit={retirer} className="mt-3 space-y-3" noValidate>
      <label className="block text-sm font-medium" htmlFor="score-retrait-code">
        {RETRAIT.champ}
      </label>
      <input
        id="score-retrait-code"
        ref={champRef}
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={saisie}
        onChange={(e) => setSaisie(e.target.value)}
        aria-describedby={message && !message.ok ? "score-retrait-message" : undefined}
        className="border-ink/60 min-h-[44px] w-full max-w-xs rounded-lg border px-3 font-mono tracking-wider"
      />
      {widget}
      <button
        type="submit"
        className="border-ink/60 inline-flex min-h-[44px] items-center rounded-lg border px-4 text-sm font-semibold"
      >
        {RETRAIT.bouton}
      </button>
      <div className="min-h-[1.5rem] text-sm">
        <p id="score-retrait-confirmation" role="status" aria-live="polite">
          {message?.ok ? message.texte : ""}
        </p>
        <p id="score-retrait-message" role="alert">
          {message && !message.ok ? message.texte : ""}
        </p>
      </div>
    </form>
  );
}
