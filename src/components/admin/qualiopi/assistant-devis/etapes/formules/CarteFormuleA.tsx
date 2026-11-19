"use client";
// use-client: champs contrôlés de la carte A (hébergement, IA, maintenance).

/**
 * Carte de la formule A (fiche E13). Le prix de la mise en place est le total HT des lignes
 * de l'étape 1, EN LECTURE (calculs.ts) : aucun prix ni taux en dur, le taux vient des props.
 * D2 : l'utilisation de l'IA est un choix sans montant ; « Via Axion-IA : forfait mensuel » est
 * grisé avec sa raison. Les « mois offerts » d'hébergement sont masqués (le moteur n'en a pas).
 */
import { useId, type Dispatch } from "react";

import { eurosEnCents, totauxFormuleA } from "../../calculs";
import type { ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";
import { BlocMaintenance } from "../phases/BlocMaintenance";

export interface PropsCarteFormuleA {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  tvaStandardPct: number;
}

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function CarteFormuleA({ etat, dispatch, tvaStandardPct }: PropsCarteFormuleA) {
  const uid = useId();
  const { achat, ia } = etat;
  const total = totauxFormuleA(etat, tvaStandardPct);
  const heb = achat.hebergementMensuelEur;
  const hebIllisible = heb.trim() !== "" && eurosEnCents(heb) === null;
  const majIA = (patch: Partial<EtatAssistant["ia"]["achat"]>) =>
    dispatch({
      type: "champs",
      patch: { ia: { ...ia, achat: { ...ia.achat, ...patch } } },
    });

  return (
    <section
      aria-labelledby={`${uid}-titre`}
      className="mb-[var(--space-admin-6,16px)] rounded border p-3"
    >
      <h3 id={`${uid}-titre`}>Formule A : installée chez vous</h3>
      <p className="text-[length:var(--text-admin-sm)]">
        Paiement unique. L&apos;assistant tourne sur les serveurs du client et lui appartient.
      </p>
      <label className="mb-3 flex flex-col">
        Prix de la mise en place (HT)
        <input
          readOnly
          className="min-h-[44px] rounded border px-2"
          value={EUROS.format(total.htCents / 100)}
          aria-describedby={`${uid}-total`}
        />
      </label>
      <p id={`${uid}-total`} className="text-[length:var(--text-admin-sm)]">
        Total des lignes de l&apos;étape 1 : il se modifie là-bas.
        {total.incomplet ? " Certaines lignes sont illisibles : elles ne sont pas comptées." : ""}
      </p>

      <fieldset className="mb-3">
        <legend>Où tourne l&apos;assistant ?</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="radio"
              name={`hebergement-${uid}`}
              checked={achat.hebergement === "client"}
              onChange={() => dispatch({ type: "achat", patch: { hebergement: "client" } })}
            />
            Sur le serveur du client
          </label>
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="radio"
              name={`hebergement-${uid}`}
              checked={achat.hebergement === "axion"}
              onChange={() => dispatch({ type: "achat", patch: { hebergement: "axion" } })}
            />
            Sur le serveur d&apos;Axion-IA (hébergement)
          </label>
        </div>
      </fieldset>
      {achat.hebergement === "axion" ? (
        <label className="mb-3 flex flex-col">
          Hébergement (HT par mois)
          <input
            required
            inputMode="decimal"
            className="min-h-[44px] rounded border px-2"
            value={heb}
            aria-invalid={hebIllisible || heb.trim() === ""}
            aria-describedby={hebIllisible || heb.trim() === "" ? `${uid}-heb` : undefined}
            onChange={(e) =>
              dispatch({ type: "achat", patch: { hebergementMensuelEur: e.target.value } })
            }
          />
          {hebIllisible || heb.trim() === "" ? (
            <span id={`${uid}-heb`} role="alert">
              {hebIllisible
                ? "Montant illisible : des euros avec 2 décimales au plus."
                : "Saisissez le montant mensuel de l'hébergement."}
            </span>
          ) : null}
        </label>
      ) : null}

      <fieldset className="mb-3">
        <legend>Utilisation de l&apos;IA</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="radio"
              name={`ia-${uid}`}
              checked={ia.achat.mode === "compte_client"}
              onChange={() => majIA({ mode: "compte_client" })}
            />
            Compte du client chez son fournisseur
          </label>
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="radio"
              name={`ia-${uid}`}
              checked={ia.achat.mode === "incluse"}
              onChange={() => majIA({ mode: "incluse" })}
            />
            Incluse pendant quelques mois
          </label>
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="radio"
              name={`ia-${uid}`}
              disabled
              checked={false}
              readOnly
              aria-describedby={`${uid}-ia-raison`}
            />
            Via Axion-IA : forfait mensuel
          </label>
        </div>
        <p id={`${uid}-ia-raison`} className="text-[length:var(--text-admin-sm)]">
          Le forfait IA n&apos;a pas encore de place sur le devis.
        </p>
        {ia.achat.mode === "incluse" ? (
          <label className="flex flex-col">
            Nombre de mois
            <input
              inputMode="numeric"
              className="min-h-[44px] rounded border px-2"
              value={ia.achat.moisInclus}
              onChange={(e) => majIA({ moisInclus: e.target.value })}
            />
          </label>
        ) : null}
      </fieldset>

      <BlocMaintenance etat={etat} dispatch={dispatch} />
    </section>
  );
}
