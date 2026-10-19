/**
 * La porte d'entrée du dépôt public de réclamation dans l'espace stagiaire
 * (chantier QNC, L09). Server Component, rendu seulement quand le dépôt est
 * ouvert. Le bandeau de /reclamations vit dans `BandeauDepotReclamation.tsx`.
 *
 * Séparé de `DepotReclamationBloc.tsx` à dessein : celui-ci importe le
 * formulaire client, et Next embarque dans le JavaScript d'une page tout
 * composant client que ses modules serveur importent — rendu ou non. Mesuré :
 * importer le bandeau depuis ce module ajoutait 1,6 kB brotli au chunk de
 * /reclamations (formulaire, Turnstile, `next/script`), pour un bandeau sans
 * aucune interactivité. Ce fichier ne doit importer aucun composant client
 * hormis `next/link`, que chaque page charge déjà.
 *
 * C'est `next/link`, celui que l'espace stagiaire charge déjà (il écrit ses
 * liens `/${locale}/…`) : mesuré, le `Link` de next-intl y ajoutait son runtime.
 * La règle vaut pour TOUTE la liste d'imports d'un module : c'est pourquoi le
 * bandeau, qui prend le `Link` de next-intl, est dans un fichier à part.
 */

import Link from "next/link";
import { lireInterrupteurReclamations } from "@/server/qualiopi/reclamations/interrupteur";
import { formulaireOuvert } from "@/server/qualiopi/reclamations/depot-public";

/**
 * Le lien « Déposer une réclamation », rendu SEULEMENT quand le dépôt est
 * ouvert à tous (`actif`) — ou, depuis l'espace stagiaire, quand la personne
 * connectée est du banc d'essai (`essai`). Sinon `null` : les pages qui le
 * portent sont inchangées.
 */
export async function LienDepotReclamation({
  locale,
  className,
  children,
  depuisEspaceDeTest = false,
}: {
  /** `/reclamations/deposer` s'écrit pareil en fr et en en (routing.ts). */
  locale: string;
  className?: string;
  children: React.ReactNode;
  /** L'espace stagiaire sait si la personne connectée est du banc d'essai. */
  depuisEspaceDeTest?: boolean;
}) {
  const etat = await lireInterrupteurReclamations();
  if (!formulaireOuvert(etat, { inscriptionDeTest: depuisEspaceDeTest })) return null;
  return (
    <Link
      href={`/${locale}/reclamations/deposer`}
      {...(className !== undefined ? { className } : {})}
    >
      {children}
    </Link>
  );
}
