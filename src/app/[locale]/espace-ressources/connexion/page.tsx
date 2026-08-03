/**
 * Espace ressources — page de connexion passwordless (2026-06-13). Publique.
 */

import { redirect } from "next/navigation";
import { RessourcesLoginForm } from "@/components/espace-ressources/RessourcesLoginForm";
import { getRecipientSession } from "@/server/ressources/guard";
import { RESSOURCES_BASE_PATH } from "@/server/ressources/routes";

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}): Promise<React.ReactElement> {
  const session = await getRecipientSession();
  if (session) redirect(RESSOURCES_BASE_PATH);

  const { erreur } = await searchParams;

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-mocha mb-2 font-serif text-2xl font-semibold">
        Accéder à mes ressources
      </h1>
      <p className="text-fg-muted mb-6 text-sm">
        Recevez un lien de connexion sécurisé par e-mail pour consulter et télécharger vos documents
        Axion-IA. Aucun mot de passe à retenir.
      </p>

      {erreur === "lien_invalide" ? (
        <p className="border-error/30 bg-error/5 text-error mb-4 rounded-md border px-3 py-2 text-sm">
          Ce lien de connexion est invalide ou a expiré. Demandez-en un nouveau ci-dessous.
        </p>
      ) : null}

      <div className="border-border bg-sand rounded-lg border p-5">
        <RessourcesLoginForm />
      </div>
    </div>
  );
}
