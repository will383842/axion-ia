/**
 * RETIRER UNE PERSONNE d'une fiche client (ordre de Will du 26/10/2026 : une personne d'essai
 * ajoutée sur la fiche d'essai AXI-CLI-003, dont la fiche entière ne peut pas partir à cause de ses
 * factures). Même dispositif que `suppression-manuelle.ts`, dont il réutilise les pièces : JAMAIS
 * automatique, super-administrateur seul, DOUBLE VALIDATION (mot EFFACER, puis recopie du nom de la
 * personne ou des 8 premiers caractères de son identifiant), jeton signé de 5 minutes lié à
 * l'empreinte du bilan (`suppression-jeton.ts`).
 *
 * Ce qui part : la personne, ses adresses e-mail (cascade de la base, comptées au bilan) et son
 * numéro de téléphone (un champ de la personne).
 *
 * Ce qui REFUSE, en clair, sans rien supprimer :
 *   · la fiche d'Oury Création (AXI-CLI-004), intouchable ;
 *   · le contact de facturation (case cochée, ou adresse recopiée sur la fiche) : il porte les
 *     factures et les devis ; la dernière personne de la fiche ;
 *   · TOUTE clé étrangère qui vise la personne, lue dans le catalogue (`liensHorsPerimetre`) : seules
 *     ses adresses sont dans la liste blanche ; participation à un rendez-vous, rôle dans une
 *     prestation, questionnaire de cadrage, e-mail de suivi, fait relevé… et toute table de demain ;
 *   · les liens SANS clé étrangère, par son adresse ou son nom : participant d'un rendez-vous
 *     rapproché par l'adresse, questionnaire adressé à cette personne (et ses réponses), facture à son
 *     nom, inscription ou contact sur place d'une session de formation, séance de coaching, e-mail
 *     parti ou en attente vers elle (hors contact@axion-ia.com).
 *
 * Le bilan est RECALCULÉ dans la transaction, après verrou de la fiche (une personne ajoutée en même
 * temps attend notre fin), de la personne et de ses adresses ; s'il a changé depuis la 1re étape,
 * rien n'est supprimé. Trace dans `activity_logs` : qui, quand, quoi, combien, sans nom ni adresse.
 *
 * ⛔ Le CRM Pro n'est pas prévenu : sa synchro est sans suppression (une personne absente du message
 * suivant « ne change rien » de son côté). Aucun e-mail n'est envoyé.
 */

import { prisma } from "@/lib/prisma";

import type { Tx } from "./base";
import {
  ADRESSE_INTERNE,
  type Compteur,
  liensHorsPerimetre,
  MOT_CONFIRMATION,
  STATUTS_ENVOI_REEL,
} from "./suppression-manuelle";
import {
  creerJetonSuppression,
  empreinteBilan,
  lireJetonSuppression,
  normaliserCode,
} from "./suppression-jeton";

/** La fiche d'Oury Création : aucune personne n'en est retirée d'ici, jamais. */
export const FICHE_PROTEGEE = "AXI-CLI-004";

export const MESSAGE_RETRAIT_BLOQUE =
  "Impossible de retirer cette personne depuis la console : elle est liée à des données à garder.";

export interface BilanRetraitPersonne {
  readonly contactId: string;
  readonly clientId: string;
  /** Pour l'écran de confirmation seulement, jamais tracés. */
  readonly nom: string;
  readonly numeroFiche: string;
  /** 8 premiers caractères de l'identifiant, à recopier (le nom de la personne vaut aussi). */
  readonly code: string;
  readonly compteurs: ReadonlyArray<Compteur>;
  readonly bloquants: ReadonlyArray<string>;
}

const minuscule = (s: string) => s.trim().toLowerCase();

async function calculer(tx: Tx, contactId: string): Promise<BilanRetraitPersonne | null> {
  const c = await tx.clientContact.findUnique({
    where: { id: contactId },
    select: {
      id: true,
      clientId: true,
      nom: true,
      telephone: true,
      estContactFacturation: true,
      adresses: { select: { email: true, emailHash: true } },
      client: { select: { numero: true, contactEmail: true } },
    },
  });
  if (c === null) return null;
  const emails = [...new Set(c.adresses.map((a) => minuscule(a.email)))];
  const hashes = [...new Set(c.adresses.map((a) => a.emailHash))];
  const nom = c.nom.trim();
  const bloquants: string[] = [];

  if (c.client.numero === FICHE_PROTEGEE) {
    bloquants.push(`fiche ${FICHE_PROTEGEE} protégée : aucune personne n'en est retirée d'ici`);
  }
  const copieFacturation =
    c.client.contactEmail !== null && emails.includes(minuscule(c.client.contactEmail));
  if (c.estContactFacturation || copieFacturation) {
    bloquants.push(
      "contact de facturation de la fiche (factures et devis) : désignez-en un autre d'abord",
    );
  }
  const autres = await tx.clientContact.count({
    where: { clientId: c.clientId, id: { not: c.id } },
  });
  if (autres === 0) bloquants.push("dernière personne de la fiche");

  // Les clés étrangères : seules ses adresses partent avec elle (cascade comptée au bilan).
  bloquants.push(
    ...(await liensHorsPerimetre(
      tx,
      "client_contacts",
      [c.id],
      new Map([["client_contact_adresses.contact_id", true as const]]),
    )),
  );

  const parAdresse = emails.map((e) => ({
    recipient: { equals: e, mode: "insensitive" as const },
  }));
  const memeNom = { equals: nom, mode: "insensitive" as const };
  const [
    participations,
    questionnaires,
    factures,
    stagiaires,
    surPlace,
    coachings,
    envois,
    enAttente,
  ] = await Promise.all([
    hashes.length === 0
      ? 0
      : tx.rencontreParticipant.count({ where: { emailHash: { in: hashes } } }),
    hashes.length === 0
      ? 0
      : tx.questionnaireAvantAudit.count({ where: { destinataireHash: { in: hashes } } }),
    nom === ""
      ? 0
      : tx.factureFormation.count({ where: { clientId: c.clientId, destinataireNom: memeNom } }),
    emails.length === 0
      ? 0
      : tx.enrollment.count({ where: { trainee: { email: { in: emails } } } }),
    nom === ""
      ? 0
      : tx.trainingSession.count({
          where: { clientId: c.clientId, contactSurPlaceNom: memeNom },
        }),
    emails.length === 0
      ? 0
      : tx.coachingSession.count({
          where: {
            OR: [{ beneficiaireEmail: { in: emails } }, { tuteurEntrepriseEmail: { in: emails } }],
          },
        }),
    tx.emailLog.count({
      where: {
        OR: [{ entityId: c.id }, ...parAdresse],
        status: { in: [...STATUTS_ENVOI_REEL] },
        NOT: { recipient: { equals: ADRESSE_INTERNE, mode: "insensitive" } },
      },
    }),
    tx.emailOutbox.count({
      where: {
        OR: [{ entityId: c.id }, ...parAdresse],
        statut: { not: "refuse" },
        NOT: { recipient: { equals: ADRESSE_INTERNE, mode: "insensitive" } },
      },
    }),
  ]);
  if (participations > 0) {
    bloquants.push(`${participations} participation(s) à un rendez-vous (par son adresse)`);
  }
  if (questionnaires > 0) {
    bloquants.push(
      `${questionnaires} questionnaire(s) adressé(s) à cette personne, réponses comprises`,
    );
  }
  if (factures > 0) bloquants.push(`${factures} facture(s) à son nom`);
  if (stagiaires > 0) bloquants.push(`${stagiaires} inscription(s) à une session de formation`);
  if (surPlace > 0) bloquants.push(`contact sur place de ${surPlace} session(s) de formation`);
  if (coachings > 0) bloquants.push(`${coachings} séance(s) de formation individuelle`);
  if (envois > 0) bloquants.push(`${envois} e-mail(s) parti(s) ou en cours vers cette personne`);
  if (enAttente > 0) {
    bloquants.push(`${enAttente} e-mail(s) non refusé(s) de « E-mails à valider » vers elle`);
  }

  return {
    contactId: c.id,
    clientId: c.clientId,
    nom,
    numeroFiche: c.client.numero,
    code: c.id.slice(0, 8).toUpperCase(),
    compteurs: [
      { libelle: "personne", n: 1 },
      { libelle: "adresse(s) e-mail", n: c.adresses.length },
      { libelle: "numéro(s) de téléphone", n: c.telephone ? 1 : 0 },
    ],
    bloquants: [...new Set(bloquants)],
  };
}

const empreinte = (b: BilanRetraitPersonne) =>
  empreinteBilan({ type: "personne", id: b.contactId, compteurs: b.compteurs });

/** Pour l'écran : l'empreinte que le jeton doit porter. */
export const empreinteRetrait = empreinte;

/** L'écran de confirmation : ce qui serait supprimé, et ce qui l'empêche. Lecture seule. */
export async function bilanRetraitPersonne(
  contactId: string,
  base: { $transaction: typeof prisma.$transaction } = prisma,
): Promise<BilanRetraitPersonne | null> {
  return base.$transaction(async (tx) => calculer(tx as Tx, contactId), { timeout: 30_000 });
}

const refus = (b: BilanRetraitPersonne) => `${MESSAGE_RETRAIT_BLOQUE} (${b.bloquants.join(" ; ")})`;

/** 1re validation : mot EFFACER + bilan sans bloquant → jeton signé (5 minutes). Rien n'est supprimé. */
export async function preparerRetraitPersonne(
  args: { readonly contactId: string; readonly acteurId: string; readonly confirmation: string },
  base: { $transaction: typeof prisma.$transaction } = prisma,
  maintenant: number = Date.now(),
): Promise<
  { readonly ok: true; readonly jeton: string } | { readonly ok: false; readonly motif: string }
> {
  if (args.confirmation !== MOT_CONFIRMATION) {
    return { ok: false, motif: `Écrivez ${MOT_CONFIRMATION} pour confirmer.` };
  }
  const bilan = await bilanRetraitPersonne(args.contactId, base);
  if (bilan === null) return { ok: false, motif: "Personne introuvable : rien à retirer." };
  if (bilan.bloquants.length > 0) return { ok: false, motif: refus(bilan) };
  const jeton = creerJetonSuppression(
    { type: "personne", id: bilan.contactId, acteurId: args.acteurId, empreinte: empreinte(bilan) },
    maintenant,
  );
  if (jeton === null) {
    return {
      ok: false,
      motif: "Retrait indisponible : la clé de signature manque sur le serveur.",
    };
  }
  return { ok: true, jeton };
}

export type ResultatRetrait =
  | {
      readonly ok: true;
      readonly compteurs: ReadonlyArray<Compteur>;
      readonly clientId: string | null;
      /** Vrai si la personne n'existait plus (double clic) : rien supprimé, rien tracé. */
      readonly dejaRetiree?: boolean;
    }
  | { readonly ok: false; readonly motif: string };

/** Le code recopié : les 8 premiers caractères de l'identifiant, ou le nom de la personne. */
function codeAccepte(saisi: string, b: BilanRetraitPersonne): boolean {
  const s = normaliserCode(saisi);
  return s !== "" && (s === normaliserCode(b.code) || s === normaliserCode(b.nom));
}

/**
 * 2e validation : retire la personne après avoir REVU le bilan dans la transaction. L'appelant a
 * vérifié le rôle ; on revérifie ici le jeton (signé, non expiré, type « personne », même personne,
 * même acteur), le code recopié et l'empreinte du bilan.
 */
export async function retirerPersonne(
  args: {
    readonly contactId: string;
    readonly acteurId: string;
    readonly jeton: string;
    readonly code: string;
  },
  base: { $transaction: typeof prisma.$transaction } = prisma,
  maintenant: number = Date.now(),
): Promise<ResultatRetrait> {
  const lu = lireJetonSuppression(args.jeton, maintenant);
  if (!lu.ok) return { ok: false, motif: lu.motif };
  const { contenu } = lu;
  if (contenu.t !== "personne" || contenu.i !== args.contactId || contenu.a !== args.acteurId) {
    return { ok: false, motif: "Cette validation ne vaut pas pour ce retrait : recommencez." };
  }
  return base.$transaction(
    async (t): Promise<ResultatRetrait> => {
      const tx = t as Tx;
      // Du parent vers l'enfant : la fiche (une personne ajoutée en même temps attend notre fin,
      // donc « dernière personne » reste vrai), la personne, ses adresses.
      await tx.$queryRaw`SELECT c.id FROM clients c JOIN client_contacts p ON p.client_id = c.id WHERE p.id = ${args.contactId}::uuid FOR UPDATE OF c`;
      await tx.$queryRaw`SELECT id FROM client_contacts WHERE id = ${args.contactId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM client_contact_adresses WHERE contact_id = ${args.contactId}::uuid FOR UPDATE`;
      const bilan = await calculer(tx, args.contactId);
      if (bilan === null) return { ok: true, compteurs: [], clientId: null, dejaRetiree: true };
      if (bilan.bloquants.length > 0) return { ok: false, motif: refus(bilan) };
      if (!codeAccepte(args.code, bilan)) {
        return { ok: false, motif: "Le code recopié ne correspond pas. Rien n'a été supprimé." };
      }
      if (empreinte(bilan) !== contenu.b) {
        return {
          ok: false,
          motif:
            "Ce qui serait supprimé a changé depuis la première validation : relisez le bilan et recommencez.",
        };
      }
      await tx.clientContactAdresse.deleteMany({ where: { contactId: bilan.contactId } });
      const r = await tx.clientContact.deleteMany({
        where: { id: bilan.contactId, clientId: bilan.clientId },
      });
      // Impossible sous verrou ; si cela arrivait, on annule TOUT (adresses comprises).
      if (r.count !== 1) throw new Error("Retrait interrompu : rien n'a été supprimé.");
      // Trace SANS contenu : qui, quand (createdAt), quoi, combien. Jamais purgée.
      await tx.activityLog.create({
        data: {
          adminUserId: args.acteurId,
          action: "suppression-manuelle.personne",
          targetType: "personne",
          targetId: bilan.contactId,
          changes: {
            ...Object.fromEntries(bilan.compteurs.map((c) => [c.libelle, c.n])),
            clientId: bilan.clientId,
            doubleValidation: true,
          },
        },
      });
      return { ok: true, compteurs: bilan.compteurs, clientId: bilan.clientId };
    },
    { timeout: 30_000 },
  );
}
