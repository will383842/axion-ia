"use client";
// use-client: ligne éditable (champs contrôlés, mémoïsée pour garder la saisie sous 100 ms d INP).

/**
 * Une ligne du devis (fiche E09). Libellé, quantité, prix HT, délai, offre du catalogue,
 * « nécessite (et démarre après) » (information de planning : aucun effet sur le prix),
 * champs libres. PAS de choix facultative / indispensable en v1 (D1) : toutes les lignes sont
 * dans le prix. Un prix ou une quantité illisible est signalé, jamais ramené à 0.
 */
import { memo, useCallback, useEffect, useRef, type Dispatch } from "react";

import { eurosEnCents, quantiteLue } from "../../calculs";
import type { ActionAssistant } from "../../etat";
import type { OffreCatalogue } from "../../lignes";
import type { LigneAssistant, TypeLigne } from "../../types";

export const LIBELLES_TYPE: Record<TypeLigne, string> = {
  automatisation: "Automatisation",
  formation: "Formation",
  audit: "Audit",
  site_web: "Site web",
  libre: "Ligne libre",
};

export interface AutreLigne {
  id: string;
  etiquette: string;
  /** Vrai si cette ligne dépend déjà (même de loin) de la ligne éditée : la cocher ferait un cycle. */
  cycle: boolean;
}

export interface PropsLigneContenu {
  ligne: LigneAssistant;
  rang: number;
  autres: readonly AutreLigne[];
  offres: readonly OffreCatalogue[];
  note: string | null;
  sansPrixFerme: boolean;
  confirmation: boolean;
  peutSupprimer: boolean;
  dispatch: Dispatch<ActionAssistant>;
  onChoisirOffre: (ligneId: string, code: string) => void;
  onDemanderSuppression: (ligneId: string) => void;
  onConfirmerSuppression: (ligneId: string) => void;
  onAnnulerSuppression: () => void;
  /** Stable (même fonction à chaque rendu) : le parent y enregistre le champ Libellé de la ligne. */
  enregistrerLibelle: (ligneId: string, el: HTMLInputElement | null) => void;
}

function LigneContenuBrut({
  ligne: l,
  rang,
  autres,
  offres,
  note,
  sansPrixFerme,
  confirmation,
  peutSupprimer,
  dispatch,
  onChoisirOffre,
  onDemanderSuppression,
  onConfirmerSuppression,
  onAnnulerSuppression,
  enregistrerLibelle,
}: PropsLigneContenu) {
  const modifier = (patch: Partial<Omit<LigneAssistant, "id">>) =>
    dispatch({ type: "ligne_modifier", id: l.id, patch });
  const pre = `ligne-${l.id}`;
  const prixIllisible = l.prixEur.trim() !== "" && eurosEnCents(l.prixEur) === null;
  const quantiteIllisible = quantiteLue(l.quantite) === null;
  const refLibelle = useCallback(
    (el: HTMLInputElement | null) => enregistrerLibelle(l.id, el),
    [enregistrerLibelle, l.id],
  );

  // Le bouton cliqué disparaît quand la confirmation s'ouvre ou se ferme : sans ceci le focus
  // tomberait sur la page. Ouverture -> « Garder la ligne » (choix sûr) ; abandon -> « Supprimer ».
  // La confirmation menée au bout supprime la ligne : ListeLignes replace alors le focus.
  const refGarder = useRef<HTMLButtonElement>(null);
  const refSupprimer = useRef<HTMLButtonElement>(null);
  const focusAuChangement = useRef(false);
  useEffect(() => {
    if (!focusAuChangement.current) return;
    focusAuChangement.current = false;
    (confirmation ? refGarder : refSupprimer).current?.focus();
  }, [confirmation]);

  return (
    <li className="mb-[var(--space-admin-4,8px)] rounded border p-3" aria-label={`Ligne ${rang}`}>
      <p className="font-medium">
        Ligne {rang} — {LIBELLES_TYPE[l.type]}
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col sm:col-span-2">
          Libellé
          <input
            ref={refLibelle}
            className="min-h-[44px] rounded border px-2"
            value={l.libelle}
            onChange={(e) => modifier({ libelle: e.target.value, designationDepuisOffre: false })}
          />
        </label>
        <label className="flex flex-col">
          Quantité
          <input
            inputMode="decimal"
            className="min-h-[44px] rounded border px-2"
            value={l.quantite}
            aria-invalid={quantiteIllisible}
            aria-describedby={quantiteIllisible ? `${pre}-qte` : undefined}
            onChange={(e) => modifier({ quantite: e.target.value })}
          />
          {quantiteIllisible ? (
            <span id={`${pre}-qte`}>Quantité illisible : positive, 2 décimales au plus.</span>
          ) : null}
        </label>
        <label className="flex flex-col">
          Prix (€ HT)
          <input
            inputMode="decimal"
            className="min-h-[44px] rounded border px-2"
            value={l.prixEur}
            aria-invalid={prixIllisible}
            aria-describedby={prixIllisible ? `${pre}-prix` : undefined}
            onChange={(e) => modifier({ prixEur: e.target.value })}
          />
          {prixIllisible ? (
            <span id={`${pre}-prix`}>
              Prix illisible : des euros avec 2 décimales au plus (ex. 1 190,50). Il n&apos;est pas
              compté.
            </span>
          ) : null}
        </label>
        <label className="flex flex-col">
          Délai (semaines)
          <input
            inputMode="numeric"
            className="min-h-[44px] rounded border px-2"
            value={l.delaiSemaines}
            onChange={(e) => {
              if (/^\d*$/.test(e.target.value)) modifier({ delaiSemaines: e.target.value });
            }}
          />
        </label>
        {offres.length > 0 ? (
          <label className="flex flex-col sm:col-span-3">
            Offre du catalogue
            <select
              className="min-h-[44px] rounded border px-2"
              value={l.offreCode}
              onChange={(e) => onChoisirOffre(l.id, e.target.value)}
            >
              <option value="">Aucune</option>
              {offres.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.titreFr}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {note ? <p className="mt-1 text-[length:var(--text-admin-sm)]">{note}</p> : null}
      {sansPrixFerme ? (
        <p className="mt-1 text-[length:var(--text-admin-sm)]">
          Cette offre n&apos;a pas de prix ferme : saisissez le montant vous-même.
        </p>
      ) : null}

      {autres.length > 0 ? (
        <fieldset className="mt-3">
          <legend>Nécessite (et démarre après)</legend>
          <div className="flex flex-wrap gap-x-4">
            {autres.map((a) => (
              <span key={a.id} className="flex items-center gap-2">
                <input
                  id={`${pre}-apres-${a.id}`}
                  type="checkbox"
                  className="h-5 w-5"
                  checked={l.necessite.includes(a.id)}
                  disabled={a.cycle}
                  aria-describedby={a.cycle ? `${pre}-cycle-${a.id}` : undefined}
                  onChange={(e) =>
                    !a.cycle &&
                    modifier({
                      necessite: e.target.checked
                        ? [...l.necessite, a.id]
                        : l.necessite.filter((n) => n !== a.id),
                    })
                  }
                />
                <label htmlFor={`${pre}-apres-${a.id}`} className="min-h-[44px] py-2">
                  {a.etiquette}
                </label>
                {a.cycle ? (
                  <span id={`${pre}-cycle-${a.id}`} className="text-[length:var(--text-admin-sm)]">
                    Cette ligne dépend déjà de celle-ci : ce serait un cycle.
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="mt-3">
        {l.champsLibres.map((c, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-end gap-3">
            <label className="flex flex-col">
              Nom du champ
              <input
                className="min-h-[44px] rounded border px-2"
                value={c.nom}
                onChange={(e) =>
                  modifier({
                    champsLibres: l.champsLibres.map((x, j) =>
                      j === i ? { ...x, nom: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <label className="flex flex-col">
              Valeur du champ
              <input
                className="min-h-[44px] rounded border px-2"
                value={c.valeur}
                onChange={(e) =>
                  modifier({
                    champsLibres: l.champsLibres.map((x, j) =>
                      j === i ? { ...x, valeur: e.target.value } : x,
                    ),
                  })
                }
              />
            </label>
            <button
              type="button"
              className="min-h-[44px] rounded border px-3"
              onClick={() => modifier({ champsLibres: l.champsLibres.filter((_, j) => j !== i) })}
            >
              Retirer le champ
            </button>
          </div>
        ))}
        <button
          type="button"
          className="min-h-[44px] rounded border px-3"
          onClick={() => modifier({ champsLibres: [...l.champsLibres, { nom: "", valeur: "" }] })}
        >
          + Ajouter un champ libre
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        {confirmation ? (
          <>
            <button
              type="button"
              className="min-h-[44px] rounded border px-3"
              onClick={() => onConfirmerSuppression(l.id)}
            >
              Confirmer la suppression
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded border px-3"
              ref={refGarder}
              onClick={() => {
                focusAuChangement.current = true;
                onAnnulerSuppression();
              }}
            >
              Garder la ligne
            </button>
          </>
        ) : (
          <button
            type="button"
            className="min-h-[44px] rounded border px-3"
            ref={refSupprimer}
            disabled={!peutSupprimer}
            onClick={() => {
              focusAuChangement.current = true;
              onDemanderSuppression(l.id);
            }}
          >
            Supprimer la ligne {rang}
          </button>
        )}
      </div>
    </li>
  );
}

/** Mêmes autres lignes = même id, même étiquette, même cycle (la référence du tableau change à chaque frappe). */
function memesAutres(a: readonly AutreLigne[], b: readonly AutreLigne[]): boolean {
  return (
    a === b ||
    (a.length === b.length &&
      a.every(
        (x, i) => x.id === b[i]!.id && x.etiquette === b[i]!.etiquette && x.cycle === b[i]!.cycle,
      ))
  );
}

export function memesProps(avant: PropsLigneContenu, apres: PropsLigneContenu): boolean {
  const { autres: autresAvant, ...resteAvant } = avant;
  const { autres: autresApres, ...resteApres } = apres;
  return (
    memesAutres(autresAvant, autresApres) &&
    (Object.keys(resteAvant) as Array<keyof typeof resteAvant>).every((k) =>
      Object.is(resteAvant[k], resteApres[k]),
    )
  );
}

export const LigneContenu = memo(LigneContenuBrut, memesProps);
