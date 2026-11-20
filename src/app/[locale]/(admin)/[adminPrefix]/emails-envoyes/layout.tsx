/**
 * Admin — E-mails envoyés · Pose la « peau dossier » (même ambiance que la fiche client).
 *
 * Ce layout n'a qu'un rôle : porter la classe `admin-ton-dossier`, définie dans
 * `src/app/admin.css`. Elle redéfinit les variables de la console (bordures
 * lisibles, textes plus grands, cibles de 44 px) pour tout le sous-arbre.
 *
 * Retour arrière : supprimer ce fichier. Composant serveur, aucun JavaScript client.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="admin-ton-dossier">{children}</div>;
}
