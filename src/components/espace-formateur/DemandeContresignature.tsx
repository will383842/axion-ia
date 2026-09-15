/**
 * Espace formateur — la DEMANDE de contresignature, en tête de la formation.
 *
 * 🔴 2026-09-15 — sur la seule session réelle, la stagiaire a signé et le
 * formateur n'a jamais contresigné : le bouton existait, plus bas dans la page,
 * et rien ne lui disait qu'il était attendu. La demande part aussi par e-mail ;
 * ici elle se TROUVE en ouvrant la formation, avec un lien direct vers le bloc
 * d'émargement (`#emargement`), où se pose le geste.
 *
 * Composant serveur, sans état : il ne signe rien, il montre et il mène.
 * Aucun nom de stagiaire — la politique de champs de l'espace formateur.
 */

import {
  libelleDemiJourneeAContresigner,
  type DemiJourneeAContresigner,
} from "@/server/qualiopi/emargement/contresignatures-manquantes";

export interface DemandeContresignatureProps {
  readonly demiJournees: ReadonlyArray<DemiJourneeAContresigner>;
}

export function DemandeContresignature({
  demiJournees,
}: DemandeContresignatureProps): React.ReactElement | null {
  // Rien à contresigner : aucun bandeau. Un bandeau vide se lit comme une alerte.
  if (demiJournees.length === 0) return null;
  const n = demiJournees.length;
  return (
    <section
      aria-labelledby="demande-contresignature-titre"
      className="border-terracotta bg-sand rounded-lg border p-4"
    >
      <h2
        id="demande-contresignature-titre"
        className="text-mocha font-serif text-lg font-semibold"
      >
        Contresignature demandée
      </h2>
      <p className="text-mocha mt-1 text-sm">
        Vos stagiaires ont émargé :{" "}
        {n > 1 ? "ces demi-journées attendent" : "cette demi-journée attend"} votre contresignature.
        Elle atteste que vous les avez animées, et personne ne peut la signer à votre place.
      </p>
      <ul className="text-mocha mt-2 list-disc pl-5 text-sm">
        {demiJournees.map((d) => (
          <li key={`${d.date}|${d.demiJournee}`}>{libelleDemiJourneeAContresigner(d)}</li>
        ))}
      </ul>
      <a
        href="#emargement"
        className="bg-terracotta mt-3 inline-block rounded-md px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Contresigner maintenant
      </a>
    </section>
  );
}
