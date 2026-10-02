// Relais de la console (extension 1.3.0, 2026-10-01) — script de contenu,
// déclaré sur axion-ia.com seulement.
//
// 1.4.0 (2026-10-02) — « Relier à ma console » : sur la page ouverte par la
// liaison (`?relier=` dans l'adresse) SEULEMENT, il repère l'élément masqué
// posé par la console (`data-relier-nonce`, `data-relier-jeton`), l'envoie
// au service worker (`jeton_relie`) et marque la réponse sur l'élément
// (`data-relier-etat` : ok ou refuse). Le jeton ne quitte la page que vers
// le service worker : ni URL, ni journal.
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

  const NONCE = "data-relier-nonce";
  const JETON = "data-relier-jeton";
  const ETAT = "data-relier-etat";
  if (!new URLSearchParams(location.search).has("relier")) return;
  const relier = () => {
    const el = document.querySelector(`[${NONCE}][${JETON}]:not([${ETAT}])`);
    if (!el) return;
    el.setAttribute(ETAT, "envoye");
    chrome.runtime
      .sendMessage({
        type: "jeton_relie",
        nonce: el.getAttribute(NONCE),
        jeton: el.getAttribute(JETON),
      })
      .then((r) => el.setAttribute(ETAT, r?.ok ? "ok" : "refuse"))
      .catch(() => el.setAttribute(ETAT, "refuse"));
  };
  new MutationObserver(relier).observe(document.documentElement, {
    subtree: true,
    childList: true,
  });
  relier();
})();
