"use client";
// use-client: champs contrôlés de la carte B (mise en service, abonnement, niveau, IA).

/**
 * Carte de la formule B (fiche E14). B seule : la mise en service vaut le total des lignes
 * de l'étape 1, en lecture. A + B : montant saisi. Si un montant a été saisi puis que l'on
 * passe en B seule, il est GARDÉ mais non utilisé, et la carte le dit en clair (D1.5).
 * Niveau et « IA incluse » sont des choix sans montant. Aucun montant calculé ici : tout vient
 * de `calculs.ts`, le taux de TVA vient des props.
 */
import { useId, type Dispatch } from "react";

import { eurosEnCents, miseEnServiceIgnoree, totauxMiseEnServiceB } from "../../calculs";
import { propositionEffective, type ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";

export interface PropsCarteFormuleB {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  tvaStandardPct: number;
}

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const euros = (cents: number): string => EUROS.format(cents / 100);
const NIVEAUX = [
  { valeur: "essentiel", libelle: "Essentiel" },
  { valeur: "pro", libelle: "Pro" },
  { valeur: "etendu", libelle: "Étendu" },
] as const;

export function CarteFormuleB({ etat, dispatch, tvaStandardPct }: PropsCarteFormuleB) {
  const uid = useId();
  const ab = etat.abonnement;
  const seule = propositionEffective(etat) === "B";
  const ignoree = miseEnServiceIgnoree(etat, tvaStandardPct);
  const mensuelIllisible =
    ab.mensuelCatalogueEur.trim() !== "" && eurosEnCents(ab.mensuelCatalogueEur) === null;
  const saisieIllisible =
    !seule && ab.miseEnServiceSaisie.trim() !== "" && eurosEnCents(ab.miseEnServiceSaisie) === null;
  const majIA = (patch: Partial<EtatAssistant["ia"]["abonnement"]>) =>
    dispatch({
      type: "champs",
      patch: { ia: { ...etat.ia, abonnement: { ...etat.ia.abonnement, ...patch } } },
    });

  return (
    <section
      aria-labelledby={`${uid}-titre`}
      className="mb-[var(--space-admin-6,16px)] rounded border p-3"
    >
      <h3 id={`${uid}-titre`}>Formule B : chez Axion-IA, en abonnement</h3>
      <p className="text-[length:var(--text-admin-sm)]">
        Mise en service puis abonnement mensuel. Nous hébergeons et faisons vivre l&apos;assistant.
      </p>

      {seule ? (
        <label className="mb-3 flex flex-col">
          Mise en service (HT) : total des lignes de l&apos;étape 1
          <input
            readOnly
            className="min-h-[44px] rounded border px-2"
            value={euros(totauxMiseEnServiceB(etat, tvaStandardPct).htCents)}
          />
        </label>
      ) : (
        <label className="mb-3 flex flex-col">
          Mise en service et adaptation (HT)
          <input
            inputMode="decimal"
            className="min-h-[44px] rounded border px-2"
            value={ab.miseEnServiceSaisie}
            aria-invalid={saisieIllisible}
            aria-describedby={saisieIllisible ? `${uid}-ms` : undefined}
            onChange={(e) =>
              dispatch({ type: "abonnement", patch: { miseEnServiceSaisie: e.target.value } })
            }
          />
          {saisieIllisible ? (
            <span id={`${uid}-ms`}>Montant illisible : des euros avec 2 décimales au plus.</span>
          ) : null}
        </label>
      )}
      {ignoree ? (
        <p role="note" className="mb-3 text-[length:var(--text-admin-sm)]">
          Le montant de {euros(ignoree.saisieCents)} saisi pour les deux formules ne s&apos;applique
          pas en formule B seule ; la mise en service vaut le total des lignes,{" "}
          {euros(ignoree.totalLignesCents)}.
        </p>
      ) : null}

      <label className="mb-3 flex flex-col">
        Abonnement mensuel (HT)
        <input
          inputMode="decimal"
          className="min-h-[44px] rounded border px-2"
          value={ab.mensuelCatalogueEur}
          aria-invalid={mensuelIllisible}
          aria-describedby={mensuelIllisible ? `${uid}-mensuel` : undefined}
          onChange={(e) =>
            dispatch({ type: "abonnement", patch: { mensuelCatalogueEur: e.target.value } })
          }
        />
        {mensuelIllisible ? (
          <span id={`${uid}-mensuel`}>Montant illisible : des euros avec 2 décimales au plus.</span>
        ) : null}
      </label>

      <fieldset className="mb-3">
        <legend>Niveau d&apos;abonnement</legend>
        <div className="flex flex-wrap gap-4">
          {NIVEAUX.map((n) => (
            <label key={n.valeur} className="flex min-h-[44px] items-center gap-2">
              <input
                type="radio"
                name={`niveau-${uid}`}
                checked={etat.ia.abonnement.niveau === n.valeur}
                onChange={() => majIA({ niveau: n.valeur })}
              />
              {n.libelle}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-3">
        <legend>Utilisation de l&apos;IA</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="radio"
              name={`ia-b-${uid}`}
              checked={etat.ia.abonnement.mode === "incluse"}
              onChange={() => majIA({ mode: "incluse" })}
            />
            Incluse dans l&apos;abonnement
          </label>
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="radio"
              name={`ia-b-${uid}`}
              checked={etat.ia.abonnement.mode === "non_incluse"}
              onChange={() => majIA({ mode: "non_incluse" })}
            />
            Non incluse
          </label>
        </div>
      </fieldset>
    </section>
  );
}
