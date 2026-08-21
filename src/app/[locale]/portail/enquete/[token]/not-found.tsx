/**
 * Enquête entreprise — lien non reconnu.
 *
 * ## Pourquoi cette page existe
 *
 * 🔴 `D4-5-S1` (2026-08-20) — depuis que le jeton est haché, une RELANCE émet un
 * lien neuf et le précédent cesse de fonctionner. Un contact client qui rouvre
 * le premier e-mail après une relance tombait sur le 404 générique du site, qui
 * ne lui disait rien d'utile.
 *
 * ⚠️ Et on ne peut pas lui en dire plus. La base ne détient que des EMPREINTES :
 * un jeton remplacé et un jeton qui n'a jamais existé y sont rigoureusement
 * indiscernables. Prétendre distinguer « expiré » de « inconnu » supposerait de
 * conserver l'ancien clair — c'est-à-dire de défaire le correctif.
 *
 * Le message dit donc la seule chose vraie ET utile : s'il y a plusieurs
 * messages, c'est le dernier qui vaut.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lien non reconnu",
  robots: { index: false, follow: false },
};

export default function EnqueteLienNonReconnu() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-6 py-6">
          <p className="text-sm font-semibold text-amber-800">Ce lien n&apos;est plus valide</p>
          <p className="mt-2 text-sm text-amber-700">
            Si vous avez reçu plusieurs messages au sujet de cette enquête, seul le{" "}
            <strong>plus récent</strong> contient un lien actif — une relance remplace le lien
            précédent.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            Sinon, répondez simplement à l&apos;e-mail reçu : nous vous renverrons un lien.
          </p>
        </div>
      </div>
    </div>
  );
}
