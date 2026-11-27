import { phrasesDeLEncart } from "@/features/apporteurs-reseau/challenge-regles";
import type { VueEncartChallenge } from "@/features/apporteurs-reseau/challenge-donnees";

/**
 * Le texte EXACT de l'encart de l'espace de l'apporteur (mêmes phrases : `phrasesDeLEncart`).
 * Sert à l'écran de publication : l'administrateur relit ce que verront les apporteurs.
 */
export function EncartApercu({ vue }: { vue: VueEncartChallenge }) {
  const p = phrasesDeLEncart(vue);
  return (
    <div role="group" className="rounded-lg border p-4" aria-label="Aperçu de l'encart de l'espace">
      <p className="font-semibold">{vue.titre}</p>
      <p className="mt-2">{p.principale}</p>
      <p className="mt-2">{p.rassurance}</p>
      <p className="mt-2 underline">Lire le règlement</p>
    </div>
  );
}
