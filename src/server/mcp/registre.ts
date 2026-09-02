/**
 * **LE REGISTRE DES OUTILS SERVIS** — la seule liste, et ce qu'on en publie.
 *
 * SEPT outils, tous en lecture (cahier des charges, § 28) : cinq agrégateurs
 * du produit — l'agenda comptant pour deux fenêtres — plus l'API GitHub.
 *
 *   axionia.inbox.recent          admin-inbox            (session extraite au lot 4a)
 *   axionia.agenda.jour · semaine admin-agenda           (prêt en l'état)
 *   axionia.rendezvous.list       admin-rendezvous
 *   axionia.pilotage.alertes      admin-planning/hub
 *   axionia.qualiopi.conformite   listAlertes(), pas l'évaluateur
 *   axionia.deploiement.etat      API GitHub Actions seule (W-9, défaut)
 *
 * `agenda.poser` et `message.repondre` sont des EFFETS — lot 7, avec
 * l'idempotence câblée à `ctx`.
 */

import { z } from "zod/v4";

import { nomComplet, type OutilQuelconque } from "./contrat";
import { agendaJour, agendaSemaine } from "./outils/agenda";
import { deploiementEtat } from "./outils/deploiement-etat";
import { inboxRecent } from "./outils/inbox-recent";
import { pilotageAlertes } from "./outils/pilotage-alertes";
import { qualiopiConformite } from "./outils/qualiopi-conformite";
import { rendezVousList } from "./outils/rendezvous-list";

export const OUTILS: readonly OutilQuelconque[] = [
  inboxRecent,
  agendaJour,
  agendaSemaine,
  rendezVousList,
  pilotageAlertes,
  qualiopiConformite,
  deploiementEtat,
];

export function trouverOutil(nom: string): OutilQuelconque | null {
  return OUTILS.find((outil) => nomComplet(outil.name) === nom) ?? null;
}

/** Ce que `tools/list` publie — la forme MCP (révision 2025-06-18). */
export interface OutilPublie {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: unknown;
  readonly outputSchema: unknown;
  readonly annotations: {
    readonly readOnlyHint: boolean;
    readonly destructiveHint: boolean;
    readonly idempotentHint: boolean;
    readonly openWorldHint: boolean;
  };
}

export function outilsPublies(): readonly OutilPublie[] {
  return OUTILS.map((outil) => ({
    name: nomComplet(outil.name),
    title: `${nomComplet(outil.name)} v${outil.version}`,
    description: outil.description,
    inputSchema: z.toJSONSchema(outil.input, { io: "input" }),
    outputSchema: z.toJSONSchema(outil.output, { io: "output" }),
    annotations: {
      readOnlyHint: outil.effect === "read",
      destructiveHint: outil.effect === "destructive",
      idempotentHint: outil.effect === "read" || outil.idempotency === "key",
      openWorldHint: false,
    },
  }));
}
