// L'encart de l'espace de l'apporteur : LA RÈGLE d'un challenge publié, et rien d'autre.
//
// Un challenge est une invitation libre : aucun nombre personnel, aucune barre, aucun « où vous
// en êtes », aucune date de fin mise en avant, aucun compte à rebours, aucun classement. Composant
// SERVEUR, zéro JavaScript client. Il ne lit AUCUNE donnée d'apporteur : la vue ne contient que
// la règle publiée. Interrupteur éteint, aucun challenge publié en cours, ou table illisible :
// il ne rend rien (jamais d'erreur dans l'espace).

import { jourParis } from "@/features/apporteurs-reseau/autofacture-donnees";
import {
  lireEncartChallenge,
  type VueEncartChallenge,
} from "@/features/apporteurs-reseau/challenge-donnees";
import { phrasesDeLEncart } from "@/features/apporteurs-reseau/challenge-regles";
import { challengesEspaceActifs } from "@/features/apporteurs-reseau/interrupteur-challenges-espace";

/**
 * Lecture de la règle publiée, tolérante : éteint, rien de publié ou table illisible = null (la
 * page de l'espace ne casse jamais pour un challenge). Aucune donnée d'apporteur n'est lue.
 */
export async function lireEncartPourEspace(): Promise<VueEncartChallenge | null> {
  if (!challengesEspaceActifs()) return null;
  try {
    return await lireEncartChallenge(jourParis(new Date()));
  } catch {
    return null;
  }
}

/** Composant SYNCHRONE : la vue vient de `lireEncartPourEspace`. */
export function EncartChallenge({
  vue,
  id,
  jeton,
}: {
  vue: VueEncartChallenge | null;
  id: string;
  jeton: string;
}) {
  if (!vue) return null;
  const p = phrasesDeLEncart(vue);
  return (
    <section
      aria-labelledby="titre-challenge"
      className="border-border bg-paper mt-5 rounded-2xl border p-5 text-[17px] leading-relaxed"
    >
      <h2 id="titre-challenge" className="font-serif text-[22px] font-medium">
        {vue.titre}
      </h2>
      <p className="text-fg-soft mt-2">{p.principale}</p>
      <p className="text-fg-soft mt-2">{p.rassurance}</p>
      <a
        href={`/apporteur/dossier/${id}/${jeton}/challenge/reglement`}
        className="text-terracotta-deep mt-3 inline-flex min-h-[48px] items-center gap-2 font-bold underline underline-offset-4"
      >
        Lire le règlement →
      </a>
    </section>
  );
}
