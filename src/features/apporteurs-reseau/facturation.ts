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
 * La date d'émission est `autofactureEmiseAt`, posée à la facturation (repli sur `majAt` pour les
 * lignes facturées avant cette colonne).
 *
 * Reprises (art. 4.5) : chacune donne un AVOIR d'autofacture, PDF numéroté dans la MÊME série,
 * qui renvoie à l'autofacture rectifiée et vient en déduction du virement. L'avoir est émis avec
 * l'autofacture suivante : la ligne garde `autofactureNumero` = l'autofacture d'imputation, et
 * porte `avoirNumero`.
 *
 * Montant à VIRER = TTC de l'autofacture moins TTC des avoirs : pour un apporteur qui facture la
 * TVA, c'est TVA comprise (`aVirerTtcCents`).
 *
 * ⚠️ Atteint par le WORKER (job horaire `reseau-facturation`, tsx hors Next) : aucun `server-only`.
 * Idempotent : toute écriture est conditionnelle, e-mail et alerte ont une clé « une fois ».
 */

import { randomUUID } from "node:crypto";

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { decryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/queue/queues";

import {
  allouerNumerosAutofacture,
  verrouillerSerieAutofacture,
  cumulVigilanceCents,
  dejaEnvoye,
  demanderVigilance,
  genererPdfAutofacture,
  moisParis,
  originesDesReprises,
  piecesVigilanceValides,
} from "./commissions";
import {
  aVirerPartielCents,
  planCompensation,
  totalTtcPieceCents,
  dateFr,
  donneesManquantesAutofacture,
  echeancePaiement,
  libelleMois,
  objectifVirement,
} from "./autofacture-donnees";
import { lireEntrepriseParSiren, type ResultatRegistre } from "./annuaire";
import { envoyer, envoyerConfirmationVirement, type ResultatEnvoi } from "./envois";
import { etatVigilance, euros } from "./regles";
import { horsLitige, litigeDisponible } from "./litige";
import { MESSAGE_EN_ATTENTE_DE_REALISATION, realisationDisponible } from "./realisation";
import { signalerErreurReseau } from "./signaler";

export function jobIdEmailAutofacture(numero: string): string {
  return `apporteur-releve-${numero}`;
}

export function jobIdAlerteAutofacture(numero: string): string {
  return `apporteur-autofacture-alerte-${numero}`;
}

/** Alerte « autofacture en attente » : une par blocage (clé = première commission bloquée). */
export function jobIdAlerteAttente(apporteurId: string, commissionId: string): string {
  return `apporteur-autofacture-attente-${apporteurId}-${commissionId}`;
}

type Db = Pick<typeof prisma, "commissionApporteur">;

/**
 * Scission d'une reprise pour la compensation (art. 12.4) : la ligne garde la part imputée, une
 * nouvelle ligne porte le reste, en attente. Les deux gardent la référence d'origine (`palier`
 * « reprise-de:… ») ; rien n'est supprimé. Rend `false` si la reprise a changé entre-temps.
 */
async function scinderReprise(s: {
  id: string;
  imputeCents: number;
  resteCents: number;
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const o = await tx.commissionApporteur.findUnique({
      where: { id: s.id },
      select: {
        apporteurId: true,
        presentationId: true,
        parrainage: true,
        palier: true,
        statut: true,
        releveMois: true,
        montantCents: true,
        creeAt: true,
      },
    });
    if (
      !o ||
      o.statut !== "reprise" ||
      o.releveMois !== null ||
      Math.abs(o.montantCents ?? 0) !== s.imputeCents + s.resteCents
    )
      return false;
    const u = await tx.commissionApporteur.updateMany({
      where: { id: s.id, statut: "reprise", releveMois: null, montantCents: o.montantCents },
      data: { montantCents: -s.imputeCents },
    });
    if (u.count !== 1) return false;
    await tx.commissionApporteur.create({
      data: {
        apporteurId: o.apporteurId,
        presentationId: o.presentationId,
        factureId: randomUUID(),
        parrainage: o.parrainage,
        activite: "reprise",
        palier: o.palier,
        factureHtCents: 0,
        montantCents: -s.resteCents,
        statut: "reprise",
        // Date d'ORIGINE de la reprise : les délais de l'art. 12.4 ne repartent pas à zéro.
        creeAt: o.creeAt,
      },
      select: { id: true },
    });
    return true;
  });
}

/** Lignes à facturer : commissions dues pas encore facturées + reprises pas encore imputées. */
function lireAFacturer(db: Db, apporteurId: string, hors: Record<string, unknown> = {}) {
  return db.commissionApporteur.findMany({
    where: {
      apporteurId,
      autofactureNumero: null,
      montantCents: { not: null },
      // Une commission suspendue (contestation écrite du client, art. 4.2 bis) n'est pas facturée.
      OR: [
        { statut: "due", ...hors },
        { statut: "reprise", releveMois: null },
      ],
    },
    select: {
      id: true,
      statut: true,
      montantCents: true,
      palier: true,
      autofactureAttenteMotif: true,
      // Reprise libérée après une retenue (art. 4.5 bis) : son avoir est DÉJÀ émis, elle est
      // réimputée sans nouvel avoir.
      avoirNumero: true,
    },
    orderBy: { creeAt: "asc" },
  });
}

type LigneAFacturer = Awaited<ReturnType<typeof lireAFacturer>>[number];
type Origines = Map<string, { numero: string | null; mois: string | null; emission?: Date | null }>;

/** Les reprises regroupées par autofacture d'ORIGINE : un avoir par autofacture rectifiée. */
function grouperReprises(
  reprises: readonly LigneAFacturer[],
  origines: Origines,
): Array<{
  origine: string;
  mois: string | null;
  emission: Date | null;
  lignes: LigneAFacturer[];
}> {
  const groupes = new Map<
    string,
    { origine: string; mois: string | null; emission: Date | null; lignes: LigneAFacturer[] }
  >();
  for (const r of reprises) {
    const o = origines.get(r.id);
    // Une reprise porte toujours sur une commission VERSÉE, donc facturée : l'origine est connue.
    // Par prudence, une origine introuvable fait son propre avoir, sans renvoi inventé.
    const cle = o?.numero ?? `?${r.id}`;
    const g = groupes.get(cle) ?? {
      origine: o?.numero ?? "",
      mois: o?.mois ?? null,
      emission: o?.emission ?? null,
      lignes: [],
    };
    g.lignes.push(r);
    groupes.set(cle, g);
  }
  return [...groupes.values()];
}

export type ResultatFacturation =
  | { ok: true; numero: string; totalCents: number; commissions: number; envoi: ResultatEnvoi }
  | { ok: false; message: string };

/**
 * Facture les commissions dues d'UN apporteur, en une autofacture. `ok: false` quand il n'y a rien
 * à facturer ou que la pièce ne peut pas être établie : RIEN n'est facturé, le passage suivant
 * réessaie. Deux cas :
 *   · une DONNÉE de la fiche manque (TVA, SIREN, adresse) : les commissions restent dues, marquées
 *     « en attente : <ce qui manque> » (visible dans la console), UNE alerte au premier blocage,
 *     aucun PDF tenté ni Sentry ; dès que la fiche est complète, le passage suivant facture ;
 *   · une erreur TECHNIQUE (PDF, stockage) : Sentry et nouvel essai à chaque passage.
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

  // Règle ferme (contrat 2.3, art. 4.2) : rien n'est facturé avant que la prestation soit
  // réalisée. Sans la colonne (worker avant la migration), on ne sait pas : rien n'est facturé.
  if (!(await realisationDisponible())) {
    return { ok: false, message: MESSAGE_EN_ATTENTE_DE_REALISATION };
  }
  const hors = { ...(await horsLitige()), prestationRealiseeAt: { not: null } };
  let avant = await lireAFacturer(prisma, apporteurId, hors);
  let dues = avant.filter((c) => c.statut === "due");
  if (dues.length === 0) return { ok: false, message: "Aucune commission due à facturer." };
  const total = avant.reduce((s, c) => s + (c.montantCents ?? 0), 0);
  // Art. 12.4 : les reprises dépassent les dues → COMPENSATION avec pièces. Les dues sont
  // facturées, les reprises imputées à hauteur exacte (la dernière scindée), le reste attend.
  let compensation = false;
  if (total <= 0) {
    const regime =
      (
        await prisma.apporteurReseau.findUnique({
          where: { id: apporteurId },
          select: { regimeTva: true },
        })
      )?.regimeTva ?? null;
    const originesCompensation = await originesDesReprises(
      avant.filter((c) => c.statut === "reprise" && !c.avoirNumero),
    );
    const plan = planCompensation(
      regime,
      dues.map((d) => d.montantCents ?? 0),
      // Un avoir déjà émis (reprise libérée) n'est jamais scindé, et passe en premier ; les autres
      // sont regroupés comme leurs pièces (une par autofacture d'origine).
      [
        ...avant.filter((c) => c.statut === "reprise" && !!c.avoirNumero),
        ...avant.filter((c) => c.statut === "reprise" && !c.avoirNumero),
      ].map((c) => ({
        ...c,
        scindable: !c.avoirNumero,
        piece: c.avoirNumero
          ? `avoir:${c.avoirNumero}`
          : (originesCompensation.get(c.id)?.numero ?? `?${c.id}`),
      })),
    );
    if (plan && "bloque" in plan) {
      return {
        ok: false,
        message:
          "Un avoir déjà émis dépasse les commissions dues : il sera imputé entier sur une prochaine autofacture ; rien n'est versé d'ici là (art. 12.4).",
      };
    }
    if (!plan) {
      return {
        ok: false,
        message: "Solde nul après déduction des reprises : reporté à la prochaine autofacture.",
      };
    }
    if (plan.scinder && !(await scinderReprise(plan.scinder))) {
      return { ok: false, message: "Les reprises ont changé pendant la compensation : réessai." };
    }
    const garder = new Set([
      ...dues.map((d) => d.id),
      ...plan.imputees,
      ...(plan.scinder ? [plan.scinder.id] : []),
    ]);
    avant = (await lireAFacturer(prisma, apporteurId, hors)).filter((c) => garder.has(c.id));
    dues = avant.filter((c) => c.statut === "due");
    if (dues.length === 0) return { ok: false, message: "Aucune commission due à facturer." };
    compensation = true;
  }
  const idsAvant = new Set(avant.map((c) => c.id));

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

  const attente = await mettreEnAttenteSiIncomplet(apporteurId, dues, maintenant);
  if (attente) return { ok: false, message: attente };

  const reprisesAvant = avant.filter((c) => c.statut === "reprise" && !c.avoirNumero);
  // Avoirs déjà émis (reprise libérée) : imputés ici sous LEUR numéro, aucune nouvelle pièce.
  const dejaEmises = avant.filter((c) => c.statut === "reprise" && !!c.avoirNumero);
  const origines: Origines = reprisesAvant.length
    ? await originesDesReprises(reprisesAvant)
    : new Map();
  const groupes = grouperReprises(reprisesAvant, origines);
  const numeros = await allouerNumerosAutofacture(annee, 1 + groupes.length);
  const numero = numeros[0]!;
  const brut = dues.reduce((s, c) => s + (c.montantCents ?? 0), 0);
  const pdf = await genererPdfAutofacture({
    apporteurId,
    numero,
    periodeLibelle: `commissions exigibles au ${dateFr(maintenant)}`,
    commissionIds: dues.map((c) => c.id),
    totalCents: brut,
    maintenant,
  });
  const avoirsPdf: Array<
    (typeof groupes)[number] & {
      numero: string;
      montant: number;
      pdf: Awaited<ReturnType<typeof genererPdfAutofacture>>;
    }
  > = [];
  for (const [i, g] of groupes.entries()) {
    const numeroAvoir = numeros[i + 1]!;
    const montant = -g.lignes.reduce((s, c) => s + (c.montantCents ?? 0), 0);
    const a = pdf
      ? await genererPdfAutofacture({
          apporteurId,
          numero: numeroAvoir,
          periodeLibelle: `reprise de commissions au ${dateFr(maintenant)}`,
          commissionIds: g.lignes.map((c) => c.id),
          totalCents: montant,
          maintenant,
          avoir: {
            factureInitiale: g.origine || "non retrouvée",
            dateFactureInitiale: g.emission ? dateFr(g.emission) : null,
            imputation: `déduit du virement de l'autofacture N° ${numero}`,
          },
        })
      : null;
    avoirsPdf.push({ ...g, numero: numeroAvoir, montant, pdf: a });
  }
  if (!pdf || avoirsPdf.some((a) => !a.pdf)) {
    return {
      ok: false,
      message:
        "L'autofacture n'a pas pu être établie (identité de facturation, régime de TVA ou stockage) : rien n'a été facturé, nouvel essai au prochain passage.",
    };
  }

  // La somme virée est TVA comprise pour un apporteur assujetti : elle se lit sur les pièces.
  // Un avoir déjà émis compte pour son propre TTC (même calcul que sa pièce).
  const parAvoir = new Map<string, number[]>();
  for (const c of dejaEmises)
    parAvoir.set(c.avoirNumero!, [
      ...(parAvoir.get(c.avoirNumero!) ?? []),
      Math.abs(c.montantCents ?? 0),
    ]);
  const regimeTva =
    dejaEmises.length > 0
      ? ((
          await prisma.apporteurReseau.findUnique({
            where: { id: apporteurId },
            select: { regimeTva: true },
          })
        )?.regimeTva ?? null)
      : null;
  const dejaTtc = [...parAvoir.values()].reduce((s, m) => s + totalTtcPieceCents(regimeTva, m), 0);
  const aVirer =
    pdf.totalTtcCents - avoirsPdf.reduce((s, a) => s + (a.pdf?.totalTtcCents ?? 0), 0) - dejaTtc;
  // Jamais de net négatif (il ferait perdre de l'argent) : la compensation l'empêche ; s'il
  // arrivait quand même, rien n'est émis et le passage suivant recommence.
  if (aVirer < 0) {
    signalerErreurReseau(
      "autofacture : net négatif après arrondi",
      new Error(`apporteur ${apporteurId} : ${aVirer} centimes`),
    );
    return {
      ok: false,
      message: "Net négatif après arrondi : rien n'est émis, nouvel essai au prochain passage.",
    };
  }
  // Compensation intégrale (art. 12.4) : rien à virer. Les dues sont réglées par compensation et
  // les reprises imputées soldées DANS LA TRANSACTION D'ÉMISSION (jamais une autofacture à net
  // nul restée « due ») ; le relevé le dit (autofacture, avoir, net).
  const compense = compensation && aVirer === 0;
  const solde = compense ? { verseeAt: maintenant } : {};

  await prisma.$transaction(
    async (tx) => {
      // Numéros contrôlés SOUS VERROU dans la transaction qui les écrit (jamais deux fois le même).
      await verrouillerSerieAutofacture(tx, numeros);
      // Seules les lignes retenues plus haut (une compensation n'impute pas tout) ; une ligne
      // apparue entre-temps attend le passage suivant.
      const lues = (await lireAFacturer(tx, apporteurId, hors)).filter((c) => idsAvant.has(c.id));
      const memes =
        lues.length === avant.length &&
        lues.every((c, i) => c.id === avant[i]!.id && c.montantCents === avant[i]!.montantCents);
      if (!memes) throw new Error("Les commissions ont changé pendant la facturation : réessai.");
      // Le mois ne sert qu'à marquer la ligne comme imputée (une reprise imputée n'est plus à déduire).
      const commun = {
        releveMois: moisParis(maintenant),
        autofactureNumero: numero,
        autofactureEmiseAt: maintenant,
        autofactureAttenteMotif: null,
        autofactureAttenteDepuis: null,
      };
      // Ligne par ligne, au MONTANT lu : une réduction, une suspension ou une annulation faite
      // pendant la facturation fait échouer l'écriture (réessai), jamais une autofacture à
      // l'ancien montant. Réalisée et non suspendue revérifiées dans l'écriture même.
      const dues2 = { count: 0 };
      for (const c of dues) {
        const r = await tx.commissionApporteur.updateMany({
          where: {
            id: c.id,
            statut: "due",
            autofactureNumero: null,
            montantCents: c.montantCents,
            ...hors,
          },
          data: compense ? { ...commun, statut: "versee", ...solde } : commun,
        });
        dues2.count += r.count;
      }
      let reprises = 0;
      for (const a of avoirsPdf) {
        const r = await tx.commissionApporteur.updateMany({
          where: { id: { in: a.lignes.map((c) => c.id) }, statut: "reprise", releveMois: null },
          data: { ...commun, avoirNumero: a.numero, ...solde },
        });
        reprises += r.count;
      }
      for (const c of dejaEmises) {
        const r = await tx.commissionApporteur.updateMany({
          where: { id: c.id, statut: "reprise", releveMois: null, avoirNumero: c.avoirNumero },
          data: { ...commun, ...solde },
        });
        reprises += r.count;
      }
      if (dues2.count + reprises !== avant.length)
        throw new Error("Les commissions ont changé pendant la facturation : réessai.");
    },
    { timeout: 15_000 },
  );

  const nom = [decryptPii(apporteur.prenom), decryptPii(apporteur.nom)].filter(Boolean).join(" ");
  // Chaque reprise est un AVOIR numéroté, joint à l'e-mail, qui renvoie à l'autofacture rectifiée.
  const avoirs = avoirsPdf.map((a) => {
    const quand = a.emission
      ? ` du ${dateFr(a.emission)}`
      : a.mois
        ? `, émise en ${libelleMois(a.mois)}`
        : "";
    const renvoi = a.origine ? ` (rectifie l'autofacture ${a.origine}${quand})` : "";
    return `Avoir n° ${a.numero} : ${euros(a.montant)} hors taxes, déduit du virement${renvoi}`;
  });
  for (const [n, m] of parAvoir)
    avoirs.push(
      `Avoir n° ${n} (déjà émis) : ${euros(m.reduce((s, x) => s + x, 0))} hors taxes, déduit de ce virement`,
    );
  const montrerSomme = avoirs.length > 0 || aVirer !== brut;
  let envoi: ResultatEnvoi = "indisponible";
  try {
    envoi = await envoyer({
      gabarit: "apporteur-releve",
      destinataire: decryptPii(apporteur.email) ?? "",
      payload: {
        contactName: nom,
        montant: euros(brut),
        numeroAutofacture: numero,
        ...(compense ? {} : { echeance: dateFr(echeancePaiement(maintenant)) }),
        ...(avoirs.length > 0 ? { avoirs } : {}),
        ...(montrerSomme ? { sommeVirement: euros(aVirer) } : {}),
        ...(compense ? { compense: true } : {}),
      },
      entityType: "ApporteurReseau",
      entityId: apporteurId,
      jobId: jobIdEmailAutofacture(numero),
      attachments: [pdf, ...avoirsPdf.map((a) => a.pdf!)].map((x) => ({
        filename: x.filename,
        r2Key: x.r2Key,
        contentType: "application/pdf",
      })),
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
    if (!compense)
      await alerterAVirer({ apporteurId, nom, numero, totalCents: aVirer, emission: maintenant });
  } catch (err) {
    signalerErreurReseau("autofacture : alerte interne", err);
  }
  return { ok: true, numero, totalCents: aVirer, commissions: dues.length, envoi };
}

/** Le registre est relu au plus une fois par heure et par SIREN (passage horaire). */
const CACHE_REGISTRE_MS = 60 * 60 * 1000;
const cacheRegistre = new Map<string, { lu: number; r: ResultatRegistre }>();

/** Pour les tests : oublie les lectures du registre déjà faites. */
export function oublierCacheRegistre(): void {
  cacheRegistre.clear();
}

async function etatAuRegistre(siren: string, maintenant: Date): Promise<ResultatRegistre> {
  const c = cacheRegistre.get(siren);
  if (c && maintenant.getTime() - c.lu < CACHE_REGISTRE_MS) return c.r;
  let r: ResultatRegistre;
  try {
    r = await lireEntrepriseParSiren(siren);
  } catch {
    r = { ok: false, raison: "indisponible" };
  }
  // Une réponse muette n'est pas gardée : le passage suivant redemande.
  if (r.ok || r.raison !== "indisponible")
    cacheRegistre.set(siren, { lu: maintenant.getTime(), r });
  return r;
}

/**
 * Fiche de l'apporteur incomplète pour l'autofacture : marque les commissions dues « en attente »
 * (motif + date du PREMIER blocage, jamais réécrite) et alerte une seule fois. Renvoie le message
 * à afficher, ou `null` quand rien ne manque.
 */
async function mettreEnAttenteSiIncomplet(
  apporteurId: string,
  dues: ReadonlyArray<{ id: string; autofactureAttenteMotif: string | null }>,
  maintenant: Date,
): Promise<string | null> {
  const fiche = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { prenom: true, nom: true, regimeTva: true, siren: true, adresse: true },
  });
  if (!fiche) return null;
  const manques = donneesManquantesAutofacture({
    regimeTva: fiche.regimeTva,
    siren: fiche.siren,
    adresse: decryptPii(fiche.adresse),
  });
  // Fiche complète : l'entreprise doit encore être ACTIVE au registre (ordre de Will, 07/10).
  // Registre muet : on ne marque rien et on ne signale rien, le passage suivant réessaie.
  if (manques.length === 0 && fiche.siren) {
    const r = await etatAuRegistre(fiche.siren, maintenant);
    if (!r.ok && r.raison === "indisponible") {
      return "Autofacture reportée : le registre public ne répond pas, nouvel essai au passage suivant.";
    }
    if (!r.ok) manques.push("SIREN introuvable au registre public");
    else if (!r.entreprise.active) manques.push("entreprise radiée au registre public");
  }
  if (manques.length === 0) return null;
  const motif = manques.join(", ");
  const dejaBloque = dues.some((d) => d.autofactureAttenteMotif);
  const ids = dues.map((d) => d.id);
  const base = { id: { in: ids }, statut: "due" as const, autofactureNumero: null };
  const nouvelles = await prisma.commissionApporteur.updateMany({
    where: { ...base, autofactureAttenteMotif: null },
    data: { autofactureAttenteMotif: motif, autofactureAttenteDepuis: maintenant },
  });
  // Ce qui manque a changé (une donnée complétée, une autre encore absente) : le motif suit.
  await prisma.commissionApporteur.updateMany({
    where: { ...base, autofactureAttenteMotif: { not: motif } },
    data: { autofactureAttenteMotif: motif },
  });
  const premierBlocage = nouvelles.count > 0 && !dejaBloque;
  if (premierBlocage) {
    try {
      const nom = [decryptPii(fiche.prenom), decryptPii(fiche.nom)].filter(Boolean).join(" ");
      await alerterAttente({ apporteurId, nom: nom || "un apporteur", motif, ids, maintenant });
    } catch (err) {
      signalerErreurReseau("autofacture en attente : alerte interne", err);
    }
  }
  return `Autofacture en attente : il manque ${motif}. Complétez la fiche de l'apporteur ; l'autofacture partira d'elle-même au passage suivant (toutes les heures).`;
}

async function alerterAttente(e: {
  apporteurId: string;
  nom: string;
  motif: string;
  ids: readonly string[];
  maintenant: Date;
}): Promise<void> {
  const jobId = jobIdAlerteAttente(e.apporteurId, e.ids[0]!);
  if (await dejaEnvoye(jobId)) return;
  await enqueueEmail(
    "qualiopi-alerte-interne",
    destinataireAlertesInternes(),
    "fr",
    {
      niveau: "important",
      code: "apporteur_autofacture_en_attente",
      titre: `Autofacture en attente : ${e.nom}`,
      message: `L'autofacture de ${e.nom} ne peut pas être établie : il manque ${e.motif}. La commission reste due. Complétez sa fiche dans la console : l'autofacture partira d'elle-même au passage suivant (toutes les heures).`,
      cibleType: "ApporteurReseau",
      cibleId: e.apporteurId,
      createdAt: e.maintenant.toLocaleDateString("fr-FR"),
    },
    { jobId, entityType: "ApporteurReseau", entityId: e.apporteurId },
  );
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
      message: `À virer : ${euros(e.totalCents)} à ${nom} (TVA comprise si l'apporteur la facture) avant le ${objectif} (objectif de virement). Échéance de paiement : ${echeance}. Autofacture ${e.numero} envoyée à l'apporteur ; une fois le virement fait, cliquez « Virement fait » dans les commissions.`,
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
  // Sans la colonne « prestation réalisée », on ne facture rien (contrat 2.3, art. 4.2).
  if (!(await realisationDisponible())) return bilan;
  const g = await prisma.commissionApporteur.groupBy({
    by: ["apporteurId"],
    where: {
      prestationRealiseeAt: { not: null },
      statut: "due",
      autofactureNumero: null,
      montantCents: { not: null },
      ...(await horsLitige()),
    },
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
    select: { id: true, prenom: true, nom: true, email: true, regimeTva: true },
  });
  if (!apporteur) return { ok: false, message: "Apporteur introuvable." };

  if (!numero) {
    const sansPiece = await prisma.commissionApporteur.count({
      where: {
        apporteurId,
        statut: "due",
        autofactureNumero: null,
        montantCents: { not: null },
        ...(await horsLitige()),
        prestationRealiseeAt: { not: null },
      },
    });
    if (sansPiece > 0) {
      const f = await facturerApporteur(apporteurId, maintenant);
      if (!f.ok) return f;
    }
  }

  // Seules les lignes SUSPENDUES (contestation écrite, art. 4.2 bis) restent à verser plus tard :
  // les autres lignes de l'autofacture sont versées (art. 5.4).
  const hors = await horsLitige();
  const lireAVerser = (db: Db) =>
    db.commissionApporteur.findMany({
      where: {
        apporteurId,
        montantCents: { not: null },
        autofactureNumero: numero ? numero : { not: null },
        OR: [
          { statut: "due", ...hors },
          { statut: "reprise", verseeAt: null },
        ],
      },
      select: {
        id: true,
        statut: true,
        montantCents: true,
        autofactureNumero: true,
        avoirNumero: true,
      },
      orderBy: { creeAt: "asc" },
    });

  // Prestation pas encore réalisée sur une commission de ce virement : rien n'est versé (4.2).
  if (!(await realisationDisponible())) {
    return { ok: false, message: MESSAGE_EN_ATTENTE_DE_REALISATION };
  }
  const nonRealisees = await prisma.commissionApporteur.count({
    where: {
      apporteurId,
      statut: "due",
      autofactureNumero: numero ? numero : { not: null },
      prestationRealiseeAt: null,
      ...hors,
    },
  });
  if (nonRealisees > 0) return { ok: false, message: MESSAGE_EN_ATTENTE_DE_REALISATION };

  const avant = await lireAVerser(prisma);
  const dues = avant.filter((c) => c.statut === "due");
  if (dues.length === 0) {
    const suspendues = (await litigeDisponible())
      ? await prisma.commissionApporteur.count({
          where: {
            apporteurId,
            statut: "due",
            autofactureNumero: numero ? numero : { not: null },
            litigeDepuis: { not: null },
          },
        })
      : 0;
    return {
      ok: false,
      message:
        suspendues > 0
          ? "Commission suspendue (contestation écrite du client, art. 4.2 bis) : levez d'abord la suspension avant de confirmer ce virement."
          : "Aucun virement à confirmer.",
    };
  }
  // TVA comprise pour un apporteur assujetti, calculée pièce par pièce comme sur les PDF ; une
  // autofacture dont des lignes sont suspendues est versée PAR COMPLÉMENT (`aVirerPartielCents`).
  const suspendues = await suspenduesParNumero(apporteurId, numero);
  const parFacture = new Map<string, typeof avant>();
  for (const c of avant) {
    const k = c.autofactureNumero ?? "";
    parFacture.set(k, [...(parFacture.get(k) ?? []), c]);
  }
  let total = 0;
  for (const [k, lignes] of parFacture) {
    const p = aVirerPartielCents(apporteur.regimeTva, lignes, suspendues.get(k) ?? []);
    if (!p.partielPossible) {
      return {
        ok: false,
        message:
          "Levez d'abord la suspension : les reprises dépassent les lignes à verser de cette autofacture.",
      };
    }
    total += p.totalCents;
  }
  // Jamais de virement nul ou négatif (il ferait marquer des reprises déduites sans paiement).
  if (total <= 0) {
    return { ok: false, message: "Rien à virer : le total de ce virement n'est pas positif." };
  }
  const aVerser = avant;

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
          id: { in: aVerser.filter((c) => c.statut === "reprise").map((c) => c.id) },
          statut: "reprise",
          verseeAt: null,
        },
        data: { verseeAt: maintenant },
      });
      if (v.count + r.count !== aVerser.length)
        throw new Error("Les commissions ont changé pendant la confirmation : recommence.");
    },
    { timeout: 15_000 },
  );
  const numeros = [
    ...new Set(aVerser.map((c) => c.autofactureNumero).filter((n): n is string => !!n)),
  ];
  // E-mail de confirmation à l'apporteur, une seule fois par virement : jamais bloquant.
  try {
    const destinataire = decryptPii(apporteur.email) ?? "";
    if (destinataire) {
      await envoyerConfirmationVirement({
        apporteurId,
        destinataire,
        contactName: [decryptPii(apporteur.prenom), decryptPii(apporteur.nom)]
          .filter(Boolean)
          .join(" "),
        montant: euros(total),
        numeros,
        dateVirement: dateFr(maintenant),
      });
    }
  } catch (err) {
    signalerErreurReseau("virement fait : e-mail de confirmation", err);
  }
  return { ok: true, numeros, totalCents: total };
}

// ── Lecture pour la console ──────────────────────────────────────────────

export interface VirementAFaire {
  apporteurId: string;
  apporteur: string;
  numero: string;
  /** À virer : TTC de l'autofacture moins TTC des avoirs imputés (TVA comprise si assujetti). */
  totalCents: number;
  lignes: number;
  /** Date d'émission de l'autofacture (`autofactureEmiseAt`, repli `majAt`). */
  emissionAt: Date;
}

/**
 * Montants HT des lignes facturées et SUSPENDUES (contestation, art. 4.2 bis) ou RETENUES
 * (manquement, art. 4.5 bis, neutralisées par un avoir déjà soldé), par numéro d'autofacture :
 * elles sortent du virement, qui se calcule par complément (`aVirerPartielCents`).
 */
async function suspenduesParNumero(
  apporteurId?: string,
  numero?: string,
): Promise<Map<string, number[]>> {
  const out = new Map<string, number[]>();
  const avecLitige = await litigeDisponible();
  const ls = await prisma.commissionApporteur.findMany({
    where: {
      ...(apporteurId ? { apporteurId } : {}),
      autofactureNumero: numero ? numero : { not: null },
      montantCents: { not: null },
      OR: [
        { statut: "retenue" },
        ...(avecLitige ? [{ statut: "due" as const, litigeDepuis: { not: null } }] : []),
      ],
    },
    select: { autofactureNumero: true, montantCents: true },
  });
  for (const l of ls) {
    const k = l.autofactureNumero ?? "";
    out.set(k, [...(out.get(k) ?? []), l.montantCents ?? 0]);
  }
  return out;
}

/** Les autofactures émises dont le virement n'est pas confirmé. */
export async function lireVirementsAFaire(): Promise<VirementAFaire[]> {
  // Une ligne suspendue (contestation écrite, art. 4.2 bis) n'est pas à virer tant qu'elle l'est.
  const hors = await horsLitige();
  const lignes = await prisma.commissionApporteur.findMany({
    where: {
      autofactureNumero: { not: null },
      montantCents: { not: null },
      OR: [
        { statut: "due", ...hors },
        { statut: "reprise", verseeAt: null },
      ],
    },
    select: {
      apporteurId: true,
      autofactureNumero: true,
      avoirNumero: true,
      montantCents: true,
      statut: true,
      majAt: true,
      autofactureEmiseAt: true,
      apporteur: { select: { prenom: true, nom: true, regimeTva: true } },
    },
  });
  const m = new Map<string, VirementAFaire>();
  const parNumero = new Map<string, typeof lignes>();
  for (const l of lignes) {
    const numero = l.autofactureNumero!;
    parNumero.set(numero, [...(parNumero.get(numero) ?? []), l]);
    const cur = m.get(numero);
    const emission = l.autofactureEmiseAt ?? l.majAt;
    const nom = [decryptPii(l.apporteur.prenom), decryptPii(l.apporteur.nom)]
      .filter(Boolean)
      .join(" ");
    if (!cur) {
      m.set(numero, {
        apporteurId: l.apporteurId,
        apporteur: nom,
        numero,
        totalCents: 0,
        lignes: 1,
        emissionAt: emission,
      });
    } else {
      cur.lignes += 1;
      if (emission.getTime() < cur.emissionAt.getTime()) cur.emissionAt = emission;
    }
  }
  const suspendues = await suspenduesParNumero();
  for (const [numero, ls] of parNumero) {
    const p = aVirerPartielCents(ls[0]!.apporteur.regimeTva, ls, suspendues.get(numero) ?? []);
    // Rien à virer tant que la suspension dure (partiel refusé), ou total nul : pas affiché.
    if (!p.partielPossible || p.totalCents <= 0) m.delete(numero);
    else m.get(numero)!.totalCents = p.totalCents;
  }
  // Les plus anciennes d'abord : ce sont les premières à virer.
  return [...m.values()].sort((a, b) => a.emissionAt.getTime() - b.emissionAt.getTime());
}
