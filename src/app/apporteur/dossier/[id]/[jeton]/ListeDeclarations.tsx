// Les déclarations de l'apporteur (siennes seulement), avec leur état. Composant SERVEUR.

import {
  LIBELLE_ETAT_DECLARATION,
  type EtatDeclaration,
} from "@/features/apporteurs-reseau/declaration-regles";

import { TEXTES_DECLARATION as T } from "./textes-declaration";

const STYLE: Record<EtatDeclaration, string> = {
  recue: "bg-sand text-fg",
  bien_recue: "bg-sage-soft text-sage",
  deja_connue: "bg-terracotta-soft text-terracotta-deep",
  hors_champ: "bg-terracotta-soft text-terracotta-deep",
};

const date = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

export function ListeDeclarations({
  declarations,
}: {
  declarations: ReadonlyArray<{
    id: string;
    denomination: string;
    recueAt: Date;
    etat: EtatDeclaration;
  }>;
}) {
  return (
    <section className="mt-5" aria-labelledby="liste-declarations">
      <h2 id="liste-declarations" className="font-serif text-[22px] font-medium">
        {T.listeTitre}
      </h2>
      {declarations.length === 0 ? (
        <p className="text-fg-soft mt-2 text-[16px]">{T.listeVide}</p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {declarations.map((d) => (
            <li
              key={d.id}
              className="bg-paper border-border flex items-start justify-between gap-3 rounded-2xl border p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-[17px] font-bold">{d.denomination}</p>
                <p className="text-fg-soft text-[15px]">{date(d.recueAt)}</p>
              </div>
              <span
                className={`${STYLE[d.etat]} shrink-0 rounded-full px-3 py-1 text-[14px] font-bold`}
              >
                {LIBELLE_ETAT_DECLARATION[d.etat]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
