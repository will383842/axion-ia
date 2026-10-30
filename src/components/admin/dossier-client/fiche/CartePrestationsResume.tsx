/**
 * Carte « Prestations » du Résumé (lot B8) : une ligne par prestation en cours. Composant SERVEUR,
 * sans lecture : il reçoit des prestations déjà lues. Les montants restent dans la console.
 */

import Link from "next/link";

import { Frise } from "./Frise";
import { htEtTtc } from "./montants";
import {
  estEtapeFinale,
  etapesDeLaFrise,
  libelleChances,
  libelleCloture,
} from "@/features/dossier-client/fiche/affichage-prestation";
import { LIBELLE_TYPE_PRESTATION } from "@/features/dossier-client/prestations";
import type { PrestationSuivie } from "@/features/dossier-client/suivi-prestations";

export function CartePrestationsResume({
  prestations,
  ficheHref,
}: {
  prestations: ReadonlyArray<PrestationSuivie>;
  ficheHref: string;
}): React.ReactElement {
  const enCours = prestations.filter((p) => !estEtapeFinale(p.etape));
  return (
    <section
      aria-labelledby="resume-prestations"
      data-bloc="resume-prestations"
      className="mb-[var(--space-admin-6)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
    >
      <h2
        id="resume-prestations"
        className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-base)] font-semibold"
      >
        Prestations
      </h2>
      {enCours.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Aucune prestation en cours.
        </p>
      ) : (
        <ul className="space-y-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          {enCours.map((p) => (
            <li key={p.projetId}>
              <h3 className="font-medium">
                {p.type === null ? "Type à choisir" : LIBELLE_TYPE_PRESTATION[p.type]}
                <span className="font-normal text-[color:var(--color-admin-fg-muted)]">
                  {" "}
                  · {p.titre}
                </span>
              </h3>
              <Frise etiquette={`Étapes de ${p.titre}`} etapes={etapesDeLaFrise(p.etape)} />
              <p className="mt-[var(--space-admin-1)]">
                {p.montantCents === null ? (
                  "Montant non noté"
                ) : (
                  <>
                    {htEtTtc(p.montantCents).ht}
                    <span className="block text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
                      {htEtTtc(p.montantCents).ttc}
                    </span>
                  </>
                )}
                {" · "}Chances de signer : {libelleChances(p.probabilitePct)}
                {" · "}
                {p.cloturePrevueLe === null
                  ? "Clôture prévue : non estimée"
                  : `Clôture prévue le ${libelleCloture(p.cloturePrevueLe)}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`${ficheHref}?onglet=prestations`}
        className="mt-[var(--space-admin-3)] inline-flex min-h-11 items-center text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-accent)] underline-offset-2 hover:underline"
      >
        Voir les prestations
      </Link>
    </section>
  );
}
