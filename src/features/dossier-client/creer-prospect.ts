/**
 * « Créer la fiche prospect depuis ce rendez-vous » (chantier visio, PR 4 ;
 * plan §3.13 point 1, V-06, vérification V5-C3).
 *
 * Un prospect inconnu a pris un rendez-vous : aucune fiche ne lui ressemble,
 * la rencontre est « à classer ». Un clic crée sa fiche — PAR LA PORTE UNIQUE
 * `creerOuRetrouverClient` (anti-doublon B18 : même SIREN = refus, même
 * adresse = motif exigé) — et, DANS LA MÊME TRANSACTION :
 *   · la personne du titulaire Calendly et son adresse, contact de
 *     facturation de la fiche (`definirContactFacturation`, par la porte) ;
 *   · le rangement de la rencontre chez elle (`validerRattachement`), qui
 *     relie le participant à sa personne ;
 *   · la trace de ce qui a été proposé et retenu (`PreRemplissage`, cible
 *     `client`) : raison sociale, ville, SIREN.
 * Une erreur n'importe où : rien n'est créé.
 *
 * Le SIREN n'est jamais posé en silence : il est PROPOSÉ par l'annuaire public
 * (`recherche-entreprises.ts`) à l'affichage, et n'arrive ici que si Will l'a
 * CONFIRMÉ d'un clic. Annuaire en panne : la fiche se crée sans SIREN,
 * « SIREN à compléter ».
 *
 * ⛔ `notes`, `contexteIa`, `besoinsIdentifies` ne sont JAMAIS écrits : ce que
 * le client a dit va dans des faits, effaçables un par un.
 *
 * Écrivain de `Client` : il passe par la porte (cliquet
 * `aucun-ecrivain-de-client-hors-de-la-porte-unique`), qui est aussi le point
 * où Axion Partners branchera son émission (INT-T03).
 */

import { chiffrerParole } from "@/lib/chiffrer-parole";
import {
  creerOuRetrouverClient,
  type DonneesFiche,
  type FicheProche,
} from "@/server/qualiopi/crm/porte-client";
import { dansLaTransaction, type BaseTransactionnelle, type Tx } from "./base";
import { entrepriseDeclaree } from "./rencontre-calendly";
import { validerRattachement } from "./rattacher";

export interface EntreeCreerProspect {
  readonly rencontreId: string;
  /** Raison sociale (proposée depuis Calendly, modifiable). */
  readonly raisonSociale: string;
  readonly type?: "entreprise" | "particulier";
  readonly ville?: string | null;
  /** SIREN CONFIRMÉ par Will (jamais une proposition non cochée). */
  readonly sirenConfirme?: string | null;
  readonly motifCreationForcee?: string | null;
  readonly parAdminId: string;
}

export type ResultatCreerProspect =
  | { readonly statut: "cree"; readonly clientId: string; readonly numero: string }
  | { readonly statut: "refuse_siren"; readonly fiche: FicheProche; readonly message: string }
  | {
      readonly statut: "motif_requis";
      readonly proches: ReadonlyArray<FicheProche>;
      readonly message: string;
    };

export class ErreurCreerProspect extends Error {}

/** Ce que la fiche reçoit — et RIEN d'autre. PUR. */
export function donneesDeLaFicheProspect(e: EntreeCreerProspect): DonneesFiche {
  const raisonSociale = e.raisonSociale.trim().slice(0, 250);
  if (raisonSociale === "") throw new ErreurCreerProspect("Donnez un nom à la fiche.");
  const ville = (e.ville ?? "").trim();
  const siren = (e.sirenConfirme ?? "").replace(/\D/g, "");
  return {
    type: e.type ?? "entreprise",
    raisonSociale,
    ...(ville !== "" ? { adresseVille: ville.slice(0, 120) } : {}),
    ...(siren !== "" ? { siren } : {}),
    source: "rendez-vous",
  };
}

async function tracerProposition(
  tx: Tx,
  clientId: string,
  champ: "client_raison_sociale" | "client_ville" | "client_siren",
  propose: string | null,
  retenu: string | null,
  parAdminId: string,
): Promise<void> {
  if (propose === null || propose.trim() === "") return;
  await tx.preRemplissage.create({
    data: {
      cible: "client",
      cibleId: clientId,
      champ,
      valeurProposee: chiffrerParole(JSON.stringify(propose)),
      valeurRetenue: retenu === null ? null : chiffrerParole(JSON.stringify(retenu)),
      sort: retenu === null ? "retire" : retenu === propose ? "garde" : "modifie",
      parAdminId,
    },
  });
}

/** Crée la fiche et range la rencontre. Voir l'en-tête. */
export async function creerProspectDepuisRencontre(
  db: BaseTransactionnelle,
  e: EntreeCreerProspect,
  propositions: { readonly sirenPropose?: string | null } = {},
): Promise<ResultatCreerProspect> {
  const donnees = donneesDeLaFicheProspect(e);
  return db.$transaction(async (tx): Promise<ResultatCreerProspect> => {
    const r = await tx.rencontre.findUnique({
      where: { id: e.rencontreId },
      select: { id: true, clientId: true, rattachementStatut: true, calendlyEventId: true },
    });
    if (r === null) throw new ErreurCreerProspect("Rendez-vous introuvable.");
    if (r.clientId !== null) {
      throw new ErreurCreerProspect("Ce rendez-vous est déjà rangé chez un client.");
    }

    // Le titulaire Calendly : la seule adresse connue en clair est celle de la réservation.
    const ev = r.calendlyEventId
      ? await tx.calendlyEvent.findUnique({
          where: { id: r.calendlyEventId },
          select: { inviteeName: true, inviteeEmail: true, rawPayload: true },
        })
      : null;

    const cree = await creerOuRetrouverClient(
      dansLaTransaction(tx),
      donnees,
      ev && (ev.inviteeName || ev.inviteeEmail)
        ? {
            ...(ev.inviteeName ? { nom: ev.inviteeName } : {}),
            ...(ev.inviteeEmail ? { email: ev.inviteeEmail } : {}),
          }
        : null,
      {
        parAdminId: e.parAdminId,
        motifCreationForcee: e.motifCreationForcee ?? null,
        origineContact: ev ? "calendly" : "saisie",
      },
    );
    if (cree.statut !== "cree") return cree;

    const declare = ev ? entrepriseDeclaree(ev.rawPayload) : { nom: null, ville: null };
    await tracerProposition(
      tx,
      cree.id,
      "client_raison_sociale",
      declare.nom,
      donnees.raisonSociale,
      e.parAdminId,
    );
    await tracerProposition(
      tx,
      cree.id,
      "client_ville",
      declare.ville,
      donnees.adresseVille ?? null,
      e.parAdminId,
    );
    await tracerProposition(
      tx,
      cree.id,
      "client_siren",
      propositions.sirenPropose ?? null,
      donnees.siren ?? null,
      e.parAdminId,
    );

    await validerRattachement(tx, {
      rencontreId: e.rencontreId,
      clientId: cree.id,
      parAdminId: e.parAdminId,
    });
    return { statut: "cree", clientId: cree.id, numero: cree.numero };
  });
}
