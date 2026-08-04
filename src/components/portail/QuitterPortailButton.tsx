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
      // 🔴 Ce bouton était un bouton BLANC bordé de gris, posé dans la coquille
      // sombre des espaces (pied de barre latérale et en-tête mobile, tous deux
      // `bg-mocha`) : une pastille claire au milieu du mocha, qui attirait l'œil
      // plus que n'importe quel élément de navigation alors qu'il ne sert qu'à
      // partir. Aligné sur son jumeau formateur — même geste, même apparence,
      // et le `terracotta-on-mocha` calibré pour ce fond (5,82:1).
      className="text-terracotta-on-mocha focus-visible:ring-terracotta-on-mocha rounded-sm text-sm hover:underline focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
    >
      {isPending ? "..." : "Se déconnecter"}
    </button>
  );
}
