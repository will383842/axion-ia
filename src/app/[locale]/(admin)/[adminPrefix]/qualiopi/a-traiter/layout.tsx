/**
 * Admin — Qualiopi · À traiter · Pose la « peau dossier » (même ambiance que la fiche client).
 *
 * Ce layout n'a qu'un rôle : porter la classe `admin-ton-dossier`, définie dans
 * `src/app/admin.css`. Composant serveur, aucun JavaScript client, aucune requête.
 *
 * Retour arrière : supprimer ce fichier.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="admin-ton-dossier">{children}</div>;
}
