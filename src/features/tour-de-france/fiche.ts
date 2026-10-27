/**
 * Tour France IA : une demande et la fiche prospect de la console (PR-2a).
 *
 * C'est le SEUL module de ce dossier qui touche une fiche `Client`. Règles, dans l'ordre :
 *
 *   1. On cherche les fiches qui ressemblent à la personne par la PORTE UNIQUE
 *      (`src/server/qualiopi/crm/porte-client.ts` : même e-mail, même fin d'adresse professionnelle,
 *      même nom dans la même ville) et par le téléphone (les 9 derniers chiffres).
 *   2. Exactement UNE fiche, au signal « même e-mail », et aucune autre fiche proche : la fiche est
 *      SÛRE. On la COMPLÈTE, en n'écrivant que ce qui est vide (la ville ; la personne si elle
 *      manque ; le téléphone et le nom d'une personne qui n'en a pas), jamais le statut, la source,
 *      la raison sociale ni le SIREN, et on laisse une trace « Demande Tour France IA, ville X ».
 *   3. Un doute (même téléphone, même nom et même ville, même domaine, plusieurs fiches) : RIEN
 *      n'est écrit sur une fiche. La demande passe « à arbitrer », avec le lien vers chaque fiche
 *      proche, et l'équipe tranche.
 *   4. Aucune fiche : pas de création automatique (les quatre champs ne donnent pas l'entreprise,
 *      or une fiche exige une raison sociale). La demande reste « sans fiche » ; le bouton de la
 *      console « Créer la fiche prospect » passe par la porte unique, avec une raison sociale tapée
 *      par l'équipe.
 *
 * Aucune fiche n'est supprimée ni fusionnée ici. Les colonnes `contact*` de la fiche ne sont
 * JAMAIS écrites directement (seule `definirContactFacturation` le fait) : une personne se
 * rattache par `ajouterPersonneAFiche`.
 *
 * ⛔ Cliquet `aucun-ecrivain-de-client-hors-de-la-porte-unique` : aucun `client.create` ici, aucune
 * écriture de `siren`. Cliquet des écrivains : la mise à jour de la fiche et l'émission vers
 * Axion Partners (`emettreFaitClient`) sont dans la même transaction.
 */

import { dansLaTransaction } from "@/features/dossier-client/base";
import { fichesAuMemeTelephone } from "@/features/dossier-client/fiche-auto";
import { reessayerSiInterblocage } from "@/features/questionnaire-preaudit/interblocage";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { chargeClientAvant, emettreFaitClient } from "@/server/partners-sync/producteurs/client";
import { NOM_A_COMPLETER } from "@/server/qualiopi/crm/contact-facturation";
import {
  ajouterPersonneAFiche,
  chargerFichesCandidates,
  creerOuRetrouverClient,
  preparerCandidat,
  trouverFichesProches,
  type FicheProche,
} from "@/server/qualiopi/crm/porte-client";
import { versRattachement, type FicheProcheStockee, type Rattachement } from "./types";

/** Trace posée sur une fiche COMPLÉTÉE par une demande. */
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
  | { readonly issue: "completer"; readonly ficheId: string }
  | { readonly issue: "arbitrer"; readonly proches: ReadonlyArray<FicheProcheStockee> }
  | { readonly issue: "aucune" };

/**
 * Que faire de la demande ? Une seule fiche, reconnue à l'adresse e-mail et à rien d'autre : on la
 * complète. Toute autre ressemblance : on arbitre, sans rien écrire. Aucune : pas de fiche. PUR.
 */
export function decider(proches: ReadonlyArray<FicheProcheStockee>): DecisionRattachement {
  const [premiere, ...autres] = proches;
  if (premiere === undefined) return { issue: "aucune" };
  if (autres.length === 0 && premiere.signal === "email") {
    return { issue: "completer", ficheId: premiere.ficheId };
  }
  return { issue: "arbitrer", proches };
}

/** Les champs de la fiche que la demande peut remplir : seulement ce qui est VIDE. PUR. */
export function champsACompleter(
  fiche: { readonly adresseVille: string | null },
  ville: string | null,
): { adresseVille?: string } {
  const propre = (ville ?? "").trim().slice(0, 120);
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
  /** Le nom du référentiel, sinon la ville telle que tapée. */
  readonly ville: string;
  readonly villeNom: string | null;
  readonly depuis: string | null;
  readonly utm: Readonly<Record<string, string>>;
  readonly rattachement: Rattachement;
  readonly clientId: string | null;
}

async function lireDemandeClaire(demandeId: string): Promise<DemandeClaire> {
  const d = await prisma.tourDemande.findUnique({
    where: { id: demandeId },
    select: {
      id: true,
      nom: true,
      email: true,
      telephone: true,
      villeSaisie: true,
      villeNom: true,
      depuis: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmContent: true,
      rattachement: true,
      clientId: true,
    },
  });
  if (d === null) throw new Error(`demande du Tour introuvable : ${demandeId}`);
  const utm: Record<string, string> = {};
  if (d.utmSource !== null) utm["source"] = d.utmSource;
  if (d.utmMedium !== null) utm["medium"] = d.utmMedium;
  if (d.utmCampaign !== null) utm["campaign"] = d.utmCampaign;
  if (d.utmContent !== null) utm["content"] = d.utmContent;
  return {
    id: d.id,
    nom: decryptPii(d.nom),
    email: decryptPii(d.email),
    telephone: decryptPii(d.telephone),
    ville: d.villeNom ?? d.villeSaisie,
    villeNom: d.villeNom,
    depuis: d.depuis,
    utm,
    rattachement: versRattachement(d.rattachement),
    clientId: d.clientId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rattacher une demande à une fiche (à l'envoi)
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
 * Cherche la fiche de la personne et agit selon `decider`. Voir l'en-tête. Idempotente : une
 * demande déjà rattachée est rendue telle quelle. Les recherches ne touchent à rien ; seule la
 * complétion d'une fiche SÛRE écrit, dans une transaction.
 */
export async function rattacherDemande(demandeId: string): Promise<ResultatRattachement> {
  const d = await lireDemandeClaire(demandeId);
  if (d.rattachement !== "a_verifier") {
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

  if (decision.issue === "completer") {
    const ficheId = decision.ficheId;
    const completee = await reessayerSiInterblocage(() =>
      prisma.$transaction(async (tx) => {
        // Verrou de la fiche AVANT toute lecture ou écriture (même ordre que la complétion du
        // questionnaire : fiche, puis personnes) — deux gestes sur la même fiche passent l'un après l'autre.
        await tx.$queryRaw`SELECT id FROM clients WHERE id = ${ficheId}::uuid FOR UPDATE`;
        const fiche = await tx.client.findUnique({
          where: { id: ficheId },
          select: { adresseVille: true },
        });
        if (fiche === null) return false;

        const data = champsACompleter(fiche, d.ville);
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
          null,
        );
        if (!personne.cree) {
          // Une personne déjà connue : on ne remplit que ce qui lui manque.
          const connue = await tx.clientContact.findUnique({
            where: { id: personne.contactId },
            select: { nom: true, telephone: true },
          });
          const manque = {
            ...(connue !== null && (connue.telephone ?? "").trim() === ""
              ? { telephone: d.telephone }
              : {}),
            ...(connue !== null && connue.nom === NOM_A_COMPLETER ? { nom: d.nom } : {}),
          };
          if (Object.keys(manque).length > 0) {
            await tx.clientContact.update({ where: { id: personne.contactId }, data: manque });
          }
        }

        if (champs.length > 0) await emettreFaitClient(tx, ficheId, { avant });

        await tx.activityLog.create({
          data: {
            adminUserId: null,
            action: ACTION_DEMANDE_SUR_FICHE,
            targetType: "Client",
            targetId: ficheId,
            changes: {
              libelle: `Demande Tour France IA, ville ${d.ville}`,
              demandeId: d.id,
              ville: d.ville,
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
        return true;
      }),
    );
    if (completee) return { rattachement: "fiche_completee", clientId: ficheId };
    // La fiche a disparu entre la recherche et le verrou : on traite la demande comme sans fiche.
    await prisma.tourDemande.update({ where: { id: d.id }, data: { rattachement: "sans_fiche" } });
    return { rattachement: "sans_fiche", clientId: null };
  }

  if (decision.issue === "arbitrer") {
    await prisma.tourDemande.update({
      where: { id: d.id },
      data: { rattachement: "a_arbitrer", fichesProches: [...decision.proches] },
    });
    return { rattachement: "a_arbitrer", clientId: null };
  }

  await prisma.tourDemande.update({ where: { id: d.id }, data: { rattachement: "sans_fiche" } });
  return { rattachement: "sans_fiche", clientId: null };
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
 * créée ». Rien n'est créé si la demande a déjà une fiche, ni si la porte refuse.
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
  const d = await lireDemandeClaire(demandeId);
  if (d.clientId !== null) return { statut: "deja_rattachee", clientId: d.clientId };

  return prisma.$transaction(async (tx): Promise<ResultatCreationFiche> => {
    const r = await creerOuRetrouverClient(
      dansLaTransaction(tx),
      {
        type: entree.type,
        raisonSociale,
        adresseVille: d.ville.slice(0, 120),
        source: SOURCE_FICHE_TOUR,
      },
      { nom: d.nom, email: d.email, telephone: d.telephone },
      { parAdminId: acteurId, motifCreationForcee: entree.motif ?? null },
    );
    if (r.statut !== "cree") return { statut: "refuse", message: r.message };

    await tx.activityLog.create({
      data: {
        adminUserId: acteurId,
        action: ACTION_FICHE_CREEE_DEPUIS_DEMANDE,
        targetType: "Client",
        targetId: r.id,
        changes: {
          libelle: `Demande Tour France IA, ville ${d.ville}`,
          demandeId: d.id,
          ville: d.ville,
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
  });
}
