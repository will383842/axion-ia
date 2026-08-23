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
 *
 * ## 🔴 2026-08-23 — CETTE GARDE NE COUVRAIT PAS TOUT, ET LE TROU N'EST PAS UN SCRIPT
 *
 * `urlPorteUnSecret` protège les composants qui TRANSMETTENT l'URL. Le badge
 * CodeTrendy du pied de page public (`Footer.tsx`, `CodeTrendyBadge`) n'en
 * transmet aucune — c'est une `<img>` — il passait donc à côté de la règle, tout
 * en émettant un appel vers `codetrendy.com` depuis CHAQUE page du portail.
 *
 * Trouvé par le parcours `06-stagiaire-mobile`, qui interdit — lui — TOUTE sortie
 * réseau depuis cet espace, et non les seules fuites d'URL. Reproduit deux fois.
 *
 * Ce qui partait, vérifié plutôt que supposé :
 *   · le JETON NE FUIT PAS — `Referrer-Policy: strict-origin-when-cross-origin`
 *     (`next.config.ts` et `proxy.ts`) n'envoie que l'origine en cross-origin ;
 *   · mais l'IP, l'User-Agent et l'horodatage de chaque stagiaire ouvrant son
 *     attestation partaient vers un tiers — et comme c'est une `<img>` et non un
 *     script, l'appel partait AVANT tout consentement.
 *
 * ## Pourquoi du CSS, et pas une garde de composant
 *
 * Le badge est rendu par un composant SERVEUR, dans le HTML initial : une garde
 * cliente arriverait trop tard, l'image serait déjà demandée. Et le layout racine
 * ne peut pas lire `headers()` — c'est toute la raison d'être du montage décrit
 * plus haut. On reprend donc le mécanisme DÉJÀ en place côté admin
 * (`(admin)/[adminPrefix]/layout.tsx` : `body:has(.admin-layout) footer… {display:none}`),
 * qui n'ajoute aucun JavaScript et ne touche pas aux pages publiques — le badge y
 * reste intact, et la contrepartie commerciale avec lui.
 *
 * ⚠️ CE QUI REND CETTE PARADE EFFICACE, ET DONC CE QU'IL NE FAUT PAS TOUCHER :
 * l'`<img>` porte `loading="lazy"`. Une image paresseuse dans un sous-arbre
 * `display:none` n'entre jamais dans le viewport, donc le navigateur ne la charge
 * jamais. Retirer le `lazy` du badge, ou masquer autrement qu'en `display:none`,
 * rouvrirait l'appel. Ce n'est pas garanti par une spécification — c'est le
 * parcours 06 qui le VÉRIFIE, et c'est lui qui rougira si cela cesse d'être vrai.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portail stagiaire — Axion-IA",
  robots: { index: false, follow: false },
};

/**
 * Masque, sur le portail, tout élément marqué comme tiers dans la coquille
 * publique. La règle est volontairement écrite sur l'ATTRIBUT et non sur un
 * sélecteur propre à CodeTrendy : le prochain embarquement tiers marqué
 * `data-tiers` sera couvert sans qu'on ait à y repenser — et s'il ne l'est pas,
 * le parcours 06 rougira.
 *
 * `.portail-layout` est le crochet racine, comme `.admin-layout` côté console.
 */
const portailMasquerTiersCss = `
  body:has(.portail-layout) [data-tiers] { display: none !important; }
`.trim();

export default function PortailLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="portail-layout min-h-screen bg-gray-50">
      <style dangerouslySetInnerHTML={{ __html: portailMasquerTiersCss }} />
      {children}
    </div>
  );
}
