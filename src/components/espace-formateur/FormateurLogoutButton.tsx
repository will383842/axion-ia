// Bouton de déconnexion de l'espace formateur — composant SERVEUR.
//
// Il était client (`useTransition` + `useRouter`) : rendu par la coquille que chaque
// page compose, son module était copié dans le chunk de CHAQUE page de l'espace
// (mesuré le 2026-10-12 sur la PR 1509). C'est désormais un formulaire posté sur l'action
// serveur, qui efface le cookie puis redirige vers la connexion : aucun JavaScript de
// page, et il marche même avant l'hydratation.

import { logoutFormateurAction } from "@/server/actions/formateur/auth.actions";

export function FormateurLogoutButton(): React.ReactElement {
  return (
    // `contents` : le formulaire n'ajoute aucune boîte, le bouton garde sa place dans
    // le pied de barre latérale et l'en-tête mobile.
    <form action={logoutFormateurAction} className="contents">
      <button
        type="submit"
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
    </form>
  );
}
