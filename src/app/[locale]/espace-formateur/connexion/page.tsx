/**
 * Espace formateur — page de connexion passwordless (2026-06-13).
 * Publique (pas de garde) : c'est ici qu'on demande le lien magique.
 */

import { redirect } from "next/navigation";
import { FormateurLoginForm } from "@/components/espace-formateur/FormateurLoginForm";
import { getFormateurSession } from "@/server/formateur/guard";
import { FORMATEUR_BASE_PATH } from "@/server/formateur/routes";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}): Promise<React.ReactElement> {
  // Déjà connecté → vers le tableau de bord.
  const session = await getFormateurSession();
  if (session) redirect(FORMATEUR_BASE_PATH);

  const { erreur } = await searchParams;

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-mocha mb-2 font-serif text-2xl font-semibold">
        Connexion à votre espace
      </h1>
      <p className="text-fg-muted mb-6 text-sm">
        Recevez un lien de connexion sécurisé par e-mail. Aucun mot de passe à retenir.
      </p>

      {erreur === "lien_invalide" ? (
        <p className="border-error/30 bg-error/5 text-error mb-4 rounded-md border px-3 py-2 text-sm">
          Ce lien de connexion est invalide ou a expiré. Demandez-en un nouveau ci-dessous.
        </p>
      ) : null}

      <div className="border-border bg-sand rounded-lg border p-5">
        <FormateurLoginForm />
      </div>
    </div>
  );
}
