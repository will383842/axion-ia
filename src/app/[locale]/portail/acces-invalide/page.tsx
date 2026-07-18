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
            Ce lien n&apos;est plus valide (il expire au bout de 90 jours). Demandez-en un nouveau
            ci-dessous, ou contactez l&apos;organisme de formation.
          </p>
        </div>
        <a
          href="/fr/portail/demander-acces"
          className="inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Recevoir un nouveau lien d&apos;accès
        </a>
      </div>
    </div>
  );
}
