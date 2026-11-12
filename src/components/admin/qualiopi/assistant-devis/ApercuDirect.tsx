"use client";
// use-client: aperçu recalculé à chaque frappe, sous useDeferredValue pour ne jamais bloquer la saisie.

/**
 * Aperçu en direct de l'étape 1 (fiche E10). Lecture seule : les montants viennent de
 * `calculs.ts` (mêmes fonctions que le moteur, taux de TVA reçu en paramètre), jamais
 * recalculés ici. Largeur fixe côté parent (CLS = 0). Aucun montant d'exemple.
 */
import { useDeferredValue, useEffect, useRef, useState } from "react";

import { totauxLignes } from "./calculs";
import type { EtatAssistant } from "./types";

export interface PropsApercuDirect {
  etat: EtatAssistant;
  tvaStandardPct: number;
  clientNom?: string | undefined;
}

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
/** Centimes entiers → « 1 234,56 € » (la division n'a lieu qu'à l'affichage). */
const euros = (cents: number): string => EUROS.format(cents / 100);

export function ApercuDirect({ etat, tvaStandardPct, clientNom }: PropsApercuDirect) {
  const lignes = useDeferredValue(etat.lignes);
  const intitule = useDeferredValue(etat.intitule);
  const total = totauxLignes(lignes, tvaStandardPct);

  // Annonce unique au départ d'un champ de saisie (jamais à la frappe) : la zone des totaux
  // n'est pas une zone live, sinon chaque touche ferait relire trois montants.
  const [annonce, setAnnonce] = useState("");
  const dernierTotal = useRef(etat.lignes);
  useEffect(() => {
    dernierTotal.current = etat.lignes;
  });
  useEffect(() => {
    const auDepart = (ev: FocusEvent) => {
      const cible = ev.target;
      if (!(cible instanceof HTMLElement) || !cible.matches("input, textarea, select")) return;
      const t = totauxLignes(dernierTotal.current, tvaStandardPct);
      setAnnonce(`Total TTC du devis : ${euros(t.ttcCents)}.`);
    };
    document.addEventListener("focusout", auDepart);
    return () => document.removeEventListener("focusout", auDepart);
  }, [tvaStandardPct]);

  return (
    <aside aria-label="Aperçu en direct" className="w-full rounded border p-3 lg:w-[22rem]">
      <p className="font-medium">Devis · brouillon</p>
      {clientNom ? <p>{clientNom}</p> : null}
      {intitule.trim() !== "" ? <p>{intitule}</p> : null}
      <ul className="my-2 list-none p-0">
        {lignes.map((l, i) => {
          const t = totauxLignes([l], tvaStandardPct);
          return (
            <li key={l.id} className="flex justify-between gap-2">
              <span>{l.libelle.trim() !== "" ? l.libelle : `Ligne ${i + 1}`}</span>
              <span>{t.incomplet ? "—" : euros(t.htCents)}</span>
            </li>
          );
        })}
      </ul>
      <div className="border-t pt-2">
        <p className="flex justify-between">
          <span>Total HT</span>
          <span>{euros(total.htCents)}</span>
        </p>
        <p className="flex justify-between">
          <span>TVA {String(tvaStandardPct).replace(".", ",")} %</span>
          <span>{euros(total.tvaCents)}</span>
        </p>
        <p className="flex justify-between font-medium">
          <span>Total TTC</span>
          <span>{euros(total.ttcCents)}</span>
        </p>
      </div>
      {total.incomplet ? (
        <p className="mt-2 text-[length:var(--text-admin-sm)]">
          Certaines lignes sont illisibles (prix ou quantité) : elles ne sont pas comptées ici.
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {annonce}
      </p>
    </aside>
  );
}
