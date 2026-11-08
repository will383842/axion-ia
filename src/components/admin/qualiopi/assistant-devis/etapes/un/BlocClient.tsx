"use client";
// use-client: sélection du client, lecture asynchrone du bandeau et formulaire de création.

/**
 * Étape 1 — « Pour qui ? » (fiche E08). Client, encadré nominatif, Professionnel/Particulier
 * (lu sur la fiche, jamais saisi), intitulé, validité (J+7 à J+90, D8).
 * Aucun import serveur : la lecture du bandeau Partners et la création du contact sont des
 * actions INJECTÉES par la page (E17). Le bandeau garde le client auquel il se rapporte : le
 * texte d'un autre client ne s'affiche jamais.
 */
import { useEffect, useState, type Dispatch } from "react";

import { BandeauAttributionPartners } from "../../../BandeauAttributionPartners";
import { raisonPrixUniqueImpose, type ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";
import {
  NouveauContact,
  type EntreeNouveauContact,
  type ResultatNouveauContact,
} from "./NouveauContact";

export interface ClientOption {
  id: string;
  numero: string;
  raisonSociale: string;
  type: "entreprise" | "particulier";
  adresse: string | null;
  contactNom: string | null;
  email: string | null;
}

export interface PropsBlocClient {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  clients: readonly ClientOption[];
  lireBandeau: (clientId: string) => Promise<string | null>;
  creerClient: (input: EntreeNouveauContact) => Promise<ResultatNouveauContact>;
  /** Date du jour ISO (AAAA-MM-JJ) fournie par la page serveur ; absente = bornes non posées. */
  aujourdhui?: string | undefined;
  /**
   * Si fourni, le parent tient la liste des contacts créés (et `clients` les contient déjà) ;
   * sinon le bloc garde lui-même les contacts créés pendant la saisie.
   */
  onClientCree?: ((c: ClientOption) => void) | undefined;
}

const JOUR_MS = 86_400_000;
const VALIDITE_MIN_JOURS = 7;
const VALIDITE_MAX_JOURS = 90;

function ajouterJours(iso: string, n: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + n * JOUR_MS;
  return new Date(t).toISOString().slice(0, 10);
}

export function BlocClient({
  etat,
  dispatch,
  clients,
  lireBandeau,
  creerClient,
  aujourdhui,
  onClientCree,
}: PropsBlocClient) {
  const [ajoutes, setAjoutes] = useState<ClientOption[]>([]);
  const [creation, setCreation] = useState(false);
  const [bandeau, setBandeau] = useState<{ clientId: string; texte: string | null } | null>(null);

  const tous = onClientCree ? clients : [...clients, ...ajoutes];
  const client = tous.find((c) => c.id === etat.clientId) ?? null;

  useEffect(() => {
    const id = etat.clientId;
    if (id === "") return;
    let actif = true;
    lireBandeau(id).then(
      (texte) => {
        if (actif) setBandeau({ clientId: id, texte });
      },
      () => {
        if (actif) setBandeau({ clientId: id, texte: null });
      },
    );
    return () => {
      actif = false;
    };
  }, [etat.clientId, lireBandeau]);

  const min = aujourdhui ? ajouterJours(aujourdhui, VALIDITE_MIN_JOURS) : null;
  const max = aujourdhui ? ajouterJours(aujourdhui, VALIDITE_MAX_JOURS) : null;
  const horsBornes = min !== null && max !== null && (etat.validite < min || etat.validite > max);
  const bandeauAffiche =
    bandeau !== null && bandeau.clientId === etat.clientId ? bandeau.texte : null;
  // La note du particulier est SA raison (interrupteur supposé allumé), pas la première trouvée :
  // sinon un interrupteur éteint afficherait « devis à formules non activés » sous un particulier.
  const noteParticulier =
    etat.clientType === "particulier"
      ? raisonPrixUniqueImpose({ ...etat, formulesActives: true })
      : null;

  return (
    <section aria-labelledby="titre-client" className="mb-[var(--space-admin-6,16px)]">
      <h3 id="titre-client" className="mb-[var(--space-admin-3,6px)]">
        Pour qui ?
      </h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[16rem] flex-col">
          Client
          <select
            className="min-h-[44px] rounded border px-2"
            value={etat.clientId}
            onChange={(e) => {
              const c = tous.find((x) => x.id === e.target.value);
              dispatch({ type: "client", id: e.target.value, clientType: c ? c.type : null });
            }}
          >
            <option value="">Choisir un client…</option>
            {tous.map((c) => (
              <option key={c.id} value={c.id}>
                {c.raisonSociale} ({c.numero})
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="min-h-[44px] rounded border px-4"
          onClick={() => setCreation(true)}
          aria-expanded={creation}
        >
          + Nouveau contact
        </button>
      </div>
      {creation ? (
        <NouveauContact
          creerClient={creerClient}
          onAnnuler={() => setCreation(false)}
          onCree={(c) => {
            if (onClientCree) onClientCree(c);
            else setAjoutes((a) => [...a, c]);
            setCreation(false);
            dispatch({ type: "client", id: c.id, clientType: c.type });
          }}
        />
      ) : null}
      <BandeauAttributionPartners texte={bandeauAffiche} />
      {client ? (
        <div role="group" aria-label="Destinataire du devis" className="mt-3 rounded border p-3">
          <p className="font-medium">{client.raisonSociale}</p>
          {client.adresse ? <p>{client.adresse}</p> : null}
          {client.contactNom ? <p>{client.contactNom}</p> : null}
          {client.email ? <p>{client.email}</p> : null}
          <p className="mt-1 text-[length:var(--text-admin-sm)]">
            {client.type === "particulier" ? "Particulier" : "Professionnel"}
          </p>
          {noteParticulier ? <p role="note">{noteParticulier}</p> : null}
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col">
          Intitulé du devis
          <input
            className="min-h-[44px] rounded border px-2"
            value={etat.intitule}
            onChange={(e) => dispatch({ type: "champs", patch: { intitule: e.target.value } })}
          />
        </label>
        <label className="flex flex-col">
          Valable jusqu&apos;au
          <input
            type="date"
            className="min-h-[44px] rounded border px-2"
            value={etat.validite}
            {...(min !== null ? { min } : {})}
            {...(max !== null ? { max } : {})}
            aria-invalid={horsBornes}
            aria-describedby={horsBornes ? "erreur-validite" : undefined}
            onChange={(e) => dispatch({ type: "champs", patch: { validite: e.target.value } })}
          />
        </label>
      </div>
      {horsBornes ? (
        <p id="erreur-validite" role="alert" className="mt-1">
          La validité doit tomber entre {VALIDITE_MIN_JOURS} et {VALIDITE_MAX_JOURS} jours après
          aujourd&apos;hui.
        </p>
      ) : null}
    </section>
  );
}
