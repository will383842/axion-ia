"use client";
// use-client: bouton de déconnexion (useTransition + router).

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { logoutFormateurAction } from "@/server/actions/formateur/auth.actions";
import { FORMATEUR_CONNEXION_PATH } from "@/server/formateur/routes";

export function FormateurLogoutButton(): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await logoutFormateurAction();
          router.replace(FORMATEUR_CONNEXION_PATH);
          router.refresh();
        })
      }
      // 🔴 `text-terracotta-on-mocha`, PAS `text-terracotta`. Ce bouton est
      // rendu DANS la coquille sombre (pied de barre latérale et en-tête
      // mobile, tous deux `bg-mocha`). Le terracotta de marque y donne 2,61:1
      // — très sous le seuil AA de 4,5 — parce qu'il est calibré comme FOND
      // sous du texte ivoire, jamais comme texte sur fond sombre. La variante
      // dédiée existe depuis la refonte des espaces (5,82:1) ; elle n'avait
      // simplement pas été appliquée ici. `contrast:check` ne l'a pas vu : il
      // vérifie des paires DÉCLARÉES à la main, pas les couleurs réellement
      // employées ensemble à l'écran.
      className="text-terracotta-on-mocha focus-visible:ring-terracotta-on-mocha rounded-sm text-sm hover:underline focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
    >
      Déconnexion
    </button>
  );
}
