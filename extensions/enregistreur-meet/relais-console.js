// Relais de la console (extension 1.3.0, 2026-10-01) — script de contenu,
// déclaré sur axion-ia.com seulement.
//
// Il n'écoute QUE le clic sur « Oui, enregistrer » / « Non, sans
// enregistrement » de la question « Enregistrer cette visio ? » et transmet au
// service worker l'identifiant porté par le lien. Il ne lit rien d'autre de la
// page, n'y injecte rien, ne démarre rien. Ailleurs sur le site, l'attribut
// n'existe pas : il ne fait rien. Attributs recopiés de
// `lib/visio-a-enregistrer.js` (un script de contenu n'importe pas de module).
(() => {
  const OUI = "data-enregistrer-visio";
  const NON = "data-sans-enregistrement";
  document.addEventListener(
    "click",
    (ev) => {
      // Un clic simulé par un script de la page ne compte pas : seul celui de Will.
      if (!ev.isTrusted) return;
      const lien = ev.target?.closest?.(`[${OUI}], [${NON}]`);
      if (!lien) return;
      const identifiant = lien.getAttribute(OUI);
      const message =
        identifiant !== null
          ? { type: "visio_a_enregistrer", identifiant }
          : { type: "visio_sans_enregistrement" };
      chrome.runtime.sendMessage(message).catch(() => undefined);
    },
    true,
  );
})();
