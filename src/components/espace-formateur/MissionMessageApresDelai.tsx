"use client";
// use-client: champ libre + useTransition vers ecrireApresDelaiAction, état local du retour.

/**
 * Le seul geste qui reste au formateur quand son délai est passé.
 *
 * 🔴 Avant, un lien échu n'offrait rien : un message d'erreur, et une invitation
 * à se connecter à un espace où la proposition n'apparaît plus. Or c'est
 * exactement l'instant où le formateur a quelque chose d'utile à dire — « j'étais
 * en intervention, je suis disponible, la session est-elle encore libre ? ».
 *
 * Le message ne « répond » PAS à la proposition : celle-ci est close, et rouvrir
 * un accord par un champ de texte libre laisserait un engagement hors du
 * registre. Il alerte l'organisme, qui décide.
 */

import { useState, useTransition } from "react";

type ActionResult<T> = { data: T } | { error: string };

export interface MissionMessageApresDelaiProps {
  token: string;
  action: (input: { token: string; message: string }) => Promise<ActionResult<{ envoye: true }>>;
}

export function MissionMessageApresDelai({
  token,
  action,
}: MissionMessageApresDelaiProps): React.ReactElement {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);

  if (envoye) {
    return (
      <div role="status" className="border-border mt-4 rounded-lg border p-4">
        <p className="text-mocha text-sm font-semibold">Message transmis.</p>
        <p className="text-fg-soft mt-1 text-sm">
          Il est arrivé à côté de la session concernée. Si personne n&apos;a encore été affecté,
          nous vous rappellerons.
        </p>
      </div>
    );
  }

  function envoyer(e: React.FormEvent): void {
    e.preventDefault();
    setErreur(null);
    startTransition(async () => {
      const r = await action({ token, message });
      if ("error" in r) {
        setErreur(r.error);
        return;
      }
      setEnvoye(true);
    });
  }

  return (
    <form onSubmit={envoyer} className="border-border mt-4 rounded-lg border p-4">
      <label htmlFor="mission-message" className="text-mocha block text-sm font-semibold">
        Vous êtes malgré tout disponible ? Dites-le-nous.
      </label>
      <p className="text-fg-soft mt-1 text-sm">
        Nous n&apos;avons peut-être pas encore confié la session à quelqu&apos;un d&apos;autre.
      </p>
      <textarea
        id="mission-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        disabled={isPending}
        rows={3}
        maxLength={2000}
        required
        placeholder="Ex. : j'étais en intervention sans réseau, je suis disponible sur ces dates."
        className="border-border mt-3 w-full rounded-md border p-2 text-sm"
      />
      {erreur !== null && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {erreur}
        </p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="bg-terracotta mt-3 rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isPending ? "Envoi…" : "Envoyer à l'organisme"}
      </button>
    </form>
  );
}
