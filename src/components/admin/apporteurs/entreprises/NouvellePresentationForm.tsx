"use client";
// use-client: vérification du SIREN à la demande (registre + signalements), saisie contrôlée.

// « Nouvelle entreprise présentée » : saisie à la réception de l'e-mail de l'apporteur.
// Les signalements (déjà présentée, déjà cliente) ne sont qu'une indication.

import { useActionState, useState, useTransition } from "react";

import {
  creerPresentationAction,
  verifierSirenAction,
  type EtatAction,
  type VerificationSiren,
} from "@/features/apporteurs-reseau/actions-presentations";

const INITIAL: EtatAction = { etat: "initial" };
const CHAMP = "flex flex-col gap-1 text-[length:var(--text-admin-sm)]";

export function NouvellePresentationForm({
  apporteurs,
  maintenantLocal,
}: {
  apporteurs: ReadonlyArray<{ id: string; nom: string }>;
  /** Valeur par défaut du champ « reçu le », en heure de Paris. */
  maintenantLocal: string;
}) {
  const [etat, action, enCours] = useActionState(creerPresentationAction, INITIAL);
  const [siren, setSiren] = useState("");
  const [denomination, setDenomination] = useState("");
  const [verif, setVerif] = useState<VerificationSiren | null>(null);
  const [verifEnCours, lancer] = useTransition();

  function verifier(): void {
    lancer(async () => {
      const r = await verifierSirenAction(siren);
      setVerif(r);
      if (r.etat === "ok" && r.denomination && !denomination) setDenomination(r.denomination);
    });
  }

  if (apporteurs.length === 0) {
    return (
      <p className="text-[color:var(--color-admin-fg-muted)]">
        Aucun apporteur au contrat signé pour l&apos;instant.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-[var(--space-admin-3)]">
      <div className="grid gap-[var(--space-admin-3)] md:grid-cols-2">
        <label className={CHAMP}>
          Apporteur
          <select name="apporteurId" required className="admin-input" defaultValue="">
            <option value="" disabled>
              Choisir…
            </option>
            {apporteurs.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </select>
        </label>
        <label className={CHAMP}>
          E-mail reçu le (fait foi)
          <input type="datetime-local" name="recueAt" required defaultValue={maintenantLocal} className="admin-input" />
        </label>
        <div className={CHAMP}>
          <label htmlFor="np-siren">SIREN de l&apos;entreprise</label>
          <div className="flex gap-[var(--space-admin-2)]">
            <input
              id="np-siren"
              name="siren"
              required
              inputMode="numeric"
              value={siren}
              onChange={(e) => {
                setSiren(e.target.value);
                setVerif(null);
              }}
              className="admin-input flex-1"
            />
            <button type="button" className="admin-button-secondary" onClick={verifier} disabled={verifEnCours || !siren}>
              {verifEnCours ? "…" : "Vérifier"}
            </button>
          </div>
        </div>
        <label className={CHAMP}>
          Entreprise
          <input
            name="denomination"
            value={denomination}
            onChange={(e) => setDenomination(e.target.value)}
            className="admin-input"
            placeholder="Rempli par le registre"
          />
        </label>
      </div>

      {verif?.etat === "erreur" ? (
        <p role="alert" className="text-[color:var(--color-admin-destructive)]">
          {verif.message}
        </p>
      ) : null}
      {verif?.etat === "ok" ? (
        <div className="flex flex-wrap gap-[var(--space-admin-2)]">
          {verif.active === false ? <Pastille ton="alerte">Entreprise cessée au registre</Pastille> : null}
          {verif.signalements.length === 0 ? (
            <Pastille ton="ok">Rien de connu sur ce SIREN</Pastille>
          ) : (
            verif.signalements.map((s) => (
              <Pastille key={s} ton="alerte">
                {s}
              </Pastille>
            ))
          )}
        </div>
      ) : null}

      <div className="grid gap-[var(--space-admin-3)] md:grid-cols-2">
        <label className={CHAMP}>
          Personne présentée
          <input name="personneNom" required className="admin-input" placeholder="Prénom Nom" />
        </label>
        <label className={CHAMP}>
          Fonction
          <input name="personneFonction" maxLength={150} className="admin-input" />
        </label>
        <label className={CHAMP}>
          E-mail
          <input type="email" name="personneEmail" required className="admin-input" />
        </label>
        <label className={CHAMP}>
          Téléphone
          <input type="tel" name="personneTelephone" className="admin-input" />
        </label>
        <label className={CHAMP}>
          Date de leur échange
          <input type="date" name="dateEchange" className="admin-input" />
        </label>
        <label className={CHAMP}>
          Besoin
          <input name="besoin" className="admin-input" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-[var(--space-admin-3)]">
        <button type="submit" className="admin-button" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        {etat.etat !== "initial" ? (
          <span
            role={etat.etat === "ok" ? "status" : "alert"}
            className={
              etat.etat === "ok"
                ? "text-[color:var(--color-admin-success)]"
                : "text-[color:var(--color-admin-destructive)]"
            }
          >
            {etat.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Pastille({ ton, children }: { ton: "ok" | "alerte"; children: React.ReactNode }) {
  return (
    <span
      className={
        ton === "ok"
          ? "rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-success-soft)] px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success-fg)]"
          : "rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-warning-soft)] px-[var(--space-admin-3)] py-1 text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-warning-fg)]"
      }
    >
      {children}
    </span>
  );
}
