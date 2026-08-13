// Habillage commun aux pages du tunnel publicitaire.
//
// `/diagnostic` et `/simulateur` sont deux écrans successifs du MÊME parcours :
// le visiteur clique sur un bouton et doit avoir l'impression de rester au même
// endroit. La moindre différence de fond, de marge ou de traitement de la
// marque se lit comme une redirection douteuse — exactement ce qu'il ne faut pas
// donner à voir à quelqu'un qui arrive d'une publicité.
//
// D'où ce composant partagé plutôt que deux blocs de CSS recopiés : deux copies
// finiraient par diverger, et personne ne s'en apercevrait avant de regarder les
// deux pages côte à côte sur un téléphone.
//
// ── Ce que fait ce CSS ────────────────────────────────────────────────────
//   • masque l'en-tête et le pied de page publics rendus par `[locale]/layout` ;
//   • pose le fond encre sur le `body` — pas seulement sur le conteneur, sinon
//     la zone de rebond élastique du défilement (iOS) et la barre d'adresse
//     laissent apparaître l'ivoire du site sous le noir ;
//   • retire `#main` du flux sans casser ses enfants (`display: contents`).
//
// Technique du layout admin et de `/carrieres/widget` : le sélecteur `:has()`
// évite d'appeler `headers()` dans le layout racine, ce qui basculerait TOUTES
// les pages du site en rendu dynamique.

const FUNNEL_SHELL_CSS = `
  body:has(.axion-vsl-shell) {
    background-color: var(--color-ink);
  }
  body:has(.axion-vsl-shell) header.bg-terracotta,
  body:has(.axion-vsl-shell) footer.bg-mocha-rich {
    display: none !important;
  }
  body:has(.axion-vsl-shell) #main {
    display: contents;
  }
`.trim();

export function FunnelShellStyle() {
  // CSS statique, aucune donnée utilisateur.
  return <style dangerouslySetInnerHTML={{ __html: FUNNEL_SHELL_CSS }} />;
}
