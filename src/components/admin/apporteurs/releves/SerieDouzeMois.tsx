// Évolution sur 12 mois : barres CSS (aucune bibliothèque cliente, budget bucket admin).
import {
  hauteursEnPourcent,
  type PointMois,
} from "@/features/apporteurs-reseau/releve-mensuel/statistiques";
import { eur, moisLisible } from "./format";

export function SerieDouzeMois({ points }: { points: readonly PointMois[] }) {
  const hauteurs = hauteursEnPourcent(points.map((p) => p.facturesHtCents));
  return (
    <figure className="m-0">
      <div className="flex h-40 items-end gap-[var(--space-admin-2)]">
        {points.map((p, i) => (
          <div key={p.periode} className="flex h-full flex-1 flex-col justify-end">
            <div
              data-barre
              role="img"
              aria-label={`${moisLisible(p.periode)} : ${eur(p.facturesHtCents)} HT facturés`}
              title={`${moisLisible(p.periode)} : ${eur(p.facturesHtCents)} HT${
                p.source === "direct" ? " (calcul direct, indicatif)" : ""
              }`}
              style={{ height: `${hauteurs[i]}%` }}
              className={
                p.source === "releves"
                  ? "min-h-px rounded-t bg-[color:var(--color-admin-info)]"
                  : "min-h-px rounded-t bg-[color:var(--color-admin-neutral-soft)]"
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-[var(--space-admin-1)] flex gap-[var(--space-admin-2)] text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        {points.map((p) => (
          <span key={p.periode} className="flex-1 text-center">
            {p.periode.slice(5)}
          </span>
        ))}
      </div>
      <figcaption className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Facturé HT par mois. Bleu : lu sur les relevés préparés ; gris : calcul direct, indicatif.
      </figcaption>
    </figure>
  );
}
