/**
 * Portail stagiaire — layout isolé.
 *
 * ## 🔴 Pourquoi ce fichier existe : le jeton partait chez Plausible et Clarity
 *
 * Sans layout propre, le portail héritait du layout racine, qui monte
 * `<Plausible />` et `<Clarity />`. Or Plausible envoie `location.pathname` — et
 * nos jetons vivent dans le CHEMIN :
 * `/fr/portail/emarger/<payload>.<signature>`.
 *
 * Conséquence mesurée par la revue : le jeton atterrissait en clair dans le
 * rapport « Top pages », lisible par quiconque a accès au tableau de bord, pour
 * toute la durée de rétention. Il reste valable jusqu'à la fin de session + 48 h
 * et n'est pas à usage unique : n'importe quel lecteur du tableau de bord
 * pouvait donc rejouer le lien et signer à la place du stagiaire. Et si le
 * visiteur avait accepté les cookies, Clarity enregistrait en plus l'URL et le
 * DOM nominatif de la feuille — avec transfert hors UE.
 *
 * Cela annulait purement et simplement le nettoyage Sentry mis en place pour la
 * même raison. Une fuite corrigée sur un canal ne sert à rien si un autre reste
 * ouvert.
 *
 * ## Ce que ce layout ne rend pas, et pourquoi
 *
 * Aucune analytique, aucun chat, ni en-tête ni pied de page. Un stagiaire qui
 * ouvre sa feuille d'émargement n'a rien à faire d'une navigation marketing, et
 * chaque script en moins est une surface de fuite en moins sur une page qui
 * porte un secret dans son URL.
 *
 * ⚠️ Ne JAMAIS ajouter ici de script tiers recevant l'URL. Si une mesure
 * d'audience devient nécessaire sur le portail, elle devra recevoir un chemin
 * masqué, jamais `location.pathname`.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portail stagiaire — Axion-IA",
  robots: { index: false, follow: false },
};

export default function PortailLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <div className="min-h-screen bg-gray-50">{children}</div>;
}
