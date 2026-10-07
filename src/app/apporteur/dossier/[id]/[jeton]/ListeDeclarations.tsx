// Les déclarations de l'apporteur (siennes seulement), avec leur état. Composant SERVEUR.

import {
  LIBELLE_ETAT_DECLARATION,
  type EtatDeclaration,
} from "@/features/apporteurs-reseau/declaration-regles";

import { TEXTES_DECLARATION as T } from "./textes-declaration";

const STYLE: Record<EtatDeclaration, string> = {
  a_l_etude: "bg-sand text-fg",
  reservee: "bg-sage-soft text-sage",
  non_disponible: "bg-terracotta-soft text-terracotta-deep",
  expiree: "bg-sand text-fg-soft",
};

/** « 05/04/2027 », heure de Paris. */
const dateCourte = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

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
    /** Fin de la réservation (réservée ou expirée). */
    jusquAu: Date | null;
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
                {d.jusquAu ? ` ${T.jusquAu(dateCourte(d.jusquAu))}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
