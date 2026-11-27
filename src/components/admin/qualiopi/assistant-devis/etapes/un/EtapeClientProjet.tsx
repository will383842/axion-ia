"use client";
// use-client: assemble des blocs contrôlés de l étape 1 et tient la liste des contacts créés.

/**
 * Étape 1 assemblée (fiche E10) : modèle, client, mots du client, lignes, aperçu en direct, et le
 * panneau « ce que le client a dit du projet » (`aide`, rendu par le serveur). Rien n'est
 * pré-rempli depuis le projet (décision du 29/09). L'aside a une largeur fixe (CLS = 0).
 */
import { useState, type Dispatch, type ReactNode } from "react";

import { ApercuDirect } from "../../ApercuDirect";
import type { ActionAssistant } from "../../etat";
import type { OffreCatalogue } from "../../lignes";
import type { EtatAssistant } from "../../types";
import { BlocClient, type ClientOption } from "./BlocClient";
import { BlocMotsDuClient } from "./BlocMotsDuClient";
import { ChoixModele } from "./ChoixModele";
import { ListeLignes } from "./ListeLignes";
import type { EntreeNouveauContact, ResultatNouveauContact } from "./NouveauContact";

export interface PropsEtapeClientProjet {
  etat: EtatAssistant;
  dispatch: Dispatch<ActionAssistant>;
  clients: readonly ClientOption[];
  offres: readonly OffreCatalogue[];
  tvaStandardPct: number;
  lireBandeau: (clientId: string) => Promise<string | null>;
  /** Absent (mode essai) : l'étape ne propose pas de créer un contact. */
  creerClient?: ((input: EntreeNouveauContact) => Promise<ResultatNouveauContact>) | undefined;
  /**
   * Si fourni, le PARENT tient la liste des contacts créés (`clients` les contient déjà) : ils
   * survivent à la sortie de l'étape et les étapes suivantes (envoi) les voient.
   */
  onClientCree?: ((c: ClientOption) => void) | undefined;
  aujourdhui?: string | undefined;
  aide?: ReactNode;
}

export function EtapeClientProjet(p: PropsEtapeClientProjet) {
  const { etat, dispatch } = p;
  const [crees, setCrees] = useState<ClientOption[]>([]);
  const clients = p.onClientCree ? p.clients : [...p.clients, ...crees];
  const client = clients.find((c) => c.id === etat.clientId);

  return (
    <div className="grid gap-[var(--space-admin-8,32px)] lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-[var(--space-admin-8,32px)]">
        <ChoixModele etat={etat} dispatch={dispatch} />
        <BlocClient
          etat={etat}
          dispatch={dispatch}
          clients={clients}
          lireBandeau={p.lireBandeau}
          creerClient={p.creerClient}
          aujourdhui={p.aujourdhui}
          onClientCree={(c) => {
            if (p.onClientCree) p.onClientCree(c);
            else setCrees((a) => [...a, c]);
          }}
        />
        <BlocMotsDuClient etat={etat} dispatch={dispatch} />
        <ListeLignes etat={etat} dispatch={dispatch} offres={p.offres} />
      </div>
      <div className="lg:sticky lg:top-4 lg:w-[22rem] lg:self-start">
        <ApercuDirect
          etat={etat}
          tvaStandardPct={p.tvaStandardPct}
          clientNom={client?.raisonSociale}
        />
        {p.aide ? <div className="mt-[var(--space-admin-6,16px)]">{p.aide}</div> : null}
      </div>
    </div>
  );
}
