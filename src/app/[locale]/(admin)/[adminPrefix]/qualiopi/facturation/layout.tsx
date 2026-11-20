/**
 * Admin — Qualiopi · Facturation · Pose la « peau dossier » (même ambiance que la fiche client).
 *
 * Ce layout n'a qu'un rôle : porter la classe `admin-ton-dossier`, définie dans
 * `src/app/admin.css` (socle D0). Elle redéfinit les variables de la console
 * (bordures lisibles, textes plus grands, cibles de 44 px, anneau de focus bleu)
 * pour TOUT le sous-arbre : la liste, mais aussi le détail d'une facture, les
 * plans récurrents, le rapprochement et la comptabilité.
 *
 * Retour arrière : supprimer ce fichier. Composant serveur, aucun JavaScript
 * client, aucune requête.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="admin-ton-dossier">{children}</div>;
}
