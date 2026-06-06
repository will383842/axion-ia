/**
 * Portail stagiaire — Page accès invalide.
 *
 * URL : /{locale}/portail/acces-invalide
 * Accès : public (cible de redirection depuis /portail/acces/[token] si token KO).
 *
 * Server Component sobre, FR, noindex.
 * Aucun token admin, aucun identifiant technique affiché.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lien invalide",
  robots: { index: false, follow: false },
};

export default function AccesInvalidePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-6 py-6">
          <p className="text-sm font-semibold text-amber-800">Lien invalide ou expiré</p>
          <p className="mt-2 text-sm text-amber-700">
            Ce lien n&apos;est plus valide. Veuillez contacter l&apos;organisme de formation pour
            obtenir un nouveau lien d&apos;accès.
          </p>
        </div>
      </div>
    </div>
  );
}
