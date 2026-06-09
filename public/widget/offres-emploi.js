/*!
 * Axion-IA.com — loader du widget « Offres d'emploi ».
 * Embarquez nos offres sur n'importe quel site avec une seule balise <script> :
 *
 *   <script async
 *     src="https://axion-ia.com/widget/offres-emploi.js"
 *     data-variant="large"      // "large" | "compact"
 *     data-count="5"            // 1 à 12
 *     data-theme="light"        // "light" | "dark"
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

  var src =
    origin +
    "/" +
    locale +
    "/carrieres/widget?variant=" +
    variant +
    "&count=" +
    count +
    "&theme=" +
    theme;

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

  // Insère l'iframe juste avant la balise <script> (emplacement déterministe).
  script.parentNode.insertBefore(iframe, script);

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
