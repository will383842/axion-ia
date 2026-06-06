"use client";
// use-client: bouton déconnexion portail stagiaire avec useTransition + redirect.
/**
 * QuitterPortailButton — Bouton de déconnexion du portail stagiaire.
 *
 * Appelle `quitterPortailAction` (supprime le cookie HttpOnly) puis redirige
 * vers la page d&apos;accueil.
 *
 * Sobre (charte publique — PAS de tokens admin).
 */

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type ActionResult<T> = { data: T } | { error: string };

interface QuitterPortailButtonProps {
  quitterAction: () => Promise<ActionResult<{ ok: boolean }>>;
  locale: string;
}

export function QuitterPortailButton({
  quitterAction,
  locale,
}: QuitterPortailButtonProps): React.ReactElement {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleQuitter() {
    startTransition(async () => {
      await quitterAction();
      router.push(`/${locale}`);
    });
  }

  return (
    <button
      type="button"
      onClick={handleQuitter}
      disabled={isPending}
      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
    >
      {isPending ? "..." : "Se déconnecter"}
    </button>
  );
}
