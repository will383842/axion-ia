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
      className="text-terracotta hover:underline disabled:opacity-50"
    >
      Déconnexion
    </button>
  );
}
