/**
 * Réseau d'apporteurs — FACTURATION DES COMMISSIONS DÈS QU'ELLES SONT DUES (décision de Will, 06/10).
 *
 * Plus de relevé mensuel ni de seuil de 50 € : dès qu'une commission est `due` (le client a payé sa
 * commande à 100 %, ou la vigilance vient d'être levée), le système :
 *
 *   1. établit l'autofacture PDF de l'apporteur (numéro de la série, R2) — UNE par apporteur et par
 *      passe, qui regroupe toutes ses commissions devenues dues et déduit ses reprises en attente ;
 *   2. l'envoie à l'apporteur avec le décompte (gabarit `apporteur-releve`, réécrit) ;
 *   3. alerte Williams : « À virer : X € à <apporteur> avant le <objectif> » ;
 *   4. laisse la commission `due`, avec `autofactureNumero` posé : c'est ce qui la distingue d'une
 *      commission pas encore facturée. « Virement fait » (`marquerVerse`) la passe `versee`.
 *
 * Deux délais, qu'il ne faut JAMAIS confondre :
 *   · OBJECTIF (sans pénalité ni frais) : virement sous deux jours ouvrés après l'émission ;
 *   · ÉCHÉANCE FERME : trente jours calendaires après l'émission. Aucune pénalité n'est calculée
 *     ici : la loi s'applique, le contrat le dit.
 * La date d'émission n'a pas de colonne : c'est `majAt` de la commission facturée non versée (la
 * seule écriture qu'elle reçoit entre la facturation et le virement). Aucune migration.
 *
 * ⚠️ Atteint par le WORKER (job horaire `reseau-facturation`, tsx hors Next) : aucun `server-only`.
 * Idempotent : toute écriture est conditionnelle, e-mail et alerte ont une clé « une fois ».
 */

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";

import {
  allouerNumeroAutofacture,
  cumulVigilanceCents,
  dejaEnvoye,
  demanderVigilance,
  genererPdfAutofacture,
  moisParis,
  piecesVigilanceValides,
} from "./commissions";
import { dateFr, echeancePaiement, objectifVirement } from "./autofacture-donnees";
import { envoyer, type ResultatEnvoi } from "./envois";
import { etatVigilance, euros } from "./regles";
import { signalerErreurReseau } from "./signaler";

export function jobIdEmailAutofacture(numero: string): string {
  return `apporteur-releve-${numero}`;
}

export function jobIdAlerteAutofacture(numero: string): string {
  return `apporteur-autofacture-alerte-${numero}`;
}

type Db = Pick<typeof prisma, "commissionApporteur">;

/** Lignes à facturer : commissions dues pas encore facturées + reprises pas encore imputées. */
function lireAFacturer(db: Db, apporteurId: string) {
  return db.commissionApporteur.findMany({
    where: {
      apporteurId,
      autofactureNumero: null,
      montantCents: { not: null },
      OR: [{ statut: "due" }, { statut: "reprise", releveMois: null }],
    },
    select: { id: true, statut: true, montantCents: true },
    orderBy: { creeAt: "asc" },
  });
}

export type ResultatFacturation =
  | { ok: true; numero: string; totalCents: number; commissions: number; envoi: ResultatEnvoi }
  | { ok: false; message: string };

/**
 * Facture les commissions dues d'UN apporteur, en une autofacture. `ok: false` quand il n'y a rien
 * à facturer ou que la pièce ne peut pas être établie (identité de facturation, TVA, stockage) :
 * dans ce cas RIEN n'est écrit, et le passage suivant réessaie.
 */
export async function facturerApporteur(
  apporteurId: string,
  maintenant: Date = new Date(),
): Promise<ResultatFacturation> {
  const apporteur = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { id: true, prenom: true, nom: true, email: true },
  });
  if (!apporteur) return { ok: false, message: "Apporteur introuvable." };
  const annee = Number(moisParis(maintenant).slice(0, 4));

  const avant = await lireAFacturer(prisma, apporteurId);
  const dues = avant.filter((c) => c.statut === "due");
  if (dues.length === 0) return { ok: false, message: "Aucune commission due à facturer." };
  const total = avant.reduce((s, c) => s + (c.montantCents ?? 0), 0);
  if (total <= 0) {
    return {
      ok: false,
      message: "Solde nul après déduction des reprises : reporté à la prochaine autofacture.",
    };
  }

  // Vigilance REVÉRIFIÉE à l'émission : une attestation périmée depuis que les commissions sont
  // devenues dues ne doit pas laisser partir une facture au-delà du seuil (art. 5.4 et 6.2).
  const [cumul, valides] = await Promise.all([
    cumulVigilanceCents(apporteurId),
    piecesVigilanceValides(apporteurId, maintenant),
  ]);
  if (etatVigilance({ cumulCents: cumul, nouvelleCents: 0, piecesValides: valides }).attendre) {
    await prisma.commissionApporteur.updateMany({
      where: {
        id: { in: dues.map((d) => d.id) },
        statut: "due",
        autofactureNumero: null,
      },
      data: { statut: "en_attente_vigilance" },
    });
    await demanderVigilance(apporteurId, "premiere");
    return {
      ok: false,
      message:
        "L'attestation de vigilance ou l'immatriculation n'est plus valable : les commissions sont remises en attente de vigilance, rien n'a été facturé.",
    };
  }

  const numero = await allouerNumeroAutofacture(annee);
  const pdf = await genererPdfAutofacture({
    apporteurId,
    numero,
    periodeLibelle: `commissions exigibles au ${dateFr(maintenant)}`,
    commissionIds: avant.map((c) => c.id),
    totalCents: total,
    maintenant,
  });
  if (!pdf) {
    return {
      ok: false,
      message:
        "L'autofacture n'a pas pu être établie (identité de facturation, régime de TVA ou stockage) : rien n'a été facturé, nouvel essai au prochain passage.",
    };
  }

  await prisma.$transaction(
    async (tx) => {
      const lues = await lireAFacturer(tx, apporteurId);
      const memes =
        lues.length === avant.length &&
        lues.every((c, i) => c.id === avant[i]!.id && c.montantCents === avant[i]!.montantCents);
      if (!memes) throw new Error("Les commissions ont changé pendant la facturation : réessai.");
      // Le mois ne sert qu'à marquer la ligne comme imputée (une reprise imputée n'est plus à déduire).
      const commun = { releveMois: moisParis(maintenant), autofactureNumero: numero };
      const dues2 = await tx.commissionApporteur.updateMany({
        where: {
          id: { in: dues.map((c) => c.id) },
          statut: "due",
          autofactureNumero: null,
        },
        data: commun,
      });
      const reprises = await tx.commissionApporteur.updateMany({
        where: {
          id: { in: avant.filter((c) => c.statut === "reprise").map((c) => c.id) },
          statut: "reprise",
          releveMois: null,
        },
        data: commun,
      });
      if (dues2.count + reprises.count !== avant.length)
        throw new Error("Les commissions ont changé pendant la facturation : réessai.");
    },
    { timeout: 15_000 },
  );

  const nom = [decryptPii(apporteur.prenom), decryptPii(apporteur.nom)].filter(Boolean).join(" ");
  let envoi: ResultatEnvoi = "indisponible";
  try {
    envoi = await envoyer({
      gabarit: "apporteur-releve",
      destinataire: decryptPii(apporteur.email) ?? "",
      payload: {
        contactName: nom,
        montant: euros(total),
        numeroAutofacture: numero,
        echeance: dateFr(echeancePaiement(maintenant)),
      },
      entityType: "ApporteurReseau",
      entityId: apporteurId,
      jobId: jobIdEmailAutofacture(numero),
      attachments: [{ filename: pdf.filename, r2Key: pdf.r2Key, contentType: "application/pdf" }],
    });
  } catch (err) {
    signalerErreurReseau("autofacture : e-mail à l'apporteur", err);
  }
  if (envoi === "indisponible") {
    signalerErreurReseau(
      "autofacture : e-mail à l'apporteur non parti",
      new Error(`autofacture ${numero} établie, e-mail non parti`),
    );
  }
  try {
    await alerterAVirer({ apporteurId, nom, numero, totalCents: total, emission: maintenant });
  } catch (err) {
    signalerErreurReseau("autofacture : alerte interne", err);
  }
  return { ok: true, numero, totalCents: total, commissions: dues.length, envoi };
}

/** Alerte interne « À virer », une seule fois par autofacture. */
export async function alerterAVirer(e: {
  apporteurId: string;
  nom: string;
  numero: string;
  totalCents: number;
  emission: Date;
}): Promise<boolean> {
  const jobId = jobIdAlerteAutofacture(e.numero);
  if (await dejaEnvoye(jobId)) return false;
  const objectif = dateFr(objectifVirement(e.emission));
  const echeance = dateFr(echeancePaiement(e.emission));
  const nom = e.nom || "un apporteur";
  const r = await enqueueEmail(
    "qualiopi-alerte-interne",
    destinataireAlertesInternes(),
    "fr",
    {
      niveau: "important",
      code: "apporteur_autofacture_a_virer",
      titre: `À virer : ${euros(e.totalCents)} à ${nom}`,
      message: `À virer : ${euros(e.totalCents)} à ${nom} avant le ${objectif} (objectif de virement). Échéance de paiement : ${echeance}. Autofacture ${e.numero} envoyée à l'apporteur ; une fois le virement fait, cliquez « Virement fait » dans les commissions.`,
      cibleType: "ApporteurReseau",
      cibleId: e.apporteurId,
      createdAt: e.emission.toLocaleDateString("fr-FR"),
    },
    { jobId, entityType: "ApporteurReseau", entityId: e.apporteurId },
  );
  return r.enqueued === true;
}

export interface BilanFacturation {
  autofactures: number;
  commissions: number;
  ecartees: number;
  erreurs: number;
}

/**
 * L'étape « autofacturation » : une autofacture par apporteur ayant des commissions dues pas encore
 * facturées. Une étape en échec pour un apporteur n'empêche pas les autres.
 */
export async function facturerCommissionsDues(
  maintenant: Date = new Date(),
): Promise<BilanFacturation> {
  const bilan: BilanFacturation = { autofactures: 0, commissions: 0, ecartees: 0, erreurs: 0 };
  const g = await prisma.commissionApporteur.groupBy({
    by: ["apporteurId"],
    where: { statut: "due", autofactureNumero: null, montantCents: { not: null } },
  });
  for (const x of g) {
    try {
      const r = await facturerApporteur(x.apporteurId, maintenant);
      if (r.ok) {
        bilan.autofactures += 1;
        bilan.commissions += r.commissions;
      } else {
        bilan.ecartees += 1;
      }
    } catch (err) {
      bilan.erreurs += 1;
      signalerErreurReseau("autofacturation", err);
    }
  }
  return bilan;
}

// ── « Virement fait » ────────────────────────────────────────────────────

/**
 * « Virement fait » : confirme que le virement est parti. Les commissions facturées (statut `due`,
 * `autofactureNumero` posé) passent `versee`, `verseeAt` = maintenant ; les reprises imputées à ces
 * autofactures portent la même date (elles viennent en déduction du versé de l'année, DAS2).
 * AUCUN PDF n'est généré ici.
 *
 * `numero` : une seule autofacture ; sans lui, toutes celles de l'apporteur. RATTRAPAGE : sans
 * `numero`, une commission `due` qui n'a jamais été facturée est d'abord facturée (ancien
 * comportement), pour qu'il n'y ait jamais de versement sans pièce.
 */
export async function marquerVerse(
  apporteurId: string,
  maintenant: Date = new Date(),
  numero?: string,
): Promise<{ ok: true; numeros: string[]; totalCents: number } | { ok: false; message: string }> {
  const apporteur = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { id: true },
  });
  if (!apporteur) return { ok: false, message: "Apporteur introuvable." };

  if (!numero) {
    const sansPiece = await prisma.commissionApporteur.count({
      where: { apporteurId, statut: "due", autofactureNumero: null, montantCents: { not: null } },
    });
    if (sansPiece > 0) {
      const f = await facturerApporteur(apporteurId, maintenant);
      if (!f.ok) return f;
    }
  }

  const lireAVerser = (db: Db) =>
    db.commissionApporteur.findMany({
      where: {
        apporteurId,
        montantCents: { not: null },
        autofactureNumero: numero ? numero : { not: null },
        OR: [{ statut: "due" }, { statut: "reprise", verseeAt: null }],
      },
      select: { id: true, statut: true, montantCents: true, autofactureNumero: true },
      orderBy: { creeAt: "asc" },
    });

  const avant = await lireAVerser(prisma);
  const dues = avant.filter((c) => c.statut === "due");
  if (dues.length === 0) return { ok: false, message: "Aucun virement à confirmer." };
  const total = avant.reduce((s, c) => s + (c.montantCents ?? 0), 0);

  await prisma.$transaction(
    async (tx) => {
      const lues = await lireAVerser(tx);
      const memes =
        lues.length === avant.length &&
        lues.every((c, i) => c.id === avant[i]!.id && c.montantCents === avant[i]!.montantCents);
      if (!memes)
        throw new Error("Les commissions ont changé pendant la confirmation : recommence.");
      const v = await tx.commissionApporteur.updateMany({
        where: { id: { in: dues.map((c) => c.id) }, statut: "due" },
        data: { statut: "versee", verseeAt: maintenant },
      });
      const r = await tx.commissionApporteur.updateMany({
        where: {
          id: { in: avant.filter((c) => c.statut === "reprise").map((c) => c.id) },
          statut: "reprise",
          verseeAt: null,
        },
        data: { verseeAt: maintenant },
      });
      if (v.count + r.count !== avant.length)
        throw new Error("Les commissions ont changé pendant la confirmation : recommence.");
    },
    { timeout: 15_000 },
  );
  const numeros = [
    ...new Set(avant.map((c) => c.autofactureNumero).filter((n): n is string => !!n)),
  ];
  return { ok: true, numeros, totalCents: total };
}

// ── Lecture pour la console ──────────────────────────────────────────────

export interface VirementAFaire {
  apporteurId: string;
  apporteur: string;
  numero: string;
  /** Net : commissions facturées moins reprises imputées à cette autofacture. */
  totalCents: number;
  lignes: number;
  /** Date d'émission de l'autofacture (voir l'en-tête : `majAt`). */
  emissionAt: Date;
}

/** Les autofactures émises dont le virement n'est pas confirmé. */
export async function lireVirementsAFaire(): Promise<VirementAFaire[]> {
  const lignes = await prisma.commissionApporteur.findMany({
    where: {
      autofactureNumero: { not: null },
      montantCents: { not: null },
      OR: [{ statut: "due" }, { statut: "reprise", verseeAt: null }],
    },
    select: {
      apporteurId: true,
      autofactureNumero: true,
      montantCents: true,
      statut: true,
      majAt: true,
      apporteur: { select: { prenom: true, nom: true } },
    },
  });
  const m = new Map<string, VirementAFaire>();
  for (const l of lignes) {
    const numero = l.autofactureNumero!;
    const cur = m.get(numero);
    const nom = [decryptPii(l.apporteur.prenom), decryptPii(l.apporteur.nom)]
      .filter(Boolean)
      .join(" ");
    if (!cur) {
      m.set(numero, {
        apporteurId: l.apporteurId,
        apporteur: nom,
        numero,
        totalCents: l.montantCents ?? 0,
        lignes: 1,
        emissionAt: l.majAt,
      });
    } else {
      cur.totalCents += l.montantCents ?? 0;
      cur.lignes += 1;
      if (l.majAt.getTime() < cur.emissionAt.getTime()) cur.emissionAt = l.majAt;
    }
  }
  // Les plus anciennes d'abord : ce sont les premières à virer.
  return [...m.values()].sort((a, b) => a.emissionAt.getTime() - b.emissionAt.getTime());
}
