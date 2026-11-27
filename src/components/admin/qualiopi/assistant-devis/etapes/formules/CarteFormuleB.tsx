"use client";
// use-client: champs contrôlés de la carte B (mise en service, abonnement, niveau, IA).

/**
 * Carte de la formule B (fiche E14). B seule : la mise en service vaut le total des lignes
 * de l'étape 1, en lecture. A + B : montant saisi. Si un montant a été saisi puis que l'on
 * passe en B seule, il est GARDÉ mais non utilisé, et la carte le dit en clair (D1.5).
 * Niveau et « IA incluse » sont des choix sans montant. Aucun montant calculé ici : tout vient
 * de `calculs.ts`, le taux de TVA vient des props.
 */
import { Cloud } from "lucide-react";
import { useId, type Dispatch } from "react";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { eurosEnCents, miseEnServiceIgnoree, totauxMiseEnServiceB } from "../../calculs";
import { LibelleSegment } from "../LibelleSegment";
import { propositionEffective, type ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";

export interface PropsCarteFormuleB {
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
    <AdminCard as="div" className="mb-[var(--space-admin-8)]">
      <section aria-labelledby={`${uid}-titre`}>
        <header className="mb-[var(--space-admin-6)] flex items-center gap-[var(--space-admin-4)]">
          <span
            aria-hidden="true"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--radius-admin-lg)] bg-[color:var(--color-admin-accent)] text-white"
          >
            <Cloud size={24} aria-hidden="true" />
          </span>
          <h3 id={`${uid}-titre`} className="text-[length:var(--text-admin-lg)] font-semibold">
            Formule B : chez Axion-IA, en abonnement
          </h3>
          <AdminBadge tone="info">Abonnement</AdminBadge>
          <details className="relative inline-block">
            <summary
              aria-label="En savoir plus sur la formule B"
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
              Mise en service puis abonnement mensuel. Nous hébergeons et faisons vivre
              l&apos;assistant.
            </div>
          </details>
        </header>

        {seule ? (
          <label className="mb-[var(--space-admin-6)] flex flex-col gap-1 font-semibold">
            Mise en service (HT) : total des lignes de l&apos;étape 1
            <input
              readOnly
              className={`${CHAMP} text-right text-[length:var(--text-admin-2xl)] font-semibold whitespace-nowrap tabular-nums`}
              value={euros(totauxMiseEnServiceB(etat, tvaStandardPct).htCents)}
            />
          </label>
        ) : (
          <label className="mb-[var(--space-admin-6)] flex flex-col gap-1 font-semibold">
            Mise en service et adaptation (HT)
            <input
              inputMode="decimal"
              className={`${CHAMP} text-right text-[length:var(--text-admin-2xl)] font-semibold whitespace-nowrap tabular-nums`}
              value={ab.miseEnServiceSaisie}
              aria-invalid={saisieIllisible}
              aria-describedby={saisieIllisible ? `${uid}-ms` : undefined}
              onChange={(e) =>
                dispatch({ type: "abonnement", patch: { miseEnServiceSaisie: e.target.value } })
              }
            />
            {saisieIllisible ? (
              <span
                id={`${uid}-ms`}
                className="text-[length:var(--text-admin-sm)] font-normal text-[color:var(--color-admin-destructive-fg)]"
              >
                Montant illisible : des euros avec 2 décimales au plus.
              </span>
            ) : null}
          </label>
        )}
        {ignoree ? (
          <p
            role="note"
            className="mb-[var(--space-admin-6)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
          >
            Le montant de {euros(ignoree.saisieCents)} saisi pour les deux formules ne
            s&apos;applique pas en formule B seule ; la mise en service vaut le total des lignes,{" "}
            {euros(ignoree.totalLignesCents)}.
          </p>
        ) : null}

        <label className="mb-[var(--space-admin-6)] flex flex-col gap-1 font-semibold">
          Abonnement mensuel (HT)
          <input
            inputMode="decimal"
            className={`${CHAMP} text-right text-[length:var(--text-admin-2xl)] font-semibold whitespace-nowrap tabular-nums`}
            value={ab.mensuelCatalogueEur}
            aria-invalid={mensuelIllisible}
            aria-describedby={mensuelIllisible ? `${uid}-mensuel` : undefined}
            onChange={(e) =>
              dispatch({ type: "abonnement", patch: { mensuelCatalogueEur: e.target.value } })
            }
          />
          {mensuelIllisible ? (
            <span
              id={`${uid}-mensuel`}
              className="text-[length:var(--text-admin-sm)] font-normal text-[color:var(--color-admin-destructive-fg)]"
            >
              Montant illisible : des euros avec 2 décimales au plus.
            </span>
          ) : null}
        </label>

        <fieldset className="mb-[var(--space-admin-8)]">
          <legend className={LEGENDE}>Niveau d&apos;abonnement</legend>
          <div className={GROUPE_SEGMENTS}>
            {NIVEAUX.map((n) => (
              <label key={n.valeur} className={SEGMENT}>
                <input
                  type="radio"
                  className="sr-only"
                  name={`niveau-${uid}`}
                  checked={etat.ia.abonnement.niveau === n.valeur}
                  onChange={() => majIA({ niveau: n.valeur })}
                />
                <LibelleSegment coche={etat.ia.abonnement.niveau === n.valeur} texte={n.libelle} />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mb-[var(--space-admin-8)]">
          <legend className={LEGENDE}>Utilisation de l&apos;IA</legend>
          <div className={GROUPE_SEGMENTS}>
            <label className={SEGMENT}>
              <input
                type="radio"
                className="sr-only"
                name={`ia-b-${uid}`}
                checked={etat.ia.abonnement.mode === "incluse"}
                onChange={() => majIA({ mode: "incluse" })}
              />
              <LibelleSegment
                coche={etat.ia.abonnement.mode === "incluse"}
                texte={"Incluse dans l'abonnement"}
              />
            </label>
            <label className={SEGMENT}>
              <input
                type="radio"
                className="sr-only"
                name={`ia-b-${uid}`}
                checked={etat.ia.abonnement.mode === "non_incluse"}
                onChange={() => majIA({ mode: "non_incluse" })}
              />
              <LibelleSegment
                coche={etat.ia.abonnement.mode === "non_incluse"}
                texte={"Non incluse"}
              />
            </label>
          </div>
        </fieldset>
      </section>
    </AdminCard>
  );
}
