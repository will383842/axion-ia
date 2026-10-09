"use client";
// use-client: lit les cases cochées du tableau, confirmation explicite et compte rendu sans recharger.

/**
 * ÉCRIRE AUX FUTURS APPORTEURS SÉLECTIONNÉS — le panneau de l'envoi groupé
 * (Candidatures unifiées L6b). Le pendant du `ComposeurEnMasse` emploi, réduit :
 *
 *   - un MODÈLE seulement (le texte est relu et personnalisé côté serveur ; on
 *     le montre ici tel qu'il partira, sans pouvoir le réécrire) ;
 *   - kit et présentation à joindre, chacun recevant SON lien ;
 *   - le nombre de destinataires dit AVANT, une case de confirmation qui
 *     retombe dès que la sélection, le modèle ou les fichiers changent ;
 *   - le compte rendu NOMME les exclus (opposés, « Sans suite ») et pourquoi.
 *
 * Il vit dans le même `<form>` que le tableau, dont il lit les cases `ids`.
 */

import { useEffect, useRef, useState, useTransition } from "react";

import { repondreEnMasseApporteursAction } from "@/features/admin-submissions/actions-reponse-en-masse-apporteurs";
import type {
  EtatReponseEnMasse,
  MotifEcart,
} from "@/features/admin-job-applications/reponse-en-masse";

export interface ModeleGroupeApporteur {
  readonly id: string;
  readonly libelle: string;
  readonly quand: string;
  readonly objet: string;
  readonly corps: string;
}

export interface FichierGroupeApporteur {
  readonly id: string;
  readonly titre: string;
  readonly libelleCategorie: string;
}

const PHRASE_MOTIF: Record<MotifEcart, string> = {
  variable_non_resolue: "prénom inconnu — à écrire à la main",
  destinataire_injoignable: "adresse absente ou illisible",
  ecriture_impossible: "échec technique — rien n'a été écrit",
  dossier_introuvable: "fiche introuvable",
  opposee: "exclue : s'est opposée aux sollicitations",
  sans_suite: "exclue : classée sans suite",
  non_retenue: "exclue",
  retiree: "exclue",
};

interface Props {
  /** Modèles proposables — SANS « Message libre » (filtré par le parent). */
  readonly modeles: ReadonlyArray<ModeleGroupeApporteur>;
  readonly plafond: number;
  /** Kit et présentation ; `null` : bibliothèque éteinte. */
  readonly fichiers: ReadonlyArray<FichierGroupeApporteur> | null;
}

export function ComposeurEnMasseApporteurs({
  modeles,
  plafond,
  fichiers,
}: Props): React.ReactElement {
  const ref = useRef<HTMLDetailsElement>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [modele, setModele] = useState(modeles[0]?.id ?? "");
  const [joints, setJoints] = useState<string[]>([]);
  const [confirmePour, setConfirmePour] = useState<string | null>(null);
  const [etat, setEtat] = useState<EtatReponseEnMasse | null>(null);
  const [enCours, demarrer] = useTransition();

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const lire = (): void =>
      setIds(
        [...form.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked')].map(
          (i) => i.value,
        ),
      );
    lire();
    form.addEventListener("change", lire);
    return () => form.removeEventListener("change", lire);
  }, []);

  const empreinte = `${ids.join(",")}|${modele}|${joints.join(",")}`;
  const confirme = confirmePour === empreinte;
  const choisi = modeles.find((m) => m.id === modele);
  const envoiPossible = ids.length > 0 && !!choisi && confirme && !enCours;

  function envoyer(): void {
    demarrer(async () => {
      const r = await repondreEnMasseApporteursAction({
        ids,
        modele: modele as never,
        fichierIds: joints,
      });
      setEtat(r);
      setConfirmePour(null);
    });
  }

  return (
    <details ref={ref} className="mt-[var(--space-admin-4)]">
      <summary className="admin-label cursor-pointer">Écrire à la sélection</summary>
      <div className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-3)]">
        <p
          className={
            ids.length > 0 ? "admin-alert admin-alert-warning" : "admin-alert admin-alert-error"
          }
          role="status"
        >
          {ids.length > 0
            ? `${ids.length} personne${ids.length > 1 ? "s" : ""} sélectionnée${ids.length > 1 ? "s" : ""}.`
            : "Aucune personne cochée — rien ne partira."}
        </p>
        <p className="admin-meta-small">
          Un message par personne, à partir d’un modèle relu. Au plus {plafond} destinataires.
        </p>
        <div className="admin-field">
          <label htmlFor="groupe-app-modele" className="admin-label">
            Modèle
          </label>
          <select
            id="groupe-app-modele"
            className="admin-input"
            value={modele}
            onChange={(e) => setModele(e.target.value)}
          >
            {modeles.map((m) => (
              <option key={m.id} value={m.id}>
                {m.libelle}
              </option>
            ))}
          </select>
          <p className="admin-meta-small">{choisi?.quand}</p>
        </div>
        {choisi ? (
          <div className="admin-card-inset">
            <p className="admin-meta-small">Objet : {choisi.objet}</p>
            <p className="text-sm whitespace-pre-line">{choisi.corps}</p>
          </div>
        ) : null}
        {fichiers ? (
          <fieldset className="admin-field">
            <legend className="admin-label">Joindre</legend>
            {fichiers.length === 0 ? (
              <p className="admin-meta-small">Aucun kit ni présentation dans la bibliothèque.</p>
            ) : (
              <ul className="grid gap-[var(--space-admin-2)]">
                {fichiers.map((f) => (
                  <li key={f.id}>
                    <label className="admin-checkbox">
                      <input
                        type="checkbox"
                        checked={joints.includes(f.id)}
                        onChange={(e) =>
                          setJoints((l) =>
                            e.target.checked ? [...l, f.id] : l.filter((x) => x !== f.id),
                          )
                        }
                      />
                      <span>
                        {f.titre} <span className="admin-meta-small">· {f.libelleCategorie}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="admin-meta-small">Chaque personne reçoit son propre lien privé.</p>
          </fieldset>
        ) : null}
        <label className="admin-checkbox-label" htmlFor="groupe-app-confirmer">
          <input
            id="groupe-app-confirmer"
            type="checkbox"
            checked={confirme}
            disabled={ids.length === 0}
            onChange={(e) => setConfirmePour(e.target.checked ? empreinte : null)}
          />{" "}
          Je confirme l’envoi à {ids.length > 0 ? `ces ${ids.length} personnes` : "la sélection"}.
        </label>
        <div>
          <button
            type="button"
            className="admin-button"
            disabled={!envoiPossible}
            onClick={envoyer}
          >
            {enCours ? "Envoi…" : "Envoyer à la sélection"}
          </button>
        </div>
        {etat && !etat.ok ? (
          <p className="admin-alert admin-alert-error" role="alert">
            {etat.error}
          </p>
        ) : etat && etat.ok ? (
          <div className="admin-alert admin-alert-success" role="status">
            <p>
              {etat.envoyees} message{etat.envoyees > 1 ? "s" : ""} envoyé
              {etat.envoyees > 1 ? "s" : ""}
              {etat.ecartees > 0 ? ` · ${etat.ecartees} écarté${etat.ecartees > 1 ? "s" : ""}` : ""}
              {etat.echouees > 0 ? ` · ${etat.echouees} en échec d’envoi` : ""}.
            </p>
            {etat.details.length > 0 ? (
              <ul className="mt-[var(--space-admin-2)]">
                {etat.details.map((d) => (
                  <li key={d.id} className="admin-meta-small">
                    {d.nom ? <strong>{d.nom}</strong> : <code>{d.id.slice(0, 8)}</code>} —{" "}
                    {PHRASE_MOTIF[d.motif]}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </details>
  );
}
