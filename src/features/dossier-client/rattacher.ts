/**
 * Ranger un rendez-vous chez un client — PROPOSER, jamais décider
 * (chantier visio, PR 4 ; décision A4 de Will : « un rendez-vous n'est jamais
 * rangé automatiquement chez un client ; il est proposé, Will valide en un
 * clic »).
 *
 * ## Deux temps, deux fonctions
 *
 *   · `proposerRattachement` — la MACHINE regarde ce qu'elle sait (l'adresse
 *     de l'invité, son domaine professionnel, l'entreprise déclarée dans le
 *     formulaire Calendly, un report) et écrit une PROPOSITION :
 *     `clientProposeId` + `motifProposition`, statut `propose`. Elle n'écrit
 *     JAMAIS `clientId`. Garde : `aucun-rattachement-n-est-automatique-en-v1`.
 *   · `validerRattachement` — WILL clique « Confirmer le client proposé » (ou
 *     range ailleurs) : `clientId`, statut `valide`, journal, et les faits de
 *     la rencontre suivent son client dans la même transaction (le trigger
 *     `faits_client_de_la_rencontre` l'exige au COMMIT).
 *
 * ## Les motifs, dans l'ordre (le premier trouvé gagne)
 *
 *   1. `email_calendly` — l'adresse de l'invité est l'adresse de facturation
 *      d'une fiche (`Client.contactEmail`) ;
 *   2. `contact_connu` — l'adresse d'un participant est celle d'une personne
 *      d'une fiche (`client_contact_adresses`, par empreinte) ;
 *   3. `demande_liee` — Will a relié le rendez-vous à une DEMANDE envoyée
 *      depuis le site (`CalendlyEvent.linkedSubmissionId`), et cette demande
 *      ressemble à une fiche : même SIREN (tiré du numéro saisi), même
 *      adresse qu'une personne de la fiche (par empreinte), ou même raison
 *      sociale normalisée (plan V-06, correction EX-M5) ;
 *   4. `report` — le rendez-vous remplace un rendez-vous déjà rangé ;
 *   5. `domaine_email` — même domaine PROFESSIONNEL qu'une personne d'une
 *      fiche. Jamais une messagerie grand public (`DOMAINES_WEBMAIL`) : deux
 *      clients Gmail n'ont rien en commun ;
 *   6. `entreprise_declaree` — le « Nom de l'entreprise » du formulaire
 *      Calendly, normalisé, est la raison sociale d'une fiche.
 *
 * Une fiche ABSORBÉE par une fusion vivante n'est jamais proposée : on propose
 * l'absorbante.
 *
 * ## Le rattachement tardif relance le circuit (PR 6)
 *
 * `relancerApresRattachement` est le POINT D'ENFILAGE de l'étape `rattacher`
 * du circuit : un rendez-vous rangé après coup voit son compte rendu complété
 * (P2 à P5), sans refaire l'extraction. Câblé par la PR 6 sur
 * `completerApresRattachement` (`src/server/visio/gestes-compte-rendu.ts`).
 *
 * Module neutre (sans `server-only`) : le balayage du worker l'appelle.
 */

import type { MotifProposition } from "../../../prisma/generated/client";
import { domaineDe, natureAdresse } from "@/lib/email/nature-adresse";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { checkSirenFormat, normalizeSiret, sirenDuSiret } from "@/lib/siret";
import { normaliserNom } from "@/server/qualiopi/crm/normaliser-nom";
import { completerApresRattachement } from "@/server/visio/gestes-compte-rendu";
import type { Tx } from "./base";

/** Ce que la machine sait d'un rendez-vous pour proposer une fiche. */
export interface IndicesDeRattachement {
  /** Adresse du titulaire de la réservation. */
  readonly emailTitulaire: string | null;
  /** Adresses des autres invités. */
  readonly emailsInvites: readonly string[];
  /** « Nom de l'entreprise » déclaré dans le formulaire Calendly. */
  readonly entrepriseDeclaree: string | null;
  /** Fiche de la rencontre que celle-ci remplace (report), rangée ou proposée. */
  readonly clientDuReport: string | null;
  /** La demande du site reliée au rendez-vous (`linkedSubmissionId`), s'il y en a une. */
  readonly demandeLiee: DemandeLiee | null;
}

/** Ce que la proposition lit d'une demande envoyée depuis le site. */
export interface DemandeLiee {
  /** SIREN tiré du numéro saisi (SIREN ou SIRET), ou `null`. */
  readonly siren: string | null;
  /** Empreinte de l'adresse de la demande (`Submission.contactEmailHash`). */
  readonly emailHash: string | null;
  readonly raisonSociale: string | null;
}

/**
 * Le SIREN d'un numéro saisi dans une demande (un SIREN, ou un SIRET dont il
 * est le début), par les règles de `lib/siret.ts`. `null` si le numéro n'est
 * pas un SIREN valide : une faute de frappe ne propose jamais une fiche. PUR.
 */
export function sirenDuNumeroSaisi(numero: string | null | undefined): string | null {
  const v = normalizeSiret(numero ?? "");
  const controle = checkSirenFormat(/^\d{14}$/.test(v) ? sirenDuSiret(v) : v);
  return controle.ok ? controle.value : null;
}

export interface Proposition {
  readonly clientId: string;
  readonly motif: MotifProposition;
}

/** Les fiches, vues par la proposition. */
export interface FicheConnuePourRattachement {
  readonly id: string;
  readonly raisonSociale: string;
  readonly siren: string | null;
  readonly contactEmail: string | null;
  /** Empreintes des adresses de ses personnes. */
  readonly empreintes: readonly string[];
  /** Domaines PROFESSIONNELS de ses personnes. */
  readonly domainesPro: readonly string[];
}

/**
 * La proposition, calculée sur ce que la machine sait. PURE.
 * `null` : rien ne ressemble — le rendez-vous reste « à classer ».
 */
export function calculerProposition(
  indices: IndicesDeRattachement,
  fiches: readonly FicheConnuePourRattachement[],
): Proposition | null {
  const titulaire = indices.emailTitulaire?.trim().toLowerCase() || null;
  const adresses = [titulaire, ...indices.emailsInvites.map((e) => e.trim().toLowerCase())].filter(
    (e): e is string => !!e && e.includes("@"),
  );

  if (titulaire) {
    const f = fiches.find((x) => (x.contactEmail ?? "").trim().toLowerCase() === titulaire);
    if (f) return { clientId: f.id, motif: "email_calendly" };
  }

  const empreintes = new Set(adresses.map((a) => hashEmailForLookup(a)).filter(Boolean));
  const parContact = fiches.find((x) => x.empreintes.some((h) => empreintes.has(h)));
  if (parContact) return { clientId: parContact.id, motif: "contact_connu" };

  const demande = indices.demandeLiee;
  if (demande) {
    const nomDemande = normaliserNom(demande.raisonSociale);
    const f =
      (demande.siren ? fiches.find((x) => x.siren === demande.siren) : undefined) ??
      (demande.emailHash
        ? fiches.find(
            (x) =>
              x.empreintes.includes(demande.emailHash as string) ||
              hashEmailForLookup(x.contactEmail) === demande.emailHash,
          )
        : undefined) ??
      (nomDemande !== ""
        ? fiches.find((x) => normaliserNom(x.raisonSociale) === nomDemande)
        : undefined);
    if (f) return { clientId: f.id, motif: "demande_liee" };
  }

  if (indices.clientDuReport) return { clientId: indices.clientDuReport, motif: "report" };

  const domainesPro = new Set(
    adresses.filter((a) => natureAdresse(a) === "pro").map((a) => domaineDe(a)),
  );
  if (domainesPro.size > 0) {
    const f = fiches.find((x) => x.domainesPro.some((d) => domainesPro.has(d)));
    if (f) return { clientId: f.id, motif: "domaine_email" };
  }

  const nom = normaliserNom(indices.entrepriseDeclaree);
  if (nom !== "") {
    const f = fiches.find((x) => normaliserNom(x.raisonSociale) === nom);
    if (f) return { clientId: f.id, motif: "entreprise_declaree" };
  }
  return null;
}

/** Les fiches candidates, lues pour une proposition (fiches absorbées exclues). */
export async function chargerFichesPourRattachement(
  tx: Tx,
  indices: IndicesDeRattachement,
): Promise<FicheConnuePourRattachement[]> {
  const adresses = [indices.emailTitulaire, ...indices.emailsInvites]
    .filter((e): e is string => !!e && e.includes("@"))
    .map((e) => e.trim().toLowerCase());
  const demande = indices.demandeLiee;
  const empreintes = [
    ...adresses.map((a) => hashEmailForLookup(a)),
    demande?.emailHash ?? null,
  ].filter((h): h is string => !!h);
  const domaines = [...new Set(adresses.filter((a) => natureAdresse(a) === "pro").map(domaineDe))];

  // Personnes dont une adresse est connue, ou au même domaine professionnel.
  const adressesConnues = await tx.clientContactAdresse.findMany({
    where: {
      OR: [
        ...(empreintes.length > 0 ? [{ emailHash: { in: empreintes } }] : []),
        ...domaines.map((d) => ({ email: { endsWith: `@${d}`, mode: "insensitive" as const } })),
      ],
    },
    select: { contactId: true, email: true, emailHash: true },
  });
  const contactIds = [...new Set(adressesConnues.map((a) => a.contactId))];
  const contacts =
    contactIds.length > 0
      ? await tx.clientContact.findMany({
          where: { id: { in: contactIds } },
          select: { id: true, clientId: true },
        })
      : [];

  const nomDeclare = indices.entrepriseDeclaree?.trim() ?? "";
  const premiereAdresse = adresses[0];
  const clientIds = [...new Set(contacts.map((c) => c.clientId))];
  const fichesBrutes = await tx.client.findMany({
    where: {
      OR: [
        ...(clientIds.length > 0 ? [{ id: { in: clientIds } }] : []),
        ...(premiereAdresse
          ? [{ contactEmail: { equals: premiereAdresse, mode: "insensitive" as const } }]
          : []),
        ...[nomDeclare, demande?.raisonSociale?.trim() ?? ""]
          .filter((n) => n !== "")
          .map((n) => ({
            raisonSociale: {
              contains: n.split(/\s+/)[0] ?? "",
              mode: "insensitive" as const,
            },
          })),
        ...(demande?.siren ? [{ siren: demande.siren }] : []),
      ],
    },
    select: { id: true, raisonSociale: true, siren: true, contactEmail: true },
    take: 50,
  });
  if (fichesBrutes.length === 0) return [];

  const absorbees = new Set(
    (
      await tx.clientFusion.findMany({
        where: { absorbeId: { in: fichesBrutes.map((f) => f.id) }, defaiteLe: null },
        select: { absorbeId: true },
      })
    ).map((f) => f.absorbeId),
  );

  return fichesBrutes
    .filter((f) => !absorbees.has(f.id))
    .map((f) => {
      const sesContacts = new Set(contacts.filter((c) => c.clientId === f.id).map((c) => c.id));
      const sesAdresses = adressesConnues.filter((a) => sesContacts.has(a.contactId));
      return {
        id: f.id,
        raisonSociale: f.raisonSociale,
        siren: f.siren,
        contactEmail: f.contactEmail,
        empreintes: sesAdresses.map((a) => a.emailHash),
        domainesPro: sesAdresses
          .map((a) => a.email)
          .filter((e) => natureAdresse(e) === "pro")
          .map(domaineDe),
      };
    });
}

/**
 * Pose (ou met à jour) la PROPOSITION d'une rencontre encore à classer ou
 * proposée. N'écrit jamais `clientId`. Une rencontre déjà validée n'est pas
 * touchée. À appeler DANS une transaction.
 */
export async function proposerRattachement(
  tx: Tx,
  rencontreId: string,
  indices: IndicesDeRattachement,
): Promise<Proposition | null> {
  const r = await tx.rencontre.findUnique({
    where: { id: rencontreId },
    select: { rattachementStatut: true, clientProposeId: true, motifProposition: true },
  });
  if (r === null || r.rattachementStatut === "valide") return null;

  const proposition = calculerProposition(
    indices,
    await chargerFichesPourRattachement(tx, indices),
  );
  if (proposition === null) return null;
  if (r.clientProposeId === proposition.clientId && r.motifProposition === proposition.motif) {
    return proposition;
  }

  await tx.rencontre.update({
    where: { id: rencontreId },
    data: {
      rattachementStatut: "propose",
      clientProposeId: proposition.clientId,
      motifProposition: proposition.motif,
    },
  });
  await tx.rencontreRattachementEvenement.create({
    data: {
      rencontreId,
      action: "propose",
      nouveauClientId: proposition.clientId,
      motif: proposition.motif,
      parAdminId: null,
    },
  });
  return proposition;
}

export class ErreurRattachement extends Error {}

export interface EntreeValiderRattachement {
  readonly rencontreId: string;
  readonly clientId: string;
  readonly projetId?: string | null;
  readonly parAdminId: string;
}

/**
 * Will range la rencontre chez un client (« Confirmer le client proposé », ou
 * un autre client choisi). À appeler DANS une transaction.
 *
 * Écrit : `clientId`, `projetId` (facultatif), statut `valide`, qui et quand ;
 * les faits de la rencontre SANS client passent chez lui, « à ranger » ; les
 * participants dont l'adresse est celle d'une personne de la fiche y sont
 * reliés ; le journal. Une rencontre déjà rangée ailleurs se DÉPLACE
 * (`deplacerRencontre`), elle ne se re-valide pas.
 */
export async function validerRattachement(tx: Tx, e: EntreeValiderRattachement): Promise<void> {
  const r = await tx.rencontre.findUnique({
    where: { id: e.rencontreId },
    select: {
      id: true,
      clientId: true,
      projetId: true,
      rattachementStatut: true,
      motifProposition: true,
    },
  });
  if (r === null) throw new ErreurRattachement("Rendez-vous introuvable.");
  if (r.clientId !== null && r.clientId !== e.clientId) {
    throw new ErreurRattachement(
      "Ce rendez-vous est déjà rangé chez un autre client : utilisez « Déplacer ».",
    );
  }
  const fiche = await tx.client.findUnique({ where: { id: e.clientId }, select: { id: true } });
  if (fiche === null) throw new ErreurRattachement("Fiche client introuvable.");
  if (e.projetId) {
    const projet = await tx.projet.findUnique({
      where: { id: e.projetId },
      select: { clientId: true },
    });
    if (projet === null || projet.clientId !== e.clientId) {
      throw new ErreurRattachement("Ce projet n'appartient pas à ce client.");
    }
  }

  await tx.rencontre.update({
    where: { id: e.rencontreId },
    data: {
      clientId: e.clientId,
      ...(e.projetId !== undefined ? { projetId: e.projetId } : {}),
      rattachementStatut: "valide",
      rattacheParId: e.parAdminId,
      rattacheLe: new Date(),
    },
  });

  // Les faits suivent leur rencontre (trigger différé au COMMIT).
  const faits = await tx.fait.findMany({
    where: { rencontreId: e.rencontreId, clientId: null },
    select: { id: true, portee: true },
  });
  for (const f of faits) {
    await tx.fait.update({ where: { id: f.id }, data: { clientId: e.clientId } });
    await tx.faitEvenement.create({
      data: {
        faitId: f.id,
        action: "deplace",
        ancienClientId: null,
        nouveauClientId: e.clientId,
        ancienPortee: f.portee,
        nouveauPortee: f.portee,
        parAdminId: e.parAdminId,
      },
    });
  }

  await relierParticipantsAuxPersonnes(tx, e.rencontreId, e.clientId);

  await tx.rencontreRattachementEvenement.create({
    data: {
      rencontreId: e.rencontreId,
      action: "valide",
      ancienClientId: r.clientId,
      nouveauClientId: e.clientId,
      ancienProjetId: r.projetId,
      nouveauProjetId: e.projetId ?? r.projetId,
      motif: r.motifProposition,
      parAdminId: e.parAdminId,
    },
  });
}

/**
 * Relie chaque participant d'une rencontre à la personne de la fiche qui
 * porte son adresse (par empreinte). Ne crée personne. À appeler DANS une
 * transaction.
 */
export async function relierParticipantsAuxPersonnes(
  tx: Tx,
  rencontreId: string,
  clientId: string,
): Promise<number> {
  const participants = await tx.rencontreParticipant.findMany({
    where: { rencontreId, role: { not: "axion" } },
    select: { id: true, emailHash: true, contactId: true },
  });
  const empreintes = participants
    .map((p) => p.emailHash)
    .filter((h): h is string => typeof h === "string");
  if (empreintes.length === 0) return 0;
  const contacts = await tx.clientContact.findMany({
    where: { clientId },
    select: { id: true },
  });
  const adresses = await tx.clientContactAdresse.findMany({
    where: { contactId: { in: contacts.map((c) => c.id) }, emailHash: { in: empreintes } },
    select: { contactId: true, emailHash: true },
  });
  let relies = 0;
  for (const p of participants) {
    const a = adresses.find((x) => x.emailHash === p.emailHash);
    if (a === undefined) continue;
    await tx.rencontreParticipant.update({
      where: { id: p.id },
      data: { clientId, contactId: a.contactId },
    });
    relies += 1;
  }
  return relies;
}

/**
 * POINT D'ENFILAGE — « Compléter après rattachement » (étape `rattacher` du
 * circuit, PR 6) : un rendez-vous rangé après coup voit son compte rendu
 * complété sans refaire l'extraction. Rend `true` si une nouvelle version est
 * programmée, `false` s'il n'y a pas de compte rendu (rendez-vous non
 * enregistré) : aucun appelant ne croit le travail lancé à tort.
 */
export async function relancerApresRattachement(
  db: Parameters<typeof completerApresRattachement>[0],
  rencontreId: string,
): Promise<boolean> {
  return (await completerApresRattachement(db, rencontreId)) !== null;
}
