// « Mes relevés mensuels » : liste des relevés ENVOYÉS de l'apporteur, avec le lien de leur PDF.
// Composant SERVEUR, lecture seule. Un relevé est un récapitulatif, jamais une facture.
import { libelleMois } from "@/features/apporteurs-reseau/autofacture-donnees";
import type { ReleveDeLEspace } from "@/features/apporteurs-reseau/releve-mensuel/espace";

import { TEXTES_COMMISSIONS as T } from "./textes";

const LIEN =
  "text-terracotta-deep inline-flex min-h-[44px] items-center gap-2 text-[17px] font-bold underline underline-offset-4";

export function SectionReleves({
  base,
  releves,
}: {
  /** `/apporteur/dossier/<id>/<jeton>` */
  base: string;
  releves: readonly ReleveDeLEspace[];
}) {
  if (releves.length === 0) return null;
  return (
    <section className="mt-6" aria-labelledby="releves">
      <h2 id="releves" className="font-serif text-[22px] font-medium">
        {T.relevesTitre}
      </h2>
      <p className="text-fg-soft mt-1 text-[16px]">{T.relevePasUneFacture}</p>
      <ul className="mt-2 grid gap-1">
        {releves.map((r) => (
          <li key={r.numero} className="text-[16px]">
            <p>
              {r.rang > 0
                ? T.releveRectificatif(libelleMois(r.periode), r.rang)
                : T.releveDu(libelleMois(r.periode))}
            </p>
            <a href={`${base}/releves/${r.numero}`} target="_blank" rel="noopener" className={LIEN}>
              ↓ {T.telechargerReleve(r.numero)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
