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
  // Changement de lignes sans sortie de champ (ligne ajoutée, supprimée, modèle appliqué) :
  // si l'élément actif n'est pas un champ de saisie, l'annonce suit le total. Pendant une frappe
  // le focus est dans un champ : rien n'est annoncé (l'annonce vient à la sortie du champ).
  const ttcCents = totauxLignes(etat.lignes, tvaStandardPct).ttcCents;
  const ttcPrecedent = useRef(ttcCents);
  useEffect(() => {
    if (ttcPrecedent.current === ttcCents) return;
    ttcPrecedent.current = ttcCents;
    // Différé de 300 ms : l'annonce suit le DERNIER total, pas chaque étape intermédiaire.
    const minuteur = setTimeout(() => {
      const actif = document.activeElement;
      if (actif instanceof HTMLElement && actif.matches("input, textarea, select")) return;
      setAnnonce(`Total TTC du devis : ${euros(ttcCents)}.`);
    }, 300);
    return () => clearTimeout(minuteur);
  }, [ttcCents]);
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

  const initiales = initialesDe(clientNom ?? "");
  return (
    <aside
      aria-label="Aperçu en direct"
      className="w-full rounded-[var(--radius-admin-xl,16px)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-card,20px)] shadow-[var(--shadow-admin-1)] lg:w-[22rem]"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">Devis · brouillon</p>
      </div>
      {clientNom ? (
        <div className="mt-3 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-admin-accent-track)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]"
          >
            {initiales}
          </span>
          <p className="font-medium">{clientNom}</p>
        </div>
      ) : null}
      {intitule.trim() !== "" ? <p className="mt-2">{intitule}</p> : null}
      <ul className="my-3 list-none divide-y divide-[color:var(--color-admin-border)] p-0">
        {lignes.map((l, i) => {
          const t = totauxLignes([l], tvaStandardPct);
          return (
            <li key={l.id} className="flex justify-between gap-2 py-2">
              <span className="min-w-0">
                {l.libelle.trim() !== "" ? l.libelle : `Ligne ${i + 1}`}
              </span>
              <span className="text-right whitespace-nowrap tabular-nums">
                {t.incomplet ? "—" : euros(t.htCents)}
              </span>
            </li>
          );
        })}
      </ul>
      <dl className="border-t border-[color:var(--color-admin-border)] pt-3">
        <div className="flex justify-between gap-2">
          <dt>Total HT</dt>
          <dd className="m-0 text-right whitespace-nowrap tabular-nums">{euros(total.htCents)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>TVA {String(tvaStandardPct).replace(".", ",")} %</dt>
          <dd className="m-0 text-right whitespace-nowrap tabular-nums">{euros(total.tvaCents)}</dd>
        </div>
        <div className="mt-1 flex justify-between gap-2 text-[length:var(--text-admin-xl)] font-bold">
          <dt>Total TTC</dt>
          <dd className="m-0 text-right whitespace-nowrap tabular-nums">{euros(total.ttcCents)}</dd>
        </div>
      </dl>
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

/** Deux initiales au plus, pour l'avatar (décoratif). */
function initialesDe(nom: string): string {
  const mots = nom
    .trim()
    .split(/\s+/)
    .filter((m) => m !== "");
  return mots
    .slice(0, 2)
    .map((m) => m.charAt(0).toUpperCase())
    .join("");
}
