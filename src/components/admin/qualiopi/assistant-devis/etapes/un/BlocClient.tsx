"use client";
// use-client: sélection du client, lecture asynchrone du bandeau et formulaire de création.

/**
 * Étape 1 — « Pour qui ? » (fiche E08). Client, encadré nominatif, Professionnel/Particulier
 * (lu sur la fiche, jamais saisi), intitulé, validité (J+7 à J+90, D8).
 * Aucun import serveur : la lecture du bandeau Partners et la création du contact sont des
 * actions INJECTÉES par la page (E17). Le bandeau garde le client auquel il se rapporte : le
 * texte d'un autre client ne s'affiche jamais.
 */
import { Building2, Mail, Plus, UserRound } from "lucide-react";
import { useEffect, useState, type Dispatch } from "react";

import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { AdminCard } from "@/components/admin/ui/AdminCard";

import { BandeauAttributionPartners } from "../../../BandeauAttributionPartners";
import { raisonPrixUniqueImpose, type ActionAssistant } from "../../etat";
import type { EtatAssistant } from "../../types";
import {
  NouveauContact,
  type EntreeNouveauContact,
  type ResultatNouveauContact,
} from "./NouveauContact";
import { CHAMP, ETIQUETTE, TITRE_BLOC } from "./styles";

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
  /** Absent (mode essai) : aucun contact ne se crée, seules les fiches fournies sont proposées. */
  creerClient?: ((input: EntreeNouveauContact) => Promise<ResultatNouveauContact>) | undefined;
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
    <AdminCard as="section" variant="informational">
      <div
        aria-labelledby="titre-client"
        role="group"
        className="flex flex-col gap-[var(--space-admin-6,16px)]"
      >
        <h3 id="titre-client" className={TITRE_BLOC}>
          Pour qui ?
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className={`${ETIQUETTE} min-w-[16rem] flex-1`}>
            Client
            <select
              className={`${CHAMP} font-normal`}
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
          {creerClient ? (
            <AdminButton
              variant="secondary"
              size="lg"
              icon={Plus}
              onClick={() => setCreation(true)}
              aria-expanded={creation}
              aria-label="+ Nouveau contact"
            >
              Nouveau contact
            </AdminButton>
          ) : null}
        </div>
        {creation && creerClient ? (
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
          <div
            role="group"
            aria-label="Destinataire du devis"
            className="rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper-alt)] p-4"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-admin-accent-track)] font-semibold"
              >
                {initialesDe(client.raisonSociale)}
              </span>
              <p className="m-0 min-w-0 text-[length:var(--text-admin-lg)] font-semibold">
                {client.raisonSociale}
              </p>
              <AdminBadge tone={client.type === "particulier" ? "warning" : "info"}>
                {client.type === "particulier" ? "Particulier" : "Professionnel"}
              </AdminBadge>
            </div>
            <div className="mt-3 flex flex-col gap-1">
              {client.contactNom ? (
                <p className="m-0 flex items-center gap-2">
                  <UserRound size={16} aria-hidden="true" className="shrink-0" />
                  {client.contactNom}
                </p>
              ) : null}
              {client.email ? (
                <p className="m-0 flex items-center gap-2">
                  <Mail size={16} aria-hidden="true" className="shrink-0" />
                  {client.email}
                </p>
              ) : null}
              {client.adresse ? (
                <p className="m-0 flex items-center gap-2">
                  <Building2 size={16} aria-hidden="true" className="shrink-0" />
                  {client.adresse}
                </p>
              ) : null}
            </div>
            {noteParticulier ? (
              <p
                role="note"
                className="mt-3 mb-0 rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-warning-soft)] p-3 text-[color:var(--color-admin-warning-fg)]"
              >
                {noteParticulier}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className={ETIQUETTE}>
            Intitulé du devis
            <input
              className={`${CHAMP} font-normal`}
              value={etat.intitule}
              onChange={(e) => dispatch({ type: "champs", patch: { intitule: e.target.value } })}
            />
          </label>
          <label className={ETIQUETTE}>
            Valable jusqu&apos;au
            <input
              type="date"
              className={`${CHAMP} font-normal`}
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
          <p
            id="erreur-validite"
            role="alert"
            className="m-0 rounded-[var(--radius-admin-md)] bg-[color:var(--color-admin-destructive-soft)] p-3 text-[color:var(--color-admin-destructive-fg)]"
          >
            La validité doit tomber entre {VALIDITE_MIN_JOURS} et {VALIDITE_MAX_JOURS} jours après
            aujourd&apos;hui.
          </p>
        ) : null}
      </div>
    </AdminCard>
  );
}

/** Deux initiales au plus (avatar décoratif). */
function initialesDe(nom: string): string {
  return nom
    .trim()
    .split(/\s+/)
    .filter((m) => m !== "")
    .slice(0, 2)
    .map((m) => m.charAt(0).toUpperCase())
    .join("");
}
