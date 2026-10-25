/**
 * Admin — Rendez-vous · Pose la « peau dossier » (D1, PLAN-DESIGN-CLIENTS).
 *
 * Ce layout n'a qu'un rôle : porter la classe `admin-ton-dossier`, définie dans
 * `src/app/admin.css` (socle D0). Elle redéfinit les variables de la console
 * (bordures lisibles, textes plus grands, cibles de 44 px, anneau de focus bleu)
 * pour TOUT le sous-arbre, sans toucher aux pages. Il couvre aussi les
 * sous-pages de ce dossier.
 *
 * Retour arrière : supprimer ce fichier. Composant serveur, aucun JavaScript
 * client, aucune requête.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="admin-ton-dossier">{children}</div>;
}
