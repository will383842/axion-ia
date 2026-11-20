/**
 * Admin — Contacts · Fiche d'une candidature · Pose la « peau dossier » (même ambiance que la fiche client).
 *
 * Ce layout n'a qu'un rôle : porter la classe `admin-ton-dossier`, définie dans
 * `src/app/admin.css` (socle D0) : bordures lisibles, textes plus grands, cibles de 44 px,
 * anneau de focus bleu pour tout le sous-arbre. Composant serveur, aucune requête.
 *
 * Retour arrière : supprimer ce fichier.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="admin-ton-dossier">{children}</div>;
}
