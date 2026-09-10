"use client";
// use-client: formulaire interactif (inputs + select + useTransition) de saisie
// de l'identité fiscale du sous-traitant et de son mandat de facturation.

/**
 * Identité fiscale du sous-traitant et mandat de facturation (autofacturation).
 *
 * 🔴 CE PANNEAU EXISTE PARCE QUE CINQ COLONNES N'AVAIENT AUCUN ÉCRIVAIN.
 *
 * `regimeTvaHonoraires` est en base depuis le commissionnement (2026-07-09) et
 * n'était réglable par AUCUN écran : le moteur de rémunération lève une anomalie
 * « régime de TVA non renseigné » que personne ne pouvait fermer autrement qu'en
 * base. Les quatre autres arrivent avec l'autofacturation et auraient eu le même
 * sort — le contrôle d'éligibilité aurait refusé d'émettre pour toujours en
 * disant « renseignez-le sur sa fiche », sur une fiche où rien ne se renseignait.
 *
 * ⚠️ CE PANNEAU NE SIGNE RIEN. Il CONSIGNE ce qu'un humain a constaté sur une
 * pièce. La date à saisir est celle de la SIGNATURE, jamais celle de la saisie :
 * un mandat signé le 1er et consigné le 20 couvre les factures du 5. Horodater à
 * la saisie rendrait irrégulières, en silence, des pièces régulières.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateTrainerFacturationAction } from "@/server/actions/qualiopi/trainers";

type RegimeTvaHonoraires = "franchise_293b" | "exonere_formation" | "assujetti_20";

/** Une date ISO → la valeur `yyyy-mm-dd` attendue par un `<input type="date">`. */
function jourInput(d: Date | string | null | undefined): string {
  if (d == null) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? "" : (date.toISOString().slice(0, 10) as string);
}

export interface TrainerFacturationPanelProps {
  trainerId: string;
  initial: {
    siret: string | null;
    numeroTvaIntracom: string | null;
    regimeTvaHonoraires: RegimeTvaHonoraires | null;
    mandatAutofacturationSigneAt: Date | string | null;
    mandatAutofacturationRevoqueAt: Date | string | null;
  };
}

/**
 * ⚠️ AUCUNE RÉFÉRENCE D'ARTICLE ICI, ET C'EST VOULU.
 *
 * `tva-mention.spec.tsx` interdit qu'un écran de rendu code en dur la mention
 * d'exonération : elle doit être DÉRIVÉE du régime figé sur la pièce, sinon on
 * réimprime une exonération que la configuration ne dit plus. La garde a mordu
 * sur ce fichier au premier jet, et elle avait raison.
 *
 * Un menu déroulant NOMME un régime ; il n'imprime pas une mention. Le texte
 * légal qui part sur la facture vient de `MENTIONS_TVA_HONORAIRES`
 * (`remuneration/calcul.ts`), côté serveur, et de nulle part ailleurs. Ne pas
 * répéter l'article ici garde la frontière nette — et évite d'ajouter ce fichier
 * à l'allowlist de la garde, ce qui aurait affaibli le contrôle au lieu de le
 * satisfaire.
 */
const LIBELLE_REGIME: Record<RegimeTvaHonoraires, string> = {
  assujetti_20: "Assujetti à la TVA (20 %)",
  franchise_293b: "Franchise en base de TVA",
  exonere_formation: "Exonéré — formation professionnelle",
};

export function TrainerFacturationPanel({
  trainerId,
  initial,
}: TrainerFacturationPanelProps): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [siret, setSiret] = useState(initial.siret ?? "");
  const [tva, setTva] = useState(initial.numeroTvaIntracom ?? "");
  const [regime, setRegime] = useState<string>(initial.regimeTvaHonoraires ?? "");
  const [signeAt, setSigneAt] = useState(jourInput(initial.mandatAutofacturationSigneAt));
  const [revoqueAt, setRevoqueAt] = useState(jourInput(initial.mandatAutofacturationRevoqueAt));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);

    startTransition(async () => {
      const result = await updateTrainerFacturationAction({
        id: trainerId,
        // Chaîne vide = EFFACER (null), pas « laisser en l'état » : le champ est
        // affiché avec sa valeur courante, le vider est un geste délibéré.
        siret: siret.trim() === "" ? null : siret.trim(),
        numeroTvaIntracom: tva.trim() === "" ? null : tva.trim(),
        regimeTvaHonoraires: regime === "" ? null : (regime as RegimeTvaHonoraires),
        mandatAutofacturationSigneAt: signeAt === "" ? null : new Date(signeAt),
        mandatAutofacturationRevoqueAt: revoqueAt === "" ? null : new Date(revoqueAt),
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        setOk("Enregistré.");
        router.refresh();
      }
    });
  }

  const labelCls =
    "block text-[length:var(--text-admin-xs)] font-semibold uppercase tracking-wide text-[color:var(--color-admin-fg-muted)] mb-[var(--space-admin-1)]";
  const inputCls =
    "w-full rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-admin-accent)]";
  const fieldCls = "flex flex-col gap-[var(--space-admin-1)]";

  /**
   * 🔴 AUCUNE LECTURE D'HORLOGE PENDANT LE RENDU. Le premier jet comparait la
   * révocation à `Date.now()` : ESLint l'a refusé (règle de pureté React — un
   * rendu doit être idempotent), et il avait raison au-delà de la règle. Ce
   * panneau CONSIGNE deux dates ; il n'a pas à décider si le mandat est en
   * vigueur « maintenant ».
   *
   * Cette décision-là appartient à `mandatEnVigueur(trainer, at)`, côté serveur,
   * qui la prend contre la date de la PIÈCE et non contre l'heure du navigateur.
   * Deux réponses concurrentes à la même question auraient fini par diverger —
   * et celle affichée ici aurait été la moins juste des deux.
   */
  const etatMandat: "aucun" | "en_vigueur" | "revoque" =
    signeAt === "" ? "aucun" : revoqueAt === "" ? "en_vigueur" : "revoque";

  return (
    <form
      onSubmit={handleSubmit}
      className="admin-card mb-[var(--space-admin-5)] flex flex-col gap-[var(--space-admin-4)]"
      aria-labelledby="facturation-st-titre"
    >
      <h2
        id="facturation-st-titre"
        className="text-[length:var(--text-admin-base)] font-semibold text-[color:var(--color-admin-fg)]"
      >
        Identité fiscale et mandat de facturation
      </h2>
      <p className="admin-muted">
        Ces informations servent à établir la facture d&apos;honoraires du sous-traitant. Elles ne
        signent rien : elles consignent ce qui figure sur les pièces. La date à saisir est celle de
        la <strong>signature</strong>, jamais celle de la saisie.
      </p>

      <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
        <div className={fieldCls}>
          <label className={labelCls} htmlFor="st-siret">
            SIRET du sous-traitant
          </label>
          <input
            id="st-siret"
            className={inputCls}
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            inputMode="numeric"
            placeholder="14 chiffres"
          />
        </div>

        <div className={fieldCls}>
          <label className={labelCls} htmlFor="st-regime">
            Régime de TVA de ses honoraires
          </label>
          <select
            id="st-regime"
            className={inputCls}
            value={regime}
            onChange={(e) => setRegime(e.target.value)}
          >
            <option value="">— non renseigné —</option>
            {(Object.keys(LIBELLE_REGIME) as RegimeTvaHonoraires[]).map((r) => (
              <option key={r} value={r}>
                {LIBELLE_REGIME[r]}
              </option>
            ))}
          </select>
        </div>

        {/*
          Le n° de TVA n'est demandé qu'à l'assujetti. L'afficher pour tout le
          monde inviterait à remplir un champ que la franchise 293 B et
          l'exonération n'ont pas — et un champ rempli à tort finit sur la pièce.
        */}
        {regime === "assujetti_20" ? (
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="st-tva">
              N° TVA intracommunautaire
            </label>
            <input
              id="st-tva"
              className={inputCls}
              value={tva}
              onChange={(e) => setTva(e.target.value)}
              placeholder="FR..."
            />
          </div>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-[var(--space-admin-3)]">
        <legend className={labelCls}>Mandat de facturation (autofacturation)</legend>
        <p className="admin-muted">
          Sans mandat écrit et <strong>préalable</strong>, l&apos;organisme ne peut pas établir la
          facture au nom du sous-traitant : la pièce serait irrégulière et sa TVA non déductible. À
          défaut de mandat, c&apos;est le sous-traitant qui émet ses factures.
        </p>
        <div className="grid grid-cols-1 gap-[var(--space-admin-4)] sm:grid-cols-2">
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="st-mandat-signe">
              Signé le
            </label>
            <input
              id="st-mandat-signe"
              type="date"
              className={inputCls}
              value={signeAt}
              onChange={(e) => setSigneAt(e.target.value)}
            />
          </div>
          <div className={fieldCls}>
            <label className={labelCls} htmlFor="st-mandat-revoque">
              Révoqué le (si révocation)
            </label>
            <input
              id="st-mandat-revoque"
              type="date"
              className={inputCls}
              value={revoqueAt}
              onChange={(e) => setRevoqueAt(e.target.value)}
            />
          </div>
        </div>
        {/*
          🔑 On DIT l'état résultant plutôt que de laisser deux dates à
          interpréter. « Signé le 3, révoqué le 12 » demande au lecteur de
          calculer ; « plus en vigueur » se lit.
        */}
        <p
          className={
            etatMandat === "en_vigueur" ? "admin-muted" : "admin-alert admin-alert-warning"
          }
        >
          {etatMandat === "aucun"
            ? "Aucun mandat : le sous-traitant émet lui-même ses factures."
            : etatMandat === "en_vigueur"
              ? "Mandat en vigueur — l'organisme peut établir les factures d'honoraires en son nom."
              : "Une révocation est enregistrée. Les factures émises avant elle restent valables ; les suivantes reviennent au sous-traitant."}
        </p>
      </fieldset>

      {error !== null && (
        <div className="admin-alert admin-alert-error" role="alert">
          {error}
        </div>
      )}
      {ok !== null && (
        <div className="admin-alert admin-alert-success" role="status">
          {ok}
        </div>
      )}

      <div>
        <button type="submit" className="admin-button" disabled={isPending}>
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
