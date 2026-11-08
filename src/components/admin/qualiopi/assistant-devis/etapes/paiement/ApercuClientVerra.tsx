"use client";
// use-client: aperçu sous useDeferredValue pour ne jamais bloquer la saisie.

/**
 * « Ce que le client verra » (fiche E15). N'affiche que les formules proposées ; les montants
 * viennent de `calculs.ts` (HT ; le taux de TVA est reçu en paramètre). Aucun montant
 * d'exemple, aucune phrase d'engagement : le détail par phase vient de l'aperçu serveur.
 */
import { useDeferredValue } from "react";

import { eurosEnCents, totauxFormuleA, totauxLignes, totauxMiseEnServiceB } from "../../calculs";
import { propositionEffective } from "../../etat";
import type { EtatAssistant } from "../../types";

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const euros = (c: number): string => EUROS.format(c / 100);

function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{libelle}</dt>
      <dd>{valeur}</dd>
    </div>
  );
}

const montantLu = (saisie: string): string => {
  const c = eurosEnCents(saisie);
  return c === null ? "—" : euros(c);
};

export function ApercuClientVerra({
  etat,
  tvaStandardPct,
}: {
  etat: EtatAssistant;
  tvaStandardPct: number;
}) {
  const e = useDeferredValue(etat);
  const p = propositionEffective(e);
  const a = p === "A" || p === "AB";
  const b = p === "B" || p === "AB";
  return (
    <aside aria-label="Ce que le client verra" className="w-full rounded border p-3 lg:w-[22rem]">
      <p className="font-medium">Ce que le client verra</p>
      {p === "prix_unique" ? (
        <dl>
          <Ligne
            libelle="Total HT"
            valeur={euros(totauxLignes(e.lignes, tvaStandardPct).htCents)}
          />
        </dl>
      ) : null}
      {a ? (
        <section aria-label="Aperçu de la formule A">
          <p className="font-medium">Formule A</p>
          <dl>
            <Ligne
              libelle="Mise en place"
              valeur={`${euros(totauxFormuleA(e, tvaStandardPct).htCents)} HT`}
            />
            <Ligne
              libelle={`Maintenance (${e.achat.maintenance.regle === "obligatoire" ? "obligatoire" : "facultative"})`}
              valeur={`${montantLu(e.achat.maintenance.mensuelEur)} HT / mois`}
            />
          </dl>
        </section>
      ) : null}
      {b ? (
        <section aria-label="Aperçu de la formule B">
          <p className="font-medium">Formule B</p>
          <dl>
            <Ligne
              libelle="Mise en service"
              valeur={`${euros(totauxMiseEnServiceB(e, tvaStandardPct).htCents)} HT`}
            />
            <Ligne
              libelle="Abonnement"
              valeur={`${montantLu(e.abonnement.mensuelCatalogueEur)} HT / mois`}
            />
          </dl>
        </section>
      ) : null}
    </aside>
  );
}
