/**
 * Le bandeau « Déposer une réclamation » de la page de procédure /reclamations
 * (chantier QNC, L09). Server Component, rendu seulement quand le dépôt est
 * ouvert à tous.
 *
 * Module à part, et il ne doit importer aucun autre composant client que le
 * `Link` de next-intl : c'est celui que /reclamations charge déjà (par
 * `LegalPageTemplate`). Next embarque dans le JavaScript d'une page tous les
 * composants client que ses modules serveur importent, rendus ou non — mesuré :
 * importé depuis `DepotReclamationBloc.tsx`, ce bandeau faisait partir le
 * formulaire et Turnstile sur /reclamations ; avec `next/link`, il ajoutait une
 * référence client que la page n'avait pas.
 */

import { Link } from "@/i18n/navigation";
import { lireInterrupteurReclamations } from "@/server/qualiopi/reclamations/interrupteur";

/** Le bandeau de la page de procédure /reclamations — `null` tant que le dépôt n'est pas ouvert. */
export async function BandeauDepotReclamation() {
  const etat = await lireInterrupteurReclamations();
  if (etat !== "actif") return null;
  return (
    <div className="border-border bg-paper mx-auto mt-6 max-w-3xl rounded-lg border p-5">
      <p className="text-fg text-base leading-relaxed">
        Stagiaire, entreprise, formateur ou financeur : vous pouvez déposer votre réclamation en
        ligne. Accusé de réception immédiat, réponse écrite sous 15 jours ouvrés.
      </p>
      <Link
        href="/reclamations/deposer"
        className="text-terracotta mt-3 inline-block font-medium underline underline-offset-4"
      >
        Déposer une réclamation
      </Link>
    </div>
  );
}
