"use client";
// use-client: champs contrôlés de la carte A (hébergement, IA, maintenance).

/**
 * Carte de la formule A (fiche E13). Le prix de la mise en place est le total HT des lignes
 * de l'étape 1, EN LECTURE (calculs.ts) : aucun prix ni taux en dur, le taux vient des props.
 * D2 : l'utilisation de l'IA est un choix sans montant ; « Via Axion-IA : forfait mensuel » est
 * grisé avec sa raison. Les « mois offerts » d'hébergement sont masqués (le moteur n'en a pas).
 */
import { Server } from "lucide-react";
import { useId, type Dispatch } from "react";

import { eurosEnCents, totauxFormuleA } from "../../calculs";
import { LibelleSegment } from "../LibelleSegment";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import type { ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";
import { BlocMaintenance } from "../phases/BlocMaintenance";

export interface PropsCarteFormuleA {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  tvaStandardPct: number;
}

// Contrôle segmenté : vrai bouton radio masqué visuellement mais focusable ; le choix retenu porte
// une bordure d'accent de même épaisseur que les autres (pas de saut de mise en page).
const SEGMENT =
  "relative flex min-h-[44px] cursor-pointer items-center rounded-[var(--radius-admin-md)] border-2 border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] pl-[calc(var(--space-admin-4)+1.375rem)] pr-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] motion-safe:transition-colors has-[:checked]:border-[color:var(--color-admin-accent)] has-[:checked]:shadow-[0_0_0_3px_var(--color-admin-accent-track)] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[color:var(--color-admin-accent)] has-[:disabled]:cursor-not-allowed has-[:disabled]:text-[color:var(--color-admin-fg-muted)] has-[:checked]:font-semibold forced-colors:has-[:checked]:outline forced-colors:has-[:checked]:outline-2";
const GROUPE_SEGMENTS =
  "inline-flex flex-wrap gap-1 rounded-[var(--radius-admin-lg)] bg-[color:var(--color-admin-surface-sunken)] p-1";
const CHAMP =
  "min-h-[44px] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-control-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-4)]";
const LEGENDE =
  "mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg-muted)]";

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
    <AdminCard as="div" className="mb-[var(--space-admin-8)]">
      <section aria-labelledby={`${uid}-titre`}>
        <header className="mb-[var(--space-admin-6)] flex items-center gap-[var(--space-admin-4)]">
          <span
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--radius-admin-lg)] bg-[color:var(--color-admin-accent)] text-white"
          >
            <Server size={24} aria-hidden="true" />
          </span>
          <h3 id={`${uid}-titre`} className="text-[length:var(--text-admin-lg)] font-semibold">
            Formule A : installée chez vous
          </h3>
          <AdminBadge tone="neutral">Achat</AdminBadge>
          <details className="relative inline-block">
            <summary
              aria-label="En savoir plus sur la formule A"
              className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-[color:var(--color-admin-ring)] [&::-webkit-details-marker]:hidden"
            >
              <span
                aria-hidden="true"
                className="grid h-[22px] w-[22px] place-items-center rounded-full border border-[color:var(--color-admin-control-border)] text-[length:var(--text-admin-xs)] font-bold"
              >
                ?
              </span>
            </summary>
            <div className="absolute top-11 left-0 z-10 w-80 rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-5)] text-[length:var(--text-admin-sm)] shadow-[var(--shadow-admin-2)]">
              Paiement unique. L&apos;assistant tourne sur les serveurs du client et lui appartient.
            </div>
          </details>
        </header>
        <label className="mb-[var(--space-admin-3)] flex flex-col gap-1 font-semibold">
          Prix de la mise en place (HT)
          <input
            readOnly
            className={`${CHAMP} text-right text-[length:var(--text-admin-2xl)] font-semibold whitespace-nowrap tabular-nums`}
            value={EUROS.format(total.htCents / 100)}
            aria-describedby={`${uid}-total`}
          />
        </label>
        <p
          id={`${uid}-total`}
          className="mb-[var(--space-admin-8)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
        >
          Total des lignes de l&apos;étape 1 : il se modifie là-bas.
          {total.incomplet ? " Certaines lignes sont illisibles : elles ne sont pas comptées." : ""}
        </p>

        <fieldset className="mb-[var(--space-admin-8)]">
          <legend className={LEGENDE}>Où tourne l&apos;assistant ?</legend>
          <div className={GROUPE_SEGMENTS}>
            <label className={SEGMENT}>
              <input
                type="radio"
                className="sr-only"
                name={`hebergement-${uid}`}
                checked={achat.hebergement === "client"}
                onChange={() => dispatch({ type: "achat", patch: { hebergement: "client" } })}
              />
              <LibelleSegment
                coche={achat.hebergement === "client"}
                texte={"Sur le serveur du client"}
              />
            </label>
            <label className={SEGMENT}>
              <input
                type="radio"
                className="sr-only"
                name={`hebergement-${uid}`}
                checked={achat.hebergement === "axion"}
                onChange={() => dispatch({ type: "achat", patch: { hebergement: "axion" } })}
              />
              <LibelleSegment
                coche={achat.hebergement === "axion"}
                texte={"Sur le serveur d'Axion-IA (hébergement)"}
              />
            </label>
          </div>
        </fieldset>
        {achat.hebergement === "axion" ? (
          <label className="mb-[var(--space-admin-6)] flex flex-col gap-1">
            Hébergement (HT par mois)
            <input
              required
              inputMode="decimal"
              className={CHAMP}
              value={heb}
              aria-invalid={hebIllisible || heb.trim() === ""}
              aria-describedby={hebIllisible || heb.trim() === "" ? `${uid}-heb` : undefined}
              onChange={(e) =>
                dispatch({ type: "achat", patch: { hebergementMensuelEur: e.target.value } })
              }
            />
            {hebIllisible || heb.trim() === "" ? (
              <span
                id={`${uid}-heb`}
                role="alert"
                className="text-[color:var(--color-admin-destructive-fg)]"
              >
                {hebIllisible
                  ? "Montant illisible : des euros avec 2 décimales au plus."
                  : "Saisissez le montant mensuel de l'hébergement."}
              </span>
            ) : null}
          </label>
        ) : null}

        <fieldset className="mb-[var(--space-admin-8)]">
          <legend className={LEGENDE}>Utilisation de l&apos;IA</legend>
          <div className={GROUPE_SEGMENTS}>
            <label className={SEGMENT}>
              <input
                type="radio"
                className="sr-only"
                name={`ia-${uid}`}
                checked={ia.achat.mode === "compte_client"}
                onChange={() => majIA({ mode: "compte_client" })}
              />
              <LibelleSegment
                coche={ia.achat.mode === "compte_client"}
                texte={"Compte du client chez son fournisseur"}
              />
            </label>
            <label className={SEGMENT}>
              <input
                type="radio"
                className="sr-only"
                name={`ia-${uid}`}
                checked={ia.achat.mode === "incluse"}
                onChange={() => majIA({ mode: "incluse" })}
              />
              <LibelleSegment
                coche={ia.achat.mode === "incluse"}
                texte={"Incluse pendant quelques mois"}
              />
            </label>
            <label className={SEGMENT}>
              <input
                type="radio"
                className="sr-only"
                name={`ia-${uid}`}
                disabled
                checked={false}
                readOnly
                aria-describedby={`${uid}-ia-raison`}
              />
              <LibelleSegment coche={false} texte={"Via Axion-IA : forfait mensuel"} />
            </label>
          </div>
          <p
            id={`${uid}-ia-raison`}
            className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
          >
            Le forfait IA n&apos;a pas encore de place sur le devis.
          </p>
          {ia.achat.mode === "incluse" ? (
            <label className="mt-[var(--space-admin-3)] mb-[var(--space-admin-3)] flex flex-col gap-1">
              Nombre de mois
              <input
                inputMode="numeric"
                className={CHAMP}
                value={ia.achat.moisInclus}
                onChange={(e) => majIA({ moisInclus: e.target.value })}
              />
            </label>
          ) : null}
        </fieldset>

        <BlocMaintenance etat={etat} dispatch={dispatch} />
      </section>
    </AdminCard>
  );
}
