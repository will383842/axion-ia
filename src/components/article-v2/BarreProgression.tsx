/**
 * Barre de progression de lecture : CSS pur (`animation-timeline: scroll()`), invisible
 * sans support. Posée juste sous la barre réelle du site, sous le `z-index` du `Header`.
 */
export function BarreProgression() {
  return <div className="progression" aria-hidden="true" />;
}
