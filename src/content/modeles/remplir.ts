/**
 * Substitue les variables d'un texte pré-rempli (`{prenom}`, `{poste}`…).
 *
 * Partagé par les modèles des deux mondes (emploi et réseau d'apporteurs) et
 * par le composeur unique (`components/admin/echanges/Composeur.tsx`). Module
 * PUR, sans vocabulaire : il ne sait rien de ce qu'il remplit.
 *
 * 🔑 Une variable inconnue est LAISSÉE TELLE QUELLE, accolades comprises. Un
 * remplacement par une chaîne vide produirait « Bonjour , » — une phrase
 * grammaticalement correcte, donc invisible à la relecture, qui partirait telle
 * quelle. Un `{prenom}` resté à l'écran se voit et se corrige.
 */
export function remplirModele(texte: string, valeurs: Record<string, string | null>): string {
  return texte.replace(/\{(\w+)\}/g, (entier, cle: string) => {
    const valeur = valeurs[cle];
    return valeur != null && valeur.trim().length > 0 ? valeur : entier;
  });
}
