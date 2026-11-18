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
  creerClient: (input: EntreeNouveauContact) => Promise<ResultatNouveauContact>;
  aujourdhui?: string | undefined;
  aide?: ReactNode;
}

export function EtapeClientProjet(p: PropsEtapeClientProjet) {
  const { etat, dispatch } = p;
  const [crees, setCrees] = useState<ClientOption[]>([]);
  const clients = [...p.clients, ...crees];
  const client = clients.find((c) => c.id === etat.clientId);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div>
        <ChoixModele etat={etat} dispatch={dispatch} />
        <BlocClient
          etat={etat}
          dispatch={dispatch}
          clients={clients}
          lireBandeau={p.lireBandeau}
          creerClient={p.creerClient}
          aujourdhui={p.aujourdhui}
          onClientCree={(c) => setCrees((a) => [...a, c])}
        />
        <BlocMotsDuClient etat={etat} dispatch={dispatch} />
        <ListeLignes etat={etat} dispatch={dispatch} offres={p.offres} />
      </div>
      <div className="lg:sticky lg:top-4 lg:self-start">
        <ApercuDirect
          etat={etat}
          tvaStandardPct={p.tvaStandardPct}
          clientNom={client?.raisonSociale}
        />
        {p.aide ? <div className="mt-4">{p.aide}</div> : null}
      </div>
    </div>
  );
}
