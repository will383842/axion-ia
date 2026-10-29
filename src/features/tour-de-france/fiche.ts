/**
 * Tour France IA : une demande et la fiche prospect de la console (PR-2a).
 *
 * C'est le SEUL module de ce dossier qui touche une fiche `Client`. Règle de fer : une demande
 * PUBLIQUE n'écrit JAMAIS sur une fiche existante. N'importe qui peut taper l'adresse d'un client
 * dans le formulaire : si la demande remplissait la fiche toute seule, un inconnu pourrait y
 * injecter un nom ou un numéro. Donc, dans l'ordre :
 *
 *   1. À l'envoi (`rattacherDemande`) on CHERCHE les fiches qui ressemblent à la personne, par la
 *      PORTE UNIQUE (`src/server/qualiopi/crm/porte-client.ts` : même e-mail, même fin d'adresse
 *      professionnelle, même nom dans la même ville) et par le téléphone (les 9 derniers chiffres).
 *      On n'ÉCRIT que sur la demande : « à arbitrer » avec la liste des fiches proches et le signal
 *      de chacune (même e-mail, même téléphone…), ou « sans fiche ». Aucune fiche n'est touchée.
 *   2. Un humain tranche dans la console. « Compléter la fiche » (`completerFicheDepuisDemande`) :
 *      sur une fiche proche de la demande, il remplit seulement ce qui est VIDE (la ville du
 *      référentiel ; la personne si elle manque ; une personne déjà connue n'est jamais modifiée),
 *      jamais le statut, la source, la raison sociale ni le SIREN, et laisse une trace
 *      « Demande Tour France IA, ville X ». La ville saisie en texte libre n'est JAMAIS écrite sur
 *      une fiche : seulement le nom du référentiel des villes.
 *   3. Aucune fiche : pas de création automatique (les quatre champs ne donnent pas l'entreprise,
 *      or une fiche exige une raison sociale). Le bouton « Créer la fiche prospect »
 *      (`creerFicheDepuisDemande`) passe par la porte unique, avec une raison sociale tapée par
 *      l'équipe.
 *
 * Une demande effacée à la demande de la personne ou écartée par l'équipe n'écrit rien nulle part.
 * Aucune fiche n'est supprimée ni fusionnée ici. Les colonnes `contact*` de la fiche ne sont
 * JAMAIS écrites directement (seule `definirContactFacturation` le fait) : une personne se
 * rattache par `ajouterPersonneAFiche`.
 *
 * ⛔ Cliquet `aucun-ecrivain-de-client-hors-de-la-porte-unique` : aucun `client.create` ici, aucune
 * écriture de `siren`. Cliquet des écrivains : la mise à jour de la fiche et l'émission vers
 * Axion Partners (`emettreFaitClient`) sont dans la même transaction.
 */

import { dansLaTransaction, type Tx } from "@/features/dossier-client/base";
import { fichesAuMemeTelephone } from "@/features/dossier-client/fiche-auto";
import { reessayerSiInterblocage } from "@/features/questionnaire-preaudit/interblocage";
import { prisma } from "@/lib/prisma";
import { chargeClientAvant, emettreFaitClient } from "@/server/partners-sync/producteurs/client";
import {
  ajouterPersonneAFiche,
  chargerFichesCandidates,
  creerOuRetrouverClient,
  preparerCandidat,
  trouverFichesProches,
  type FicheProche,
} from "@/server/qualiopi/crm/porte-client";
import { dechiffrerChamp } from "./chiffrement";
import {
  LONGUEUR_MAX_MOTIF,
  MESSAGE_DEMANDE_ECARTEE,
  MESSAGE_DEMANDE_EFFACEE,
  MESSAGE_DEMANDE_INTROUVABLE,
} from "./messages";
import {
  lireFichesProches,
  versRattachement,
  type FicheProcheStockee,
  type Rattachement,
} from "./types";

/** Trace posée sur une fiche COMPLÉTÉE à la main depuis une demande. */
export const ACTION_DEMANDE_SUR_FICHE = "client.demande_tour_france_ia";

/** Trace posée sur une fiche CRÉÉE depuis une demande. */
export const ACTION_FICHE_CREEE_DEPUIS_DEMANDE = "client.cree_depuis_demande_tour";

/** La source écrite sur une fiche créée depuis une demande. */
export const SOURCE_FICHE_TOUR = "Tour France IA";

// ─────────────────────────────────────────────────────────────────────────────
// Parties PURES
// ─────────────────────────────────────────────────────────────────────────────

export interface FicheAuMemeTelephone {
  readonly id: string;
  readonly numero: string;
  readonly raisonSociale: string;
}

/**
 * Les fiches proches de la demande : celles de la porte unique, plus les fiches au même téléphone
 * que la porte ne voit pas. Une fiche n'apparaît qu'une fois, avec son signal le plus fort. PUR.
 */
export function fusionnerProches(
  proches: ReadonlyArray<FicheProche>,
  auMemeTelephone: ReadonlyArray<FicheAuMemeTelephone>,
): FicheProcheStockee[] {
  const liste: FicheProcheStockee[] = proches.map((p) => ({
    ficheId: p.ficheId,
    numero: p.numero,
    raisonSociale: p.raisonSociale,
    signal: p.signal,
  }));
  const deja = new Set(liste.map((p) => p.ficheId));
  for (const f of auMemeTelephone) {
    if (deja.has(f.id)) continue;
    deja.add(f.id);
    liste.push({
      ficheId: f.id,
      numero: f.numero,
      raisonSociale: f.raisonSociale,
      signal: "telephone",
    });
  }
  return liste;
}

export type DecisionRattachement =
  | { readonly issue: "arbitrer"; readonly proches: ReadonlyArray<FicheProcheStockee> }
  | { readonly issue: "aucune" };

/**
 * Que faire de la demande ? Toute fiche proche, même reconnue à l'adresse e-mail et à rien d'autre :
 * on arbitre, SANS rien écrire sur une fiche (la demande est publique, l'adresse peut être celle de
 * quelqu'un d'autre). Aucune fiche proche : pas de fiche. PUR.
 */
export function decider(proches: ReadonlyArray<FicheProcheStockee>): DecisionRattachement {
  return proches.length === 0 ? { issue: "aucune" } : { issue: "arbitrer", proches };
}

/**
 * Les champs de la fiche que la demande peut remplir : seulement ce qui est VIDE, et seulement avec
 * le nom de la ville du RÉFÉRENTIEL (`villeNom`), jamais le texte libre tapé par la personne. PUR.
 */
export function champsACompleter(
  fiche: { readonly adresseVille: string | null },
  villeNom: string | null,
): { adresseVille?: string } {
  const propre = (villeNom ?? "").trim().slice(0, 120);
  const vide = fiche.adresseVille === null || fiche.adresseVille.trim() === "";
  return vide && propre !== "" ? { adresseVille: propre } : {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Lecture de la demande
// ─────────────────────────────────────────────────────────────────────────────

interface DemandeClaire {
  readonly id: string;
  readonly nom: string;
  readonly email: string;
  readonly telephone: string;
  /** Le nom du référentiel, sinon la ville telle que tapée (pour comparer et pour la trace). */
  readonly ville: string;
  /** Le nom du référentiel : la SEULE ville qui peut être écrite sur une fiche. */
  readonly villeNom: string | null;
  readonly statut: string;
  readonly depuis: string | null;
  readonly utm: Readonly<Record<string, string>>;
  readonly rattachement: Rattachement;
  readonly clientId: string | null;
  readonly fichesProches: ReadonlyArray<FicheProcheStockee>;
}

/** La ville d'une trace posée sur une fiche : le référentiel, jamais le texte libre tapé. */
const VILLE_HORS_REFERENTIEL = "ville hors référentiel";
function villeTrace(d: { readonly villeNom: string | null }): string {
  return d.villeNom ?? VILLE_HORS_REFERENTIEL;
}

async function lireDemandeClaire(demandeId: string): Promise<DemandeClaire | null> {
  const d = await prisma.tourDemande.findUnique({
    where: { id: demandeId },
    select: {
      id: true,
      nom: true,
      email: true,
      telephone: true,
      villeSaisie: true,
      villeNom: true,
      statut: true,
      depuis: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmContent: true,
      rattachement: true,
      clientId: true,
      fichesProches: true,
    },
  });
  if (d === null) return null;
  const utm: Record<string, string> = {};
  if (d.utmSource !== null) utm["source"] = d.utmSource;
  if (d.utmMedium !== null) utm["medium"] = d.utmMedium;
  if (d.utmCampaign !== null) utm["campaign"] = d.utmCampaign;
  if (d.utmContent !== null) utm["content"] = d.utmContent;
  return {
    id: d.id,
    nom: dechiffrerChamp("nom", d.nom),
    email: dechiffrerChamp("email", d.email),
    telephone: dechiffrerChamp("telephone", d.telephone),
    ville: d.villeNom ?? d.villeSaisie,
    villeNom: d.villeNom,
    statut: d.statut,
    depuis: d.depuis,
    utm,
    rattachement: versRattachement(d.rattachement),
    clientId: d.clientId,
    fichesProches: lireFichesProches(d.fichesProches),
  };
}

/** Le verrou de la ligne de la demande, relue dans la transaction (statut et fiche à jour). */
async function verrouillerDemande(
  tx: Tx,
  demandeId: string,
): Promise<{ readonly statut: string; readonly clientId: string | null } | null> {
  const lignes = await tx.$queryRaw<Array<{ statut: string; client_id: string | null }>>`
    SELECT statut, client_id FROM tour_demandes WHERE id = ${demandeId}::uuid FOR UPDATE`;
  const ligne = lignes[0];
  return ligne === undefined ? null : { statut: ligne.statut, clientId: ligne.client_id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chercher les fiches proches (à l'envoi) — n'écrit que sur la demande
// ─────────────────────────────────────────────────────────────────────────────

export interface ResultatRattachement {
  readonly rattachement: Rattachement;
  readonly clientId: string | null;
}

/** Les fiches VIVANTES (non absorbées par une fusion) parmi ces identifiants. */
async function fichesVivantes(ids: ReadonlyArray<string>): Promise<FicheAuMemeTelephone[]> {
  if (ids.length === 0) return [];
  return prisma.client.findMany({
    where: { id: { in: [...ids] }, fusionsAbsorbee: { none: { defaiteLe: null } } },
    select: { id: true, numero: true, raisonSociale: true },
    orderBy: { numero: "asc" },
  });
}

/**
 * Pose le rattachement SEULEMENT si la demande est encore « à vérifier » et pas effacée : un
 * effacement ou un geste d'humain survenu depuis la lecture n'est jamais défait. Sinon, relit et
 * rend l'état courant.
 */
async function rangerDemande(
  d: DemandeClaire,
  data: { rattachement: "a_arbitrer" | "sans_fiche"; fichesProches?: FicheProcheStockee[] },
): Promise<ResultatRattachement> {
  const { count } = await prisma.tourDemande.updateMany({
    where: { id: d.id, rattachement: "a_verifier", statut: { not: "effacee_rgpd" } },
    data,
  });
  if (count === 1) return { rattachement: data.rattachement, clientId: null };
  const courante = await lireDemandeClaire(d.id);
  if (courante === null) throw new Error(`demande du Tour introuvable : ${d.id}`);
  return { rattachement: courante.rattachement, clientId: courante.clientId };
}

/**
 * Cherche les fiches proches de la personne et range la demande « à arbitrer » ou « sans fiche ».
 * Voir l'en-tête : AUCUNE fiche n'est écrite. Idempotente : une demande déjà rangée est rendue
 * telle quelle, de même qu'une demande effacée à la demande de la personne.
 */
export async function rattacherDemande(demandeId: string): Promise<ResultatRattachement> {
  const d = await lireDemandeClaire(demandeId);
  if (d === null) throw new Error(`demande du Tour introuvable : ${demandeId}`);
  if (d.rattachement !== "a_verifier" || d.statut === "effacee_rgpd") {
    return { rattachement: d.rattachement, clientId: d.clientId };
  }

  // La personne est comparée aux fiches par son nom (une fiche « particulier » porte « Prénom Nom »).
  const candidat = preparerCandidat({ raisonSociale: d.nom, emails: [d.email], ville: d.ville });
  const proches = trouverFichesProches(candidat, await chargerFichesCandidates(prisma, candidat));
  const idsTelephone = (await fichesAuMemeTelephone(prisma, d.telephone)).filter(
    (id) => !proches.some((p) => p.ficheId === id),
  );
  const liste = fusionnerProches(proches, await fichesVivantes(idsTelephone));
  const decision = decider(liste);

  if (decision.issue === "arbitrer") {
    return rangerDemande(d, { rattachement: "a_arbitrer", fichesProches: [...decision.proches] });
  }

  return rangerDemande(d, { rattachement: "sans_fiche" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Compléter une fiche proche (bouton de la console)
// ─────────────────────────────────────────────────────────────────────────────

export type RaisonRefusCompletion =
  "introuvable" | "efface" | "ecartee" | "fiche_non_proche" | "fiche_disparue";

export type ResultatCompletion =
  | { readonly statut: "completee"; readonly clientId: string }
  | { readonly statut: "deja_rattachee"; readonly clientId: string | null }
  | { readonly statut: "refuse"; readonly raison: RaisonRefusCompletion };

/**
 * « Compléter la fiche » : à la demande d'un humain, sur UNE fiche proche de la demande (une fiche
 * qui n'est pas dans la liste de la demande est refusée). Remplit seulement ce qui est vide, dans
 * une transaction qui verrouille la demande puis la fiche. Voir l'en-tête.
 */
export async function completerFicheDepuisDemande(
  demandeId: string,
  ficheId: string,
  acteurId: string | null,
): Promise<ResultatCompletion> {
  const d = await lireDemandeClaire(demandeId);
  if (d === null) return { statut: "refuse", raison: "introuvable" };
  if (d.statut === "effacee_rgpd") return { statut: "refuse", raison: "efface" };
  if (d.statut === "ecartee") return { statut: "refuse", raison: "ecartee" };
  if (d.clientId !== null) return { statut: "deja_rattachee", clientId: d.clientId };
  if (!d.fichesProches.some((f) => f.ficheId === ficheId)) {
    return { statut: "refuse", raison: "fiche_non_proche" };
  }

  return reessayerSiInterblocage(() =>
    prisma.$transaction(async (tx): Promise<ResultatCompletion> => {
      // Verrou de la demande, relue (statut et fiche à jour), PUIS de la fiche, avant toute lecture
      // ou écriture (même ordre que la complétion du questionnaire : fiche, puis personnes).
      const verrou = await verrouillerDemande(tx, d.id);
      if (verrou === null) return { statut: "refuse", raison: "introuvable" };
      if (verrou.statut === "effacee_rgpd") return { statut: "refuse", raison: "efface" };
      if (verrou.statut === "ecartee") return { statut: "refuse", raison: "ecartee" };
      if (verrou.clientId !== null) {
        return { statut: "deja_rattachee", clientId: verrou.clientId };
      }
      await tx.$queryRaw`SELECT id FROM clients WHERE id = ${ficheId}::uuid FOR UPDATE`;
      const fiche = await tx.client.findFirst({
        where: { id: ficheId, fusionsAbsorbee: { none: { defaiteLe: null } } },
        select: { adresseVille: true },
      });
      if (fiche === null) return { statut: "refuse", raison: "fiche_disparue" };

      const data = champsACompleter(fiche, d.villeNom);
      const champs = Object.keys(data);
      const avant = await chargeClientAvant(tx, ficheId);
      if (champs.length > 0) {
        await tx.client.update({ where: { id: ficheId }, data });
      }

      // La personne : retrouvée par son adresse, sinon ajoutée à la fiche (jamais à la place d'une autre).
      const personne = await ajouterPersonneAFiche(
        dansLaTransaction(tx),
        ficheId,
        { nom: d.nom, email: d.email, telephone: d.telephone },
        acteurId,
      );
      // Une personne déjà connue n'est jamais modifiée par une demande publique non vérifiée
      // (et ses copies `contact*` de la fiche resteraient hors de la porte unique).

      if (champs.length > 0) await emettreFaitClient(tx, ficheId, { avant });

      await tx.activityLog.create({
        data: {
          adminUserId: acteurId,
          action: ACTION_DEMANDE_SUR_FICHE,
          targetType: "Client",
          targetId: ficheId,
          changes: {
            libelle: `Demande Tour France IA, ville ${villeTrace(d)}`,
            demandeId: d.id,
            ville: villeTrace(d),
            champs,
            personneAjoutee: personne.cree,
            depuis: d.depuis,
            utm: d.utm,
          },
        },
      });
      await tx.tourDemande.update({
        where: { id: d.id },
        data: { rattachement: "fiche_completee", clientId: ficheId },
      });
      return { statut: "completee", clientId: ficheId };
    }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Créer la fiche prospect (bouton de la console)
// ─────────────────────────────────────────────────────────────────────────────

export interface EntreeCreationFiche {
  /** Tapée par l'équipe : les quatre champs de la demande ne la donnent pas. */
  readonly raisonSociale: string;
  readonly type: "entreprise" | "particulier";
  /** Motif de « créer quand même » si l'adresse e-mail est déjà sur une fiche (10 caractères au moins). */
  readonly motif?: string | null;
}

export type ResultatCreationFiche =
  | { readonly statut: "cree"; readonly clientId: string; readonly numero: string }
  | { readonly statut: "deja_rattachee"; readonly clientId: string | null }
  | { readonly statut: "refuse"; readonly message: string };

/**
 * « Créer la fiche prospect » : par la PORTE UNIQUE (verrous, anti-doublon de SIREN et d'adresse),
 * source « Tour France IA », la personne de la demande comme contact. La demande passe « fiche
 * créée ». Rien n'est créé si la demande a déjà une fiche, si elle a été effacée à la demande de la
 * personne ou écartée, ni si la porte refuse. La ligne de la demande est verrouillée dans la
 * transaction : deux clics simultanés ne créent pas deux fiches.
 */
export async function creerFicheDepuisDemande(
  demandeId: string,
  entree: EntreeCreationFiche,
  acteurId: string | null,
): Promise<ResultatCreationFiche> {
  const raisonSociale = entree.raisonSociale.trim().slice(0, 250);
  if (raisonSociale === "") {
    return { statut: "refuse", message: "Donnez un nom à la fiche." };
  }
  const motif = (entree.motif ?? "").trim().slice(0, LONGUEUR_MAX_MOTIF);
  const d = await lireDemandeClaire(demandeId);
  if (d === null) return { statut: "refuse", message: MESSAGE_DEMANDE_INTROUVABLE };
  if (d.statut === "effacee_rgpd") return { statut: "refuse", message: MESSAGE_DEMANDE_EFFACEE };
  if (d.statut === "ecartee") return { statut: "refuse", message: MESSAGE_DEMANDE_ECARTEE };
  if (d.clientId !== null) return { statut: "deja_rattachee", clientId: d.clientId };

  return reessayerSiInterblocage(() =>
    prisma.$transaction(async (tx): Promise<ResultatCreationFiche> => {
      const verrou = await verrouillerDemande(tx, d.id);
      if (verrou === null) return { statut: "refuse", message: MESSAGE_DEMANDE_INTROUVABLE };
      if (verrou.statut === "effacee_rgpd") {
        return { statut: "refuse", message: MESSAGE_DEMANDE_EFFACEE };
      }
      if (verrou.statut === "ecartee") {
        return { statut: "refuse", message: MESSAGE_DEMANDE_ECARTEE };
      }
      if (verrou.clientId !== null) return { statut: "deja_rattachee", clientId: verrou.clientId };

      const r = await creerOuRetrouverClient(
        dansLaTransaction(tx),
        {
          type: entree.type,
          raisonSociale,
          // Seulement le nom du référentiel des villes, jamais le texte libre de la personne.
          ...(d.villeNom !== null ? { adresseVille: d.villeNom.slice(0, 120) } : {}),
          source: SOURCE_FICHE_TOUR,
        },
        { nom: d.nom, email: d.email, telephone: d.telephone },
        { parAdminId: acteurId, motifCreationForcee: motif === "" ? null : motif },
      );
      if (r.statut !== "cree") return { statut: "refuse", message: r.message };

      await tx.activityLog.create({
        data: {
          adminUserId: acteurId,
          action: ACTION_FICHE_CREEE_DEPUIS_DEMANDE,
          targetType: "Client",
          targetId: r.id,
          changes: {
            libelle: `Demande Tour France IA, ville ${villeTrace(d)}`,
            demandeId: d.id,
            ville: villeTrace(d),
            depuis: d.depuis,
            utm: d.utm,
          },
        },
      });
      await tx.tourDemande.update({
        where: { id: d.id },
        data: { rattachement: "fiche_creee", clientId: r.id },
      });
      return { statut: "cree", clientId: r.id, numero: r.numero };
    }),
  );
}
