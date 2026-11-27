"use client"; // use-client: window.print() et onClick, seul le bouton est un composant client

// Le bouton « Imprimer » de la trame : ouvre la boîte d'impression du navigateur.
export function BoutonImprimer() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-stone-400 bg-white px-3 py-1.5 text-sm font-semibold text-stone-900 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
    >
      Imprimer
    </button>
  );
}
