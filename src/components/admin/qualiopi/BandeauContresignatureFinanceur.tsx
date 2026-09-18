/**
 * Console — « votre financeur réclamera la contresignature », au POINT D'ACTION.
 *
 * 🔴 Le défaut : l'organisme apprenait la règle au REFUS DE RÈGLEMENT. La
 * contresignature du formateur existait dans l'outil (registre, demande
 * automatique, étape du parcours), mais aucune surface ne la reliait à
 * l'argent — et surtout pas l'écran d'émargement, celui qu'on ouvre quand on
 * s'occupe justement des signatures.
 *
 * ⛔ **Ce bandeau n'est PAS une garde.** Décision de Will du 25/08/2026 : « LA
 * CONTRESIGNATURE PAS BLOQUANTE ». Il n'empêche rien, ne désactive aucun
 * bouton, ne refuse aucune génération. Il informe, il dit pourquoi, il mène.
 *
 * Ton `info` et non `warning` : il ne s'agit pas d'une faute, mais d'une pièce
 * que le financeur demandera. Un bandeau ambré à chaque ouverture de l'écran
 * d'émargement finirait par ne plus être lu.
 *
 * Composant SERVEUR, sans état : zéro octet de JavaScript ajouté à la route.
 *
 * ⚠️ `admin-alert` + `admin-alert-info` sont des classes de `admin.css`, servie
 * HORS couche : une utilitaire Tailwind posée sur le MÊME élément pour la
 * couleur ou le fond serait inerte. Le conteneur ne porte donc que ses deux
 * classes `.admin-*` ; le style des enfants n'entre pas en conflit.
 */

import Link from "next/link";
import {
  libelleCourtDemiJournee,
  type ConstatContresignature,
} from "@/server/qualiopi/emargement/contresignature-attendue";

export interface BandeauContresignatureFinanceurProps {
  readonly constat: ConstatContresignature;
  /** Où mène le bandeau. Absent = pas de lien plutôt qu'un lien qui ne mène nulle part. */
  readonly href?: string | undefined;
  readonly libelleLien?: string | undefined;
}

export function BandeauContresignatureFinanceur({
  constat,
  href,
  libelleLien,
}: BandeauContresignatureFinanceurProps): React.ReactElement | null {
  // Financement direct, financement non renseigné, ou tout contresigné : rien.
  // Un bandeau qui reste après le geste apprend à ne plus regarder les bandeaux.
  if (!constat.afficher) return null;

  return (
    <div
      role="status"
      className="admin-alert admin-alert-info mb-[var(--space-admin-6)]"
      data-cas={constat.cas}
    >
      <div>
        <p className="font-semibold">{constat.titre}</p>
        <p className="mt-[var(--space-admin-2)]">{constat.message}</p>
        {/* Le détail nominatif : ce qui manque, nommé. Au-delà de quatre, le
            message porte déjà « et N autres » — la liste, elle, est complète,
            parce que c'est ici qu'on vient chercher lesquelles. */}
        {constat.manquantes.length > 0 && (
          <ul className="mt-[var(--space-admin-2)] list-disc pl-[var(--space-admin-5)]">
            {constat.manquantes.map((d) => (
              <li key={`${d.date}|${d.demiJournee}`}>{libelleCourtDemiJournee(d)}</li>
            ))}
          </ul>
        )}
        {/* ⚠️ La phrase honnête, en toutes lettres : contractuel, variable, à
            confirmer auprès du financeur. Jamais « obligatoire ». */}
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-xs)]">
          {constat.pourquoi}
        </p>
        {href !== undefined && (
          <p className="mt-[var(--space-admin-3)]">
            <Link
              href={href}
              className="text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
            >
              {libelleLien ?? "Voir"}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
