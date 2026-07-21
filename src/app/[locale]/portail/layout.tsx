/**
 * Portail stagiaire — présentation et `noindex`.
 *
 * ## ⚠️ Ce fichier ne protège RIEN, et c'est important de le savoir
 *
 * Sa première version affirmait « aucune analytique, aucun chat, ni en-tête ni
 * pied de page ». C'était faux : dans l'App Router, un layout imbriqué s'AJOUTE
 * à son parent, il ne le remplace jamais. Le portail continuait donc d'hériter
 * de `<Plausible />`, `<Clarity />`, `<WebVitals />` et du reste — pendant que
 * ce commentaire assurait le contraire.
 *
 * C'est le genre de faux exactement qui traverse une revue : on lit la promesse,
 * on coche, on passe. Vérifié en production sur une page de structure identique
 * (`/fr/espace-formateur/connexion`) : le HTML servi contenait bien le script
 * Plausible, un en-tête et un pied de page publics.
 *
 * ## Où la protection vit réellement
 *
 * Dans `src/lib/analytics/routes-privees.ts` (`urlPorteUnSecret`), appelée par
 * CHAQUE composant qui transmet l'URL : `Plausible`, `Clarity`,
 * `RefererTracker`, `WebVitals`, `SpeculationRules`, `ChatWidgetMount`. La
 * garde ne peut pas être portée côté serveur : appeler `headers()` dans le
 * layout racine rendrait tout le site dynamique.
 *
 * ⚠️ Tout nouveau script tiers recevant l'URL doit passer par cette garde. Le
 * jeton vit dans le chemin, reste valable jusqu'à la fin de session + 48 h et
 * n'est pas à usage unique : qui le lit peut signer à la place du stagiaire.
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
