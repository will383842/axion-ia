"use client";
// use-client: formulaires à confirmer en deux temps, avec retour sans recharger.

// Lot 6 — « il a eu lieu » : l'outil propose un rendez-vous pour une entreprise réservée, le
// dirigeant valide ou écarte. Rien n'est validé automatiquement ; aucun texte n'est envoyé d'ici
// (l'annonce à l'apporteur est celle, existante, de l'attribution).

import { useActionState, useState } from "react";

import {
  ecarterPropositionAction,
  saisirRendezVousAction,
  validerPropositionAction,
  type EtatAction,
} from "@/features/apporteurs-reseau/actions-presentations";

const INITIAL: EtatAction = { etat: "initial" };

function Retour({ etat }: { etat: EtatAction }) {
  if (etat.etat === "initial") return null;
  return (
    <span
      role={etat.etat === "ok" ? "status" : "alert"}
      className={
        etat.etat === "ok"
          ? "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-success)]"
          : "text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-destructive)]"
      }
    >
      {etat.message}
    </span>
  );
}

/** Les deux boutons d'une proposition : « Il a eu lieu » (en deux temps) et « Ce n'est pas lui ». */
export function ActionsProposition({
  id,
  dateTenueConnue,
  aujourdhuiLocal,
  nonTenu = false,
}: {
  id: string;
  /** Annulé, reporté ou absent : seul « Ce n'est pas lui » est proposé. */
  nonTenu?: boolean;
  /** Faux : l'outil ne sait pas quand le rendez-vous a eu lieu, le dirigeant le dit. */
  dateTenueConnue: boolean;
  /** « AAAA-MM-JJThh:mm » à Paris, pour préremplir. */
  aujourdhuiLocal: string;
}) {
  const [eV, valider, vEnCours] = useActionState(validerPropositionAction, INITIAL);
  const [eE, ecarter, eEnCours] = useActionState(ecarterPropositionAction, INITIAL);
  const [demande, setDemande] = useState(false);
  const [demandeEcart, setDemandeEcart] = useState(false);
  if (eV.etat === "ok" || eE.etat === "ok") return <Retour etat={eV.etat === "ok" ? eV : eE} />;
  return (
    <div className="flex flex-col gap-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]">
      {nonTenu ? (
        <p>
          Ce rendez-vous a été annulé, reporté ou le client ne s&apos;est pas présenté : il ne
          valide pas l&apos;entreprise. S&apos;il a été annulé par Axion IA, il est réputé tenu :
          saisissez-le plus bas (« Annulé par Axion IA »). Sinon, écartez-le.
        </p>
      ) : (
        <form action={valider} className="flex flex-wrap items-end gap-[var(--space-admin-2)]">
          <input type="hidden" name="id" value={id} />
          {demande ? (
            <>
              <input type="hidden" name="confirmer" value="oui" />
              {dateTenueConnue ? null : (
                <label className="flex flex-col gap-1">
                  Il a eu lieu le
                  <input
                    type="datetime-local"
                    name="tenuLe"
                    required
                    defaultValue={aujourdhuiLocal}
                    className="admin-input"
                  />
                </label>
              )}
              <span>L&apos;entreprise sera attribuée à cet apporteur pour 6 mois.</span>
              <button type="submit" className="admin-button" disabled={vEnCours}>
                Oui, il a eu lieu
              </button>
              <button
                type="button"
                className="admin-button-secondary"
                disabled={vEnCours}
                onClick={() => setDemande(false)}
              >
                Annuler
              </button>
            </>
          ) : (
            <button type="button" className="admin-button" onClick={() => setDemande(true)}>
              Il a eu lieu
            </button>
          )}
        </form>
      )}
      <form action={ecarter} className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
        <input type="hidden" name="id" value={id} />
        {demandeEcart ? (
          <>
            <input type="hidden" name="confirmer" value="oui" />
            <span>
              Écarter retire seulement ce rendez-vous. Si une déclaration plus ancienne existe pour
              cette entreprise, elle reste retenue pour son apporteur jusqu&apos;à la fin de ses 30
              jours de protection. À faire seulement si l&apos;annulation ou l&apos;erreur ne vient
              pas d&apos;Axion IA.
            </span>
            <button type="submit" className="admin-button-secondary" disabled={eEnCours}>
              Oui, l&apos;écarter
            </button>
            <button
              type="button"
              className="admin-button-secondary"
              disabled={eEnCours}
              onClick={() => setDemandeEcart(false)}
            >
              Annuler
            </button>
          </>
        ) : (
          <button
            type="button"
            className="admin-button-secondary"
            onClick={() => setDemandeEcart(true)}
          >
            Ce n&apos;est pas lui
          </button>
        )}
      </form>
      <Retour etat={eV} />
      <Retour etat={eE} />
    </div>
  );
}

/** Saisie par le dirigeant d'un rendez-vous téléphonique, sur place, ou annulé par Axion IA. */
export function SaisirRendezVous({
  entreprises,
  aujourdhuiLocal,
}: {
  entreprises: ReadonlyArray<{ id: string; libelle: string }>;
  /** « AAAA-MM-JJThh:mm » à Paris : date et heure préremplies. */
  aujourdhuiLocal: string;
}) {
  const [etat, saisir, enCours] = useActionState(saisirRendezVousAction, INITIAL);
  const [demande, setDemande] = useState(false);
  if (entreprises.length === 0)
    return (
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Aucune entreprise n&apos;attend de rendez-vous.
      </p>
    );
  return (
    <form
      action={saisir}
      className="flex flex-wrap items-end gap-[var(--space-admin-3)] text-[length:var(--text-admin-sm)]"
    >
      <label className="flex flex-col gap-1">
        Entreprise
        <select name="presentationId" required className="admin-input" defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {entreprises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.libelle}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Type
        <select name="canal" required className="admin-input" defaultValue="telephone">
          <option value="telephone">Appel téléphonique</option>
          <option value="sur_place">Rendez-vous sur place</option>
          <option value="annule_par_axion">Annulé par Axion IA (réputé tenu)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        A eu lieu le (annulé par Axion IA : date à laquelle il était fixé)
        <input
          type="datetime-local"
          name="tenuLe"
          required
          defaultValue={aujourdhuiLocal}
          className="admin-input"
        />
      </label>
      <label className="flex flex-col gap-1">
        Pris (convenu) le
        <input type="datetime-local" name="prisLe" required className="admin-input" />
      </label>
      <p className="basis-full text-[color:var(--color-admin-fg-muted)]">
        Annulé par Axion IA : indiquez la date à laquelle le rendez-vous était fixé. Il est réputé
        avoir eu lieu à cette date ; une date à venir est refusée (il n&apos;a pas encore eu lieu).
      </p>
      {demande ? (
        <>
          <input type="hidden" name="confirmer" value="oui" />
          <span>L&apos;entreprise sera attribuée à cet apporteur pour 6 mois.</span>
          <button type="submit" className="admin-button" disabled={enCours}>
            Oui, enregistrer : il a eu lieu
          </button>
          <button
            type="button"
            className="admin-button-secondary"
            disabled={enCours}
            onClick={() => setDemande(false)}
          >
            Annuler
          </button>
        </>
      ) : (
        <button type="button" className="admin-button" onClick={() => setDemande(true)}>
          Enregistrer : il a eu lieu
        </button>
      )}
      <Retour etat={etat} />
    </form>
  );
}
