/**
 * Portail stagiaire — Re-demande self-service d'un lien d'accès.
 *
 * URL : /{locale}/portail/demander-acces
 * Accès : public. Un stagiaire dont le lien a expiré (> 90 j) ou a été perdu
 * saisit son email et reçoit un nouveau lien d'accès (anti-énumération +
 * rate-limit par IP côté action).
 *
 * Server Component sobre, FR, noindex.
 */

import type { Metadata } from "next";
import { DemanderAccesForm } from "@/components/portail/DemanderAccesForm";

export const metadata: Metadata = {
  title: "Accéder à mon espace stagiaire",
  robots: { index: false, follow: false },
};

export default function DemanderAccesPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-8 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Accéder à mon espace</h1>
          <p className="mt-2 text-sm text-gray-600">
            Saisissez l&apos;adresse email utilisée lors de votre formation. Nous vous enverrons un
            lien personnel pour retrouver vos attestations et vos questionnaires.
          </p>
          <div className="mt-6">
            <DemanderAccesForm />
          </div>
        </div>
      </div>
    </div>
  );
}
