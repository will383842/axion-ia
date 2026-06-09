/*!
 * Axion-IA.com — loader du widget « Offres d'emploi ».
 * Embarquez nos offres sur n'importe quel site avec une seule balise <script> :
 *
 *   <script async
 *     src="https://axion-ia.com/widget/offres-emploi.js"
 *     data-variant="large"      // "large" | "compact"
 *     data-count="5"            // 1 à 12
 *     data-theme="light"        // "light" | "dark"
 *     data-city="Lyon"          // optionnel : ville + remote (sinon France entière)
 *     data-locale="fr"></script>
 *
 * Le script crée un <iframe> vers /[locale]/carrieres/widget et l'ajuste
 * automatiquement en hauteur (postMessage). Aucune dépendance, ~1 Ko.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var d = script.dataset || {};
  var origin = (function () {
    try {
      return new URL(script.src).origin;
    } catch {
      return "https://axion-ia.com";
    }
  })();

  var locale = d.locale === "en" ? "en" : "fr";
  var variant = d.variant === "compact" ? "compact" : "large";
  var theme = d.theme === "dark" ? "dark" : "light";
  var count = parseInt(d.count, 10);
  if (isNaN(count) || count < 1) count = 5;
  if (count > 12) count = 12;
  // Ville optionnelle (data-city) — le serveur la résout contre sa liste connue.
  var cityQs = d.city ? "&city=" + encodeURIComponent(d.city) : "";

  var src =
    origin +
    "/" +
    locale +
    "/carrieres/widget?variant=" +
    variant +
    "&count=" +
    count +
    "&theme=" +
    theme +
    cityQs;

  var iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = locale === "en" ? "Axion-IA job openings" : "Offres d'emploi Axion-IA";
  iframe.loading = "lazy";
  iframe.setAttribute("scrolling", "no");
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.overflow = "hidden";
  iframe.style.minHeight = "240px";
  iframe.style.height = "480px";
  iframe.style.colorScheme = "normal";
  // Lisse le passage à la vraie hauteur (évite le « jump » au chargement),
  // sauf si l'utilisateur a demandé moins d'animations (a11y).
  if (!window.matchMedia || !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    iframe.style.transition = "height 0.25s ease";
  }

  // Insère l'iframe juste avant la balise <script> (emplacement déterministe).
  script.parentNode.insertBefore(iframe, script);

  // Lien d'attribution DOFOLLOW posé dans le DOM de la page hôte (hors iframe)
  // → vrai backlink vers axion-ia.com. Ancre de marque (pas de mots-clés
  // sur-optimisés) pour rester conforme aux consignes Google sur les widgets.
  // data-credit="off" sur le <script> permet au partenaire de le retirer, mais
  // par défaut il est présent (c'est la contrepartie de la gratuité).
  if (d.credit !== "off") {
    var credit = document.createElement("p");
    credit.style.cssText =
      "font:13px/1.5 system-ui,-apple-system,sans-serif;text-align:center;margin:8px 0 0";
    var creditLink = document.createElement("a");
    creditLink.href = origin + "/" + locale + "/carrieres";
    creditLink.target = "_blank";
    creditLink.rel = "noopener"; // PAS de nofollow → lien suivi (dofollow)
    creditLink.textContent =
      locale === "en" ? "Job openings by Axion-IA" : "Offres d'emploi par Axion-IA";
    creditLink.style.cssText = "color:#c24a1b;text-decoration:none"; // terracotta SSOT
    credit.appendChild(creditLink);
    script.parentNode.insertBefore(credit, script);
  }

  // Auto-resize : écoute la hauteur émise par la page d'embed.
  window.addEventListener("message", function (event) {
    if (event.origin !== origin) return;
    var data = event.data;
    if (!data || data.type !== "axion-offers-widget:height") return;
    var h = parseInt(data.height, 10);
    if (!isNaN(h) && h > 0) iframe.style.height = h + "px";
  });

  // Redemande la hauteur au resize de la fenêtre hôte (le contenu peut reflow).
  var raf;
  window.addEventListener("resize", function () {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage("axion-offers-widget:request-height", origin);
        }
      } catch {
        /* cross-origin — la page d'embed reposte de toute façon via ResizeObserver */
      }
    });
  });
})();
