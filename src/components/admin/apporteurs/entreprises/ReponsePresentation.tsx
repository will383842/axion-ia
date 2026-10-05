"use client";
// use-client: aperçu des e-mails à la demande, puis envoi confirmé sans recharger.

// Les trois réponses à une entreprise présentée. Rien ne part avant « Envoyer » :
// l'aperçu montre les e-mails EXACTS (vrais gabarits). Changer la civilité efface l'aperçu.

import { useState, useTransition } from "react";

import {
  apercuReponseAction,
  repondreAction,
  type ApercuReponse,
  type EtatAction,
} from "@/features/apporteurs-reseau/actions-presentations";

import { EditeurTexte } from "../fiche/ApercuEmail";

type Reponse = "bien_recu" | "deja_connue" | "pas_disponible" | "hors_champ";

const LIBELLE: Record<Reponse, string> = {
  bien_recu: "✅ Bien reçu",
  deja_connue: "🔁 Déjà connue",
  pas_disponible: "⛔ Pas disponible",
  hors_champ: "🚫 Hors champ",
};

const CHOIX =
  "inline-flex min-h-[44px] items-center gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border px-[var(--space-admin-4)] font-medium";
const ACTIF =
  "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-accent)] text-[color:var(--color-admin-accent-fg)]";
const REPOS =
  "border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-paper)] text-[color:var(--color-admin-fg)]";

export function ReponsePresentation({
  id,
  nomFamilleSuggere,
}: {
  id: string;
  nomFamilleSuggere: string;
}) {
  const [choix, setChoix] = useState<Reponse | null>(null);
  const [civilite, setCivilite] = useState("");
  const [nomFamille, setNomFamille] = useState(nomFamilleSuggere);
  const [apercu, setApercu] = useState<ApercuReponse | null>(null);
  // Textes principaux réécrits, par gabarit (absent = texte d'origine) : aperçu ET envoi.
  const [textes, setTextes] = useState<Record<string, string>>({});
  const [retour, setRetour] = useState<EtatAction | null>(null);
  const [occupe, lancer] = useTransition();

  function choisir(r: Reponse): void {
    setChoix(r);
    setApercu(null);
    setTextes({});
    setRetour(null);
  }

  function actualiser(gabarit: string, t: string | null): void {
    if (!choix) return;
    const suivants = { ...textes };
    if (t === null) delete suivants[gabarit];
    else suivants[gabarit] = t;
    lancer(async () => {
      const r = await apercuReponseAction({
        id,
        reponse: choix,
        civilite,
        nomFamille,
        textes: suivants,
      });
      if (r.etat === "apercu") setTextes(suivants);
      setApercu(r);
    });
  }

  function voir(): void {
    if (!choix) return;
    lancer(async () =>
      setApercu(await apercuReponseAction({ id, reponse: choix, civilite, nomFamille })),
    );
  }

  function envoyer(): void {
    if (!choix) return;
    lancer(async () => {
      setRetour(
        await repondreAction({ id, reponse: choix, civilite, nomFamille, textes, confirmer: true }),
      );
      setApercu(null);
    });
  }

  if (retour?.etat === "ok") {
    return (
      <p role="status" className="text-[color:var(--color-admin-success)]">
        {retour.message}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)]">
      <div role="group" aria-label="Réponse" className="flex flex-wrap gap-[var(--space-admin-2)]">
        {(Object.keys(LIBELLE) as Reponse[]).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={choix === r}
            className={`${CHOIX} ${choix === r ? ACTIF : REPOS}`}
            onClick={() => choisir(r)}
            disabled={occupe}
          >
            {LIBELLE[r]}
          </button>
        ))}
      </div>

      {choix === "bien_recu" ? (
        <div className="flex flex-wrap items-end gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]">
          <label className="flex flex-col gap-1">
            Civilité
            <select
              value={civilite}
              onChange={(e) => {
                setCivilite(e.target.value);
                setApercu(null);
              }}
              className="admin-input"
            >
              <option value="">— (prénom)</option>
              <option value="Madame">Madame</option>
              <option value="Monsieur">Monsieur</option>
            </select>
          </label>
          {civilite ? (
            <label className="flex flex-col gap-1">
              Nom de famille
              <input
                value={nomFamille}
                onChange={(e) => {
                  setNomFamille(e.target.value);
                  setApercu(null);
                }}
                className="admin-input"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      {choix && apercu?.etat !== "apercu" ? (
        <div>
          <button type="button" className="admin-button-secondary" onClick={voir} disabled={occupe}>
            {occupe ? "Préparation…" : "Voir les e-mails avant envoi"}
          </button>
        </div>
      ) : null}

      {apercu?.etat === "erreur" ? (
        <p role="alert" className="text-[color:var(--color-admin-destructive)]">
          {apercu.message}
        </p>
      ) : null}
      {retour?.etat === "erreur" ? (
        <p role="alert" className="text-[color:var(--color-admin-destructive)]">
          {retour.message}
        </p>
      ) : null}

      {apercu?.etat === "apercu" ? (
        <section aria-label="Aperçu" className="flex flex-col gap-[var(--space-admin-3)]">
          {apercu.emails.map((e) => (
            <div
              key={e.destinataire + e.sujet}
              className="flex flex-col gap-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)]"
            >
              <p className="text-[length:var(--text-admin-sm)]">
                <span className="text-[color:var(--color-admin-fg-muted)]">À : </span>
                {e.destinataire}
                <br />
                <span className="text-[color:var(--color-admin-fg-muted)]">Objet : </span>
                <strong>{e.sujet}</strong>
              </p>
              <iframe
                title={`Aperçu : ${e.sujet}`}
                srcDoc={e.html}
                sandbox=""
                referrerPolicy="no-referrer"
                className="h-[50vh] w-full max-w-[680px] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-white"
              />
              {e.gabarit && e.texteDefaut !== undefined ? (
                <EditeurTexte
                  key={e.gabarit}
                  texteDefaut={e.texteDefaut}
                  texte={textes[e.gabarit] ?? null}
                  occupe={occupe}
                  onActualiser={(t) => actualiser(e.gabarit as string, t)}
                />
              ) : null}
            </div>
          ))}
          <div className="flex flex-wrap gap-[var(--space-admin-3)]">
            <button type="button" className="admin-button" onClick={envoyer} disabled={occupe}>
              {occupe
                ? "Envoi…"
                : apercu.emails.length > 1
                  ? `Envoyer les ${apercu.emails.length} e-mails`
                  : "Envoyer"}
            </button>
            <button
              type="button"
              className="admin-button-secondary"
              onClick={() => setApercu(null)}
              disabled={occupe}
            >
              Annuler
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
