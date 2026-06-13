"use client";
// use-client: bouton de déconnexion espace ressources (useTransition + router).

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { logoutRessourcesAction } from "@/server/actions/ressources/auth.actions";
import { RESSOURCES_CONNEXION_PATH } from "@/server/ressources/routes";

export function RessourcesLogoutButton(): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await logoutRessourcesAction();
          router.replace(RESSOURCES_CONNEXION_PATH);
          router.refresh();
        })
      }
      className="text-terracotta hover:underline disabled:opacity-50"
    >
      Déconnexion
    </button>
  );
}
