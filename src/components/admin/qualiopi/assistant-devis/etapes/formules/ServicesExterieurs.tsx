"use client";
// use-client: liste éditable contrôlée de services extérieurs.

/**
 * Services extérieurs et plafond (fiche E14). Ces montants sont HORS totaux du devis : ils
 * sont indicatifs. Une estimation vide = « selon l'offre du fournisseur » (null, jamais 0).
 * Le texte du plafond vient de la bibliothèque (props) ; le montant saisi est converti en
 * centimes par `eurosEnCents`, un montant illisible est refusé sans toucher à l'état.
 */
import { useId, type Dispatch } from "react";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { eurosEnCents } from "../../calculs";
import { LibelleSegment } from "../LibelleSegment";
import type { ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";

export interface PropsServicesExterieurs {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  /** Texte actif de la bibliothèque qui accompagne le plafond. */
  textePlafond: string;
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

type Service = EtatAssistant["servicesTiers"][number];

const centsVersSaisie = (c: number | null): string =>
  c === null ? "" : (c / 100).toFixed(2).replace(/\.00$/, "").replace(".", ",");

function Estimation({
  index,
  saisie,
  onChange,
}: {
  index: number;
  saisie: string;
  onChange: (saisie: string) => void;
}) {
  const uid = useId();
  const vide = saisie.trim() === "";
  const illisible = !vide && eurosEnCents(saisie) === null;
  return (
    <div className="flex flex-col">
      <label className="flex flex-col gap-1">
        Estimation du service {index + 1} (HT)
        <input
          inputMode="decimal"
          className={`${CHAMP} text-right whitespace-nowrap tabular-nums`}
          value={saisie}
          aria-invalid={illisible}
          aria-describedby={`${uid}-d`}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <span
        id={`${uid}-d`}
        role={illisible ? "alert" : undefined}
        className={
          illisible
            ? "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive-fg)]"
            : "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]"
        }
      >
        {illisible
          ? "Montant illisible : des euros avec 2 décimales au plus."
          : vide
            ? "Affiché au client : selon l'offre du fournisseur."
            : ""}
      </span>
    </div>
  );
}

export function ServicesExterieurs({ etat, dispatch, textePlafond }: PropsServicesExterieurs) {
  const uid = useId();
  const services = etat.servicesTiers;
  // Saisies brutes alignées sur les services : l'écran n'a aucun état local, retirer un autre
  // service ne peut donc plus laisser un champ afficher l'ancienne valeur d'un autre.
  const saisies = services.map(
    (s, i) => etat.servicesSaisies?.[i] ?? centsVersSaisie(s.estimationHtCents),
  );
  const maj = (i: number, patch: Partial<Service>) =>
    dispatch({
      type: "champs",
      patch: { servicesTiers: services.map((s, k) => (k === i ? { ...s, ...patch } : s)) },
    });
  const majEstimation = (i: number, v: string) => {
    const c = v.trim() === "" ? null : eurosEnCents(v);
    // Vide ou illisible : l'ancien montant ne reste jamais en silence (null + erreur à l'étape).
    dispatch({
      type: "champs",
      patch: {
        servicesSaisies: saisies.map((t, k) => (k === i ? v : t)),
        servicesTiers: services.map((s, k) => (k === i ? { ...s, estimationHtCents: c } : s)),
      },
    });
  };
  const retirer = (i: number) =>
    dispatch({
      type: "champs",
      patch: {
        servicesTiers: services.filter((_, k) => k !== i),
        servicesSaisies: saisies.filter((_, k) => k !== i),
      },
    });
  const ajouter = () =>
    dispatch({
      type: "champs",
      patch: {
        servicesTiers: [
          ...services,
          { nom: "", obligatoire: true, estimationHtCents: null, rythme: "mensuel" },
        ],
        servicesSaisies: [...saisies, ""],
      },
    });
  const plafond = etat.plafondAConfirmer;
  const plafondSaisie =
    etat.plafondSaisie !== undefined
      ? etat.plafondSaisie
      : plafond
        ? centsVersSaisie(plafond.montantHtCents)
        : null;
  const plafondActif = plafondSaisie !== null;
  const plafondVide = plafondSaisie !== null && plafondSaisie.trim() === "";
  const plafondCents = plafondSaisie === null || plafondVide ? null : eurosEnCents(plafondSaisie);
  const plafondIllisible = plafondActif && (plafondVide || plafondCents === null);
  const majPlafond = (v: string | null) => {
    const c = v === null || v.trim() === "" ? null : eurosEnCents(v);
    dispatch({
      type: "champs",
      patch: {
        plafondSaisie: v,
        plafondAConfirmer: c === null ? null : { montantHtCents: c, texte: textePlafond },
      },
    });
  };

  return (
    <AdminCard as="div" className="mb-[var(--space-admin-8)]">
      <section aria-labelledby={`${uid}-t`}>
        <div className="mb-[var(--space-admin-5)] flex items-center gap-[var(--space-admin-2)]">
          <h3 id={`${uid}-t`} className="text-[length:var(--text-admin-lg)] font-semibold">
            Services extérieurs nécessaires
          </h3>
          <details className="relative inline-block">
            <summary
              aria-label="En savoir plus sur les services extérieurs"
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
              Le client les paie directement au fournisseur : ils ne sont pas dans notre prix. Le
              devis les annonce avant la signature, avec un prix indicatif.
            </div>
          </details>
        </div>
        {services.map((s, i) => (
          <div
            key={i}
            className="mb-[var(--space-admin-5)] grid gap-[var(--space-admin-4)] rounded-[var(--radius-admin-lg)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-surface-sunken)] p-[var(--space-admin-5)] sm:grid-cols-2"
          >
            <label className="flex flex-col gap-1">
              Nom du service {i + 1}
              <input
                className={CHAMP}
                value={s.nom}
                onChange={(e) => maj(i, { nom: e.target.value })}
              />
            </label>
            <Estimation index={i} saisie={saisies[i] ?? ""} onChange={(v) => majEstimation(i, v)} />
            <fieldset>
              <legend className={LEGENDE}>Service {i + 1} : obligatoire ou facultatif</legend>
              <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
                <div className={GROUPE_SEGMENTS}>
                  <label className={SEGMENT}>
                    <input
                      type="radio"
                      className="sr-only"
                      name={`obl-${uid}-${i}`}
                      checked={s.obligatoire}
                      onChange={() => maj(i, { obligatoire: true })}
                    />
                    <LibelleSegment coche={s.obligatoire} texte={"Obligatoire"} />
                  </label>
                  <label className={SEGMENT}>
                    <input
                      type="radio"
                      className="sr-only"
                      name={`obl-${uid}-${i}`}
                      checked={!s.obligatoire}
                      onChange={() => maj(i, { obligatoire: false })}
                    />
                    <LibelleSegment coche={!s.obligatoire} texte={"Facultatif"} />
                  </label>
                </div>
                {s.obligatoire ? (
                  <span aria-hidden="true">
                    <AdminBadge tone="warning">Obligatoire</AdminBadge>
                  </span>
                ) : (
                  <span aria-hidden="true">
                    <AdminBadge tone="neutral">Facultatif</AdminBadge>
                  </span>
                )}
              </div>
            </fieldset>
            <fieldset>
              <legend className={LEGENDE}>Service {i + 1} : rythme</legend>
              <div className={GROUPE_SEGMENTS}>
                {(["ponctuel", "mensuel", "annuel"] as const).map((r) => (
                  <label key={r} className={SEGMENT}>
                    <input
                      type="radio"
                      className="sr-only"
                      name={`rythme-${uid}-${i}`}
                      checked={s.rythme === r}
                      onChange={() => maj(i, { rythme: r })}
                    />
                    <LibelleSegment
                      coche={s.rythme === r}
                      texte={
                        r === "ponctuel" ? "Une fois" : r === "mensuel" ? "Par mois" : "Par an"
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <AdminButton variant="secondary" size="lg" onClick={() => retirer(i)}>
                Retirer le service {i + 1}
              </AdminButton>
            </div>
          </div>
        ))}
        <AdminButton variant="secondary" size="lg" onClick={ajouter}>
          + Ajouter un service
        </AdminButton>

        <div className="mt-[var(--space-admin-6)]">
          <label className="flex min-h-[44px] items-center gap-2">
            <input
              type="checkbox"
              checked={plafondActif}
              onChange={(e) => majPlafond(e.target.checked ? "" : null)}
            />
            Fixer un plafond pour les autres frais à confirmer
          </label>
          {plafondActif ? (
            <label className="mt-[var(--space-admin-3)] flex flex-col gap-1">
              Plafond (HT)
              <input
                inputMode="decimal"
                className={`${CHAMP} text-right whitespace-nowrap tabular-nums`}
                value={plafondSaisie}
                aria-invalid={plafondIllisible}
                aria-describedby={plafondIllisible ? `${uid}-p` : undefined}
                onChange={(e) => majPlafond(e.target.value)}
              />
              {plafondIllisible ? (
                <span
                  id={`${uid}-p`}
                  role="alert"
                  className="text-[color:var(--color-admin-destructive-fg)]"
                >
                  {plafondVide
                    ? "Saisissez un montant, ou décochez le plafond."
                    : "Montant illisible : des euros avec 2 décimales au plus."}
                </span>
              ) : null}
            </label>
          ) : null}
        </div>
      </section>
    </AdminCard>
  );
}
