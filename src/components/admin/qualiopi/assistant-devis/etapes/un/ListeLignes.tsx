"use client";
// use-client: liste de lignes éditable (état de confirmation, focus après suppression).

/**
 * Étape 1 — « Contenu du devis » (fiche E09). Ajout par type, suppression confirmée quand la
 * ligne est remplie, focus rendu à la ligne voisine, dépendances de planning sans cycle.
 * Aucun calcul de montant ici (les totaux viennent de `calculs.ts`, dans l'aperçu direct).
 */
import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";

import type { ActionAssistant } from "../../etat";
import { appliquerOffre, noteDeLOffre, type OffreCatalogue } from "../../lignes";
import type { EtatAssistant, LigneAssistant, TypeLigne } from "../../types";
import { LIBELLES_TYPE, LigneContenu, type AutreLigne } from "./LigneContenu";

export interface PropsListeLignes {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  offres: readonly OffreCatalogue[];
}

const TYPES: readonly TypeLigne[] = ["automatisation", "formation", "audit", "site_web", "libre"];

const estRemplie = (l: LigneAssistant): boolean =>
  l.libelle.trim() !== "" ||
  l.prixEur.trim() !== "" ||
  l.delaiSemaines.trim() !== "" ||
  l.champsLibres.length > 0;

/** Vrai si `depart` dépend (directement ou de loin) de `cible` par « nécessite ». */
function dependDe(lignes: readonly LigneAssistant[], depart: string, cible: string): boolean {
  const vus = new Set<string>();
  const pile = [depart];
  while (pile.length > 0) {
    const id = pile.pop()!;
    if (vus.has(id)) continue;
    vus.add(id);
    const l = lignes.find((x) => x.id === id);
    for (const n of l?.necessite ?? []) {
      if (n === cible) return true;
      pile.push(n);
    }
  }
  return false;
}

const etiquette = (l: LigneAssistant, i: number): string =>
  l.libelle.trim() !== "" ? l.libelle : `Ligne ${i + 1}`;

export function ListeLignes({ etat, dispatch, offres }: PropsListeLignes) {
  const { lignes } = etat;
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sansPrix, setSansPrix] = useState<ReadonlySet<string>>(new Set());
  const refs = useRef(new Map<string, HTMLInputElement>());
  const focusApres = useRef<string | null>(null);
  const compteur = useRef(0);

  useEffect(() => {
    const id = focusApres.current;
    if (id === null) return;
    focusApres.current = null;
    refs.current.get(id)?.focus();
  }, [lignes]);

  function nouvelId(): string {
    let id: string;
    do {
      compteur.current += 1;
      id = `ligne-n${compteur.current}`;
    } while (lignes.some((l) => l.id === id));
    return id;
  }

  const autresParLigne = useMemo(() => {
    const out = new Map<string, AutreLigne[]>();
    for (const l of lignes) {
      out.set(
        l.id,
        lignes
          .map((x, i) => ({ x, i }))
          .filter(({ x }) => x.id !== l.id)
          .map(({ x, i }) => ({
            id: x.id,
            etiquette: etiquette(x, i),
            // Cocher `x` pour `l` crée un cycle si `x` dépend déjà de `l`.
            cycle: dependDe(lignes, x.id, l.id),
          })),
      );
    }
    return out;
  }, [lignes]);

  function choisirOffre(ligneId: string, code: string) {
    const l = lignes.find((x) => x.id === ligneId);
    if (!l) return;
    const r = appliquerOffre(l, offres, code);
    setSansPrix((s) => {
      const n = new Set(s);
      if (r.sansPrixFerme) n.add(ligneId);
      else n.delete(ligneId);
      return n;
    });
    // Remplacement de la liste : `appliquerOffre` peut RETIRER `offreTierId`, ce qu'un patch ne sait pas faire.
    dispatch({
      type: "champs",
      patch: { lignes: lignes.map((x) => (x.id === ligneId ? r.ligne : x)) },
    });
  }

  function supprimer(id: string) {
    const i = lignes.findIndex((x) => x.id === id);
    const cible = lignes[i];
    if (!cible || lignes.length <= 1) return;
    const touchees = lignes.filter((x) => x.necessite.includes(id));
    setMessage(
      touchees.length > 0
        ? `La dépendance à « ${etiquette(cible, i)} » a été retirée de : ${touchees
            .map((t) => etiquette(t, lignes.indexOf(t)))
            .join(", ")}.`
        : `La ligne « ${etiquette(cible, i)} » a été supprimée.`,
    );
    const voisine = lignes[i - 1] ?? lignes[i + 1];
    focusApres.current = voisine ? voisine.id : null;
    setASupprimer(null);
    dispatch({ type: "ligne_supprimer", id });
  }

  function demander(id: string) {
    const l = lignes.find((x) => x.id === id);
    if (l && estRemplie(l)) setASupprimer(id);
    else supprimer(id);
  }

  return (
    <section aria-labelledby="titre-lignes" className="mb-[var(--space-admin-6,16px)]">
      <h3 id="titre-lignes" className="mb-[var(--space-admin-3,6px)]">
        Contenu du devis
      </h3>
      <p className="mb-2 text-[length:var(--text-admin-sm)]">
        Autant de lignes que vous voulez. Chacune a son prix, son délai, ses champs libres. Toutes
        les lignes sont comprises dans le prix.
      </p>
      <ol className="list-none p-0">
        {lignes.map((l, i) => (
          <LigneContenu
            key={l.id}
            ligne={l}
            rang={i + 1}
            autres={autresParLigne.get(l.id) ?? []}
            offres={offres}
            note={l.offreCode !== "" ? noteDeLOffre(offres, l.offreCode) : null}
            sansPrixFerme={sansPrix.has(l.id)}
            confirmation={aSupprimer === l.id}
            peutSupprimer={lignes.length > 1}
            dispatch={dispatch}
            onChoisirOffre={choisirOffre}
            onDemanderSuppression={demander}
            onConfirmerSuppression={supprimer}
            onAnnulerSuppression={() => setASupprimer(null)}
            refLibelle={(el) => {
              if (el) refs.current.set(l.id, el);
              else refs.current.delete(l.id);
            }}
          />
        ))}
      </ol>
      <p role="status" aria-live="polite" className="mb-2 min-h-[1.5rem]">
        {message}
      </p>
      <div className="flex flex-wrap gap-3">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className="min-h-[44px] rounded border px-3"
            onClick={() => dispatch({ type: "ligne_ajouter", id: nouvelId(), typeLigne: t })}
          >
            + {LIBELLES_TYPE[t]}
          </button>
        ))}
      </div>
    </section>
  );
}
