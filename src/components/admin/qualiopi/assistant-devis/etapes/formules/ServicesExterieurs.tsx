"use client";
// use-client: liste éditable contrôlée de services extérieurs.

/**
 * Services extérieurs et plafond (fiche E14). Ces montants sont HORS totaux du devis : ils
 * sont indicatifs. Une estimation vide = « selon l'offre du fournisseur » (null, jamais 0).
 * Le texte du plafond vient de la bibliothèque (props) ; le montant saisi est converti en
 * centimes par `eurosEnCents`, un montant illisible est refusé sans toucher à l'état.
 */
import { useId, type Dispatch } from "react";

import { eurosEnCents } from "../../calculs";
import type { ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";

export interface PropsServicesExterieurs {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  /** Texte actif de la bibliothèque qui accompagne le plafond. */
  textePlafond: string;
}

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
      <label className="flex flex-col">
        Estimation du service {index + 1} (HT)
        <input
          inputMode="decimal"
          className="min-h-[44px] rounded border px-2"
          value={saisie}
          aria-invalid={illisible}
          aria-describedby={`${uid}-d`}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <span id={`${uid}-d`} role={illisible ? "alert" : undefined}>
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
    <section
      aria-labelledby={`${uid}-t`}
      className="mb-[var(--space-admin-6,16px)] rounded border p-3"
    >
      <h3 id={`${uid}-t`}>Services extérieurs nécessaires</h3>
      <p className="text-[length:var(--text-admin-sm)]">
        Le client les paie directement au fournisseur : ils ne sont pas dans notre prix. Le devis
        les annonce avant la signature, avec un prix indicatif.
      </p>
      {services.map((s, i) => (
        <div key={i} className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col">
            Nom du service {i + 1}
            <input
              className="min-h-[44px] rounded border px-2"
              value={s.nom}
              onChange={(e) => maj(i, { nom: e.target.value })}
            />
          </label>
          <Estimation index={i} saisie={saisies[i] ?? ""} onChange={(v) => majEstimation(i, v)} />
          <fieldset>
            <legend>Service {i + 1} : obligatoire ou facultatif</legend>
            <div className="flex gap-4">
              <label className="flex min-h-[44px] items-center gap-2">
                <input
                  type="radio"
                  name={`obl-${uid}-${i}`}
                  checked={s.obligatoire}
                  onChange={() => maj(i, { obligatoire: true })}
                />
                Obligatoire
              </label>
              <label className="flex min-h-[44px] items-center gap-2">
                <input
                  type="radio"
                  name={`obl-${uid}-${i}`}
                  checked={!s.obligatoire}
                  onChange={() => maj(i, { obligatoire: false })}
                />
                Facultatif
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Service {i + 1} : rythme</legend>
            <div className="flex flex-wrap gap-4">
              {(["ponctuel", "mensuel", "annuel"] as const).map((r) => (
                <label key={r} className="flex min-h-[44px] items-center gap-2">
                  <input
                    type="radio"
                    name={`rythme-${uid}-${i}`}
                    checked={s.rythme === r}
                    onChange={() => maj(i, { rythme: r })}
                  />
                  {r === "ponctuel" ? "Une fois" : r === "mensuel" ? "Par mois" : "Par an"}
                </label>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            className="min-h-[44px] rounded border px-4"
            onClick={() => retirer(i)}
          >
            Retirer le service {i + 1}
          </button>
        </div>
      ))}
      <button type="button" className="min-h-[44px] rounded border px-4" onClick={ajouter}>
        + Ajouter un service
      </button>

      <div className="mt-4">
        <label className="flex min-h-[44px] items-center gap-2">
          <input
            type="checkbox"
            checked={plafondActif}
            onChange={(e) => majPlafond(e.target.checked ? "" : null)}
          />
          Fixer un plafond pour les autres frais à confirmer
        </label>
        {plafondActif ? (
          <label className="flex flex-col">
            Plafond (HT)
            <input
              inputMode="decimal"
              className="min-h-[44px] rounded border px-2"
              value={plafondSaisie}
              aria-invalid={plafondIllisible}
              aria-describedby={plafondIllisible ? `${uid}-p` : undefined}
              onChange={(e) => majPlafond(e.target.value)}
            />
            {plafondIllisible ? (
              <span id={`${uid}-p`} role="alert">
                {plafondVide
                  ? "Saisissez un montant, ou décochez le plafond."
                  : "Montant illisible : des euros avec 2 décimales au plus."}
              </span>
            ) : null}
          </label>
        ) : null}
      </div>
    </section>
  );
}
