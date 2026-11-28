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

import * as Sentry from "@sentry/nextjs";

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
  compensationDeclenchee,
  jourParis,
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
import { paiementIntegralLe } from "./paiement-integral";
import {
  figerPiece,
  piecesFigees,
  piecesFigeesDisponible,
  regimeApplicableAu,
  regimesDesPieces,
} from "./tva-pieces";
import { signalerErreurReseau } from "./signaler";
import { changementIbanActif } from "./interrupteur-changement-iban";
import {
  demandesQuiGelent,
  ecrirePreuveDeCompte,
  lireComptesVirement,
  MESSAGE_GEL,
  tablePreuveDisponible,
  trancherCompte,
  type SaisieCompte,
} from "./virement-compte";

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
        regleAppliquee: true,
        versionContrat: true,
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
        // Relevé mensuel : le reste de la reprise garde la règle de la ligne scindée (aucun calcul).
        regleAppliquee: o.regleAppliquee,
        versionContrat: o.versionContrat,
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
      factureId: true,
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
    select: {
      id: true,
      prenom: true,
      nom: true,
      email: true,
      signeParApporteurAt: true,
      signeParSocieteAt: true,
    },
  });
  if (!apporteur) return { ok: false, message: "Apporteur introuvable." };
  // #2464 point 34 : le mandat d'autofacturation (annexe 2) fait partie du contrat signé par les
  // DEUX parties. Pas de signature complète = aucune autofacture, une alerte console à la place.
  if (!apporteur.signeParApporteurAt || !apporteur.signeParSocieteAt) {
    await signalerMandatNonSigne(apporteurId, apporteur, maintenant);
    return {
      ok: false,
      message:
        "Le mandat d'autofacturation (annexe 2 du contrat) n'est pas signé par les deux parties : aucune autofacture n'est émise.",
    };
  }
  const annee = Number(moisParis(maintenant).slice(0, 4));

  // Règle du 25/11 : la commission est due dès le paiement intégral du client, même si la
  // prestation n'est pas livrée. Aucune condition « réalisée » (la colonne n'est plus lue).
  const hors = await horsLitige();
  let avant = await lireAFacturer(prisma, apporteurId, hors);
  let dues = avant.filter((c) => c.statut === "due");
  if (dues.length === 0) return { ok: false, message: "Aucune commission due à facturer." };
  const paiementIntegral = await paiementIntegralLe(dues.map((c) => c.factureId));
  // Régime de l'autofacture à ÉMETTRE : celui applicable aujourd'hui (changement daté, sinon fiche).
  const regimeEmission = (await regimeApplicableAu(apporteurId, jourParis(maintenant))).regimeTva;
  // Art. 12.4 : les reprises dépassent les dues → COMPENSATION avec pièces. Les dues sont
  // facturées, les reprises imputées à hauteur exacte (la dernière scindée), le reste attend.
  // Chaque reprise porte le régime de SA pièce d'avoir, donc de l'autofacture d'origine (figé).
  const reprisesEnAttente = avant.filter((c) => c.statut === "reprise");
  const originesCompensation = reprisesEnAttente.length
    ? await originesDesReprises(reprisesEnAttente.filter((c) => !c.avoirNumero))
    : new Map();
  const regimesReprises = reprisesEnAttente.length
    ? await regimesDesPieces(
        reprisesEnAttente.map((c) =>
          c.avoirNumero ? c.avoirNumero : (originesCompensation.get(c.id)?.numero ?? ""),
        ),
      )
    : new Map();
  const reprisesAvecRegime = [
    // Un avoir déjà émis (reprise libérée) n'est jamais scindé, et passe en premier ; les autres
    // sont regroupés comme leurs pièces (une par autofacture d'origine).
    ...reprisesEnAttente.filter((c) => !!c.avoirNumero),
    ...reprisesEnAttente.filter((c) => !c.avoirNumero),
  ].map((c) => {
    const numeroPiece = c.avoirNumero
      ? c.avoirNumero
      : (originesCompensation.get(c.id)?.numero ?? "");
    const regime = regimesReprises.get(numeroPiece);
    return {
      ...c,
      scindable: !c.avoirNumero,
      piece: c.avoirNumero ? `avoir:${c.avoirNumero}` : numeroPiece || `?${c.id}`,
      ...(regime !== undefined ? { regime } : {}),
    };
  });
  let compensation = false;
  if (
    compensationDeclenchee(
      regimeEmission,
      dues.map((d) => d.montantCents ?? 0),
      reprisesAvecRegime,
    )
  ) {
    const plan = planCompensation(
      regimeEmission,
      dues.map((d) => d.montantCents ?? 0),
      reprisesAvecRegime,
    );
    if (plan && "bloque" in plan) {
      await signalerSoldeNegatif(apporteurId, dues, avant, maintenant);
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
  // Identifiant propre à CETTE tentative : les PDF sont déposés sous une clé de tentative, puis
  // publiés sous la clé définitive APRÈS le commit (un job concurrent ne l'écrase jamais).
  const tentative = randomUUID().slice(0, 8);
  const pdf = await genererPdfAutofacture({
    tentative,
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
          tentative,
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
  // Chaque avoir déjà émis compte à SON régime (figé sur sa pièce) ; sans pièce lue, celui d'émission.
  const regimesDejaEmis = await regimesDesPieces([...parAvoir.keys()]);
  const dejaTtc = [...parAvoir].reduce(
    (s, [n, m]) =>
      s + totalTtcPieceCents(regimesDejaEmis.has(n) ? regimesDejaEmis.get(n)! : regimeEmission, m),
    0,
  );
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
  // Si la table des pièces existe, le régime et les totaux de CHAQUE pièce sont figés dans la même
  // transaction que l'émission : jamais de PDF sans pièce figée (une écriture en échec = rien d'émis).
  // #2464 point 15 : table illisible = REFUS (jamais une pièce émise sans être figée, sur le régime
  // courant de la fiche). Rien n'est écrit, nouvel essai au prochain passage.
  if (!(await piecesFigeesDisponible())) {
    signalerErreurReseau(
      "autofacture : table des pièces figées illisible, émission refusée",
      new Error(`apporteur ${apporteurId}, autofacture ${numero}`),
    );
    return {
      ok: false,
      message:
        "La table des pièces figées est illisible : rien n'est émis (une pièce non figée n'est jamais émise), nouvel essai au prochain passage.",
    };
  }

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
      {
        await figerPiece(tx, {
          numero,
          apporteurId,
          genre: "facture",
          regimeTva: pdf.regimeTva,
          numeroTva: pdf.numeroTva,
          totalHtCents: pdf.totalHtCents,
          totalTvaCents: pdf.totalTvaCents,
          totalTtcCents: pdf.totalTtcCents,
          emiseAt: maintenant,
        });
        for (const a of avoirsPdf)
          await figerPiece(tx, {
            numero: a.numero,
            apporteurId,
            genre: "avoir",
            regimeTva: a.pdf!.regimeTva,
            numeroTva: a.pdf!.numeroTva,
            totalHtCents: a.pdf!.totalHtCents,
            totalTvaCents: a.pdf!.totalTvaCents,
            totalTtcCents: a.pdf!.totalTtcCents,
            factureRectifiee: a.origine || null,
            emiseAt: maintenant,
          });
      }
    },
    { timeout: 15_000 },
  );

  // Transaction validée : cette tentative est la gagnante, ses PDF prennent la clé définitive.
  const cles = await publierPdfApresCommit([pdf, ...avoirsPdf.map((a) => a.pdf!)], numero);

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
        ...(compense ? {} : { echeance: dateFr(echeancePaiement(maintenant, paiementIntegral)) }),
        ...(avoirs.length > 0 ? { avoirs } : {}),
        ...(montrerSomme ? { sommeVirement: euros(aVirer) } : {}),
        regimeTva: pdf.regimeTva,
        ...(compense ? { compense: true } : {}),
      },
      entityType: "ApporteurReseau",
      entityId: apporteurId,
      jobId: jobIdEmailAutofacture(numero),
      attachments: [pdf, ...avoirsPdf.map((a) => a.pdf!)].map((x) => ({
        filename: x.filename,
        r2Key: cles.get(x.cleDefinitive) ?? x.r2Key,
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
      await alerterAVirer({
        apporteurId,
        nom,
        numero,
        totalCents: aVirer,
        emission: maintenant,
        paiementIntegral,
        regimeTva: pdf.regimeTva,
      });
  } catch (err) {
    signalerErreurReseau("autofacture : alerte interne", err);
  }
  return { ok: true, numero, totalCents: aVirer, commissions: dues.length, envoi };
}

/**
 * Publie, sous leur clé définitive, les PDF déposés sous une clé de tentative (APRÈS le commit).
 * Un échec (deux essais) est signalé à Sentry : la pièce est émise, son PDF reste lisible sous la
 * clé de tentative (rendue ici pour la pièce jointe) et se régénère à la demande. Rend, par clé
 * définitive, la clé à utiliser.
 */
async function publierPdfApresCommit(
  pdfs: ReadonlyArray<{ r2Key: string; cleDefinitive: string; buffer: Buffer }>,
  numero: string,
): Promise<Map<string, string>> {
  const cles = new Map<string, string>();
  const [{ storeAndSignPdf }, { deleteFromR2 }] = await Promise.all([
    import("@/server/qualiopi/documents/render"),
    import("@/lib/r2-storage"),
  ]);
  for (const x of pdfs) {
    if (x.r2Key === x.cleDefinitive) continue;
    let ok = false;
    for (let essai = 0; essai < 2 && !ok; essai++) {
      try {
        ok = (await storeAndSignPdf(x.buffer, x.cleDefinitive)) !== null;
      } catch (err) {
        if (essai === 1) signalerErreurReseau("autofacture : PDF non publié après commit", err);
      }
    }
    if (ok) {
      cles.set(x.cleDefinitive, x.cleDefinitive);
      await deleteFromR2(x.r2Key).catch(() => undefined);
    } else {
      cles.set(x.cleDefinitive, x.r2Key);
      signalerErreurReseau(
        "autofacture : PDF non publié après commit",
        new Error(`autofacture ${numero} émise, PDF resté sous ${x.r2Key}`),
      );
    }
  }
  return cles;
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
/** Alerte interne UNE fois par apporteur : autofacture demandée sans mandat signé. */
async function signalerMandatNonSigne(
  apporteurId: string,
  fiche: { prenom: string | null; nom: string | null },
  maintenant: Date,
): Promise<void> {
  try {
    const jobId = `apporteur-mandat-non-signe-${apporteurId}`;
    if (await dejaEnvoye(jobId)) return;
    const nom =
      [decryptPii(fiche.prenom), decryptPii(fiche.nom)].filter(Boolean).join(" ") || "un apporteur";
    await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: "important",
        code: "apporteur_mandat_autofacture_non_signe",
        titre: `Mandat d'autofacturation non signé : ${nom}`,
        message: `Des commissions de ${nom} sont à facturer, mais le mandat d'autofacturation (annexe 2) n'est pas signé par les deux parties : aucune autofacture n'est émise. À vérifier dans la console avant tout versement.`,
        cibleType: "ApporteurReseau",
        cibleId: apporteurId,
        createdAt: maintenant.toLocaleDateString("fr-FR"),
        rubrique: "apporteurs",
        chemin: `apporteurs/${apporteurId}`,
      },
      { jobId, entityType: "ApporteurReseau", entityId: apporteurId },
    );
  } catch (err) {
    signalerErreurReseau("autofacture : mandat non signé, alerte", err);
  }
}

/** Motif posé sur les dues bloquées par un avoir déjà émis trop gros (art. 12.4). */
export const PREFIXE_MOTIF_SOLDE_NEGATIF = "solde négatif :";

/**
 * Art. 12.4 : un avoir déjà émis dépasse les commissions dues, rien n'est émis. Les dues portent
 * « solde négatif : un avoir de N € reste à compenser » (visible dans la console Commissions), et
 * Williams reçoit UNE alerte par avoir. Le motif s'efface à l'émission suivante.
 */
async function signalerSoldeNegatif(
  apporteurId: string,
  dues: ReadonlyArray<{ id: string }>,
  avant: ReadonlyArray<{ statut: string; avoirNumero: string | null; montantCents: number | null }>,
  maintenant: Date,
): Promise<void> {
  try {
    const parAvoir = new Map<string, number>();
    for (const c of avant)
      if (c.statut === "reprise" && c.avoirNumero)
        parAvoir.set(
          c.avoirNumero,
          (parAvoir.get(c.avoirNumero) ?? 0) + Math.abs(c.montantCents ?? 0),
        );
    const [numero, montant] = [...parAvoir.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    const motif = `${PREFIXE_MOTIF_SOLDE_NEGATIF} un avoir de ${euros(montant)} reste à compenser`;
    const ids = dues.map((d) => d.id);
    const base = { id: { in: ids }, statut: "due" as const, autofactureNumero: null };
    await prisma.commissionApporteur.updateMany({
      where: { ...base, autofactureAttenteMotif: null },
      data: { autofactureAttenteMotif: motif, autofactureAttenteDepuis: maintenant },
    });
    await prisma.commissionApporteur.updateMany({
      where: { ...base, autofactureAttenteMotif: { not: motif } },
      data: { autofactureAttenteMotif: motif },
    });
    const jobId = `apporteur-solde-negatif-${apporteurId}-${numero}`;
    if (await dejaEnvoye(jobId)) return;
    const fiche = await prisma.apporteurReseau.findUnique({
      where: { id: apporteurId },
      select: { prenom: true, nom: true },
    });
    const nom =
      [decryptPii(fiche?.prenom ?? null), decryptPii(fiche?.nom ?? null)]
        .filter(Boolean)
        .join(" ") || "un apporteur";
    await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: "important",
        code: "apporteur_solde_negatif",
        titre: `Solde négatif : ${nom}`,
        message: `L'avoir ${numero} de ${euros(montant)} (déjà émis) dépasse les commissions dues de ${nom} : rien n'est facturé ni versé tant qu'il n'est pas compensé (art. 12.4). Les commissions restent dues ; l'autofacture partira d'elle-même quand elles le couvriront.`,
        cibleType: "ApporteurReseau",
        cibleId: apporteurId,
        createdAt: maintenant.toLocaleDateString("fr-FR"),
        rubrique: "apporteurs",
        chemin: `apporteurs/${apporteurId}`,
      },
      { jobId, entityType: "ApporteurReseau", entityId: apporteurId },
    );
  } catch (err) {
    signalerErreurReseau("solde négatif : signalement", err);
  }
}

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
      rubrique: "apporteurs",
      chemin: `apporteurs/${e.apporteurId}`,
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
  /** Date du paiement intégral du client (le délai de 30 jours court de là). */
  paiementIntegral?: Date | null;
  /** Régime de TVA de la pièce : dit si la somme est « TVA comprise » ou « sans TVA ». */
  regimeTva?: "assujetti" | "franchise_293b" | null;
}): Promise<boolean> {
  const jobId = jobIdAlerteAutofacture(e.numero);
  if (await dejaEnvoye(jobId)) return false;
  const objectif = dateFr(objectifVirement(e.emission));
  const echeance = dateFr(echeancePaiement(e.emission, e.paiementIntegral));
  const nom = e.nom || "un apporteur";
  const r = await enqueueEmail(
    "qualiopi-alerte-interne",
    destinataireAlertesInternes(),
    "fr",
    {
      niveau: "important",
      code: "apporteur_autofacture_a_virer",
      titre: `À virer : ${euros(e.totalCents)} à ${nom}`,
      message: `À virer : ${euros(e.totalCents)} à ${nom} (${e.regimeTva === "assujetti" ? "TVA comprise" : e.regimeTva === "franchise_293b" ? "sans TVA, franchise 293 B" : "TVA comprise si l'apporteur la facture"}) avant le ${objectif} (objectif de virement). Échéance de paiement : ${echeance}. Autofacture ${e.numero} envoyée à l'apporteur ; une fois le virement fait, cliquez « Virement fait » dans les commissions.`,
      cibleType: "ApporteurReseau",
      cibleId: e.apporteurId,
      createdAt: e.emission.toLocaleDateString("fr-FR"),
      rubrique: "apporteurs",
      chemin: `apporteurs/${e.apporteurId}`,
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
    where: {
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

const avoirsDe = (lignes: ReadonlyArray<{ avoirNumero: string | null }>): string[] => [
  ...new Set(lignes.map((l) => l.avoirNumero).filter((n): n is string => !!n)),
];

/**
 * Ce que dit le PDF : TTC de l'autofacture moins TTC de chaque avoir imputé, lus sur les pièces
 * FIGÉES. `null` quand une pièce n'a pas de total figé (reprise à la migration, rattrapage) ou
 * qu'une reprise sans avoir est comptée dans l'autofacture : la garde ne s'applique pas.
 */
function montantDesPdf(
  numero: string,
  lignes: ReadonlyArray<{ statut: string; avoirNumero: string | null }>,
  figeesFactures: Awaited<ReturnType<typeof piecesFigees>>,
  figeesAvoirs: Awaited<ReturnType<typeof piecesFigees>>,
): number | null {
  const f = figeesFactures.get(numero);
  if (!f || f.totalTtcCents === null) return null;
  let total = f.totalTtcCents;
  for (const l of lignes) {
    if (l.statut === "reprise" && !l.avoirNumero) return null;
  }
  for (const n of avoirsDe(lignes)) {
    const a = figeesAvoirs.get(n);
    if (!a || a.totalTtcCents === null) return null;
    total -= a.totalTtcCents;
  }
  return total;
}

/**
 * « Virement fait » : confirme que le virement est parti. Les commissions facturées (statut `due`,
 * `autofactureNumero` posé) passent `versee`, `verseeAt` = maintenant ; les reprises imputées à ces
 * autofactures portent la même date (elles viennent en déduction du versé de l'année, DAS2).
 * AUCUN PDF n'est généré ici.
 *
 * `numero` : une seule autofacture ; sans lui, toutes celles de l'apporteur. RATTRAPAGE : sans
 * `numero`, une commission `due` qui n'a jamais été facturée est d'abord facturée (ancien
 * comportement), pour qu'il n'y ait jamais de versement sans pièce.
 *
 * LOT 7 (changement de compte) :
 *  - REFUSÉ tant qu'une demande de changement de compte de cet apporteur est ouverte (gel calculé à
 *    la lecture, plan §4.2) ; table absente = comportement d'avant ;
 *  - le compte réellement payé est enregistré (empreinte + 4 derniers caractères, jamais l'IBAN) ;
 *    les 4 derniers caractères lus sur le RIB ouvert sont contrôlés (obligatoires interrupteur allumé,
 *    et pendant les 10 jours qui suivent une validation, avec le choix du compte).
 */
/** Un gel apparu pendant la transaction du versement : elle est annulée, rien n'est écrit. */
class GelPendantVersement extends Error {}

export async function marquerVerse(
  apporteurId: string,
  maintenant: Date = new Date(),
  numero?: string,
  compteSaisi: SaisieCompte & { acteurId?: string | undefined } = {},
): Promise<{ ok: true; numeros: string[]; totalCents: number } | { ok: false; message: string }> {
  const apporteur = await prisma.apporteurReseau.findUnique({
    where: { id: apporteurId },
    select: { id: true, prenom: true, nom: true, email: true, regimeTva: true, iban: true },
  });
  if (!apporteur) return { ok: false, message: "Apporteur introuvable." };

  // Gel (lot 7) : AVANT toute lecture de commission et avant le rattrapage de facturation ci-dessous.
  if ((await demandesQuiGelent([apporteurId], maintenant)).has(apporteurId)) {
    return { ok: false, message: MESSAGE_GEL };
  }
  const comptes = await lireComptesVirement(apporteurId, apporteur.iban, maintenant);
  const compte = trancherCompte(comptes, compteSaisi, changementIbanActif());
  if (!compte.ok) return compte;

  if (!numero) {
    const sansPiece = await prisma.commissionApporteur.count({
      where: {
        apporteurId,
        statut: "due",
        autofactureNumero: null,
        montantCents: { not: null },
        ...(await horsLitige()),
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
  // Le régime de CHAQUE PIÈCE (figé à son émission) : le virement suit le PDF, jamais la fiche.
  // Sans pièce lue (table absente, pièce d'avant), repli sur la fiche : le comportement d'avant.
  const regimes = await regimesDesPieces(
    avant.flatMap((c) => [c.autofactureNumero, c.avoirNumero]).filter((n): n is string => !!n),
  );
  const figees = await piecesFigees([...parFacture.keys()].filter((k) => k !== ""));
  let total = 0;
  for (const [k, lignes] of parFacture) {
    const regimeFacture = regimes.has(k) ? regimes.get(k)! : apporteur.regimeTva;
    const p = aVirerPartielCents(
      {
        facture: regimeFacture,
        avoir: (n) => (regimes.has(n) ? regimes.get(n)! : regimeFacture),
      },
      lignes,
      suspendues.get(k) ?? [],
    );
    if (!p.partielPossible) {
      return {
        ok: false,
        message:
          "Levez d'abord la suspension : les reprises dépassent les lignes à verser de cette autofacture.",
      };
    }
    // Garde « le virement suit le PDF » : sans ligne suspendue, le montant recalculé DOIT être celui
    // des pièces figées (autofacture moins avoirs). Jamais un virement différent du PDF.
    // Seulement si TOUTES les lignes de la pièce sont à verser ici : après un versement partiel
    // (une ligne suspendue puis levée), les lignes restantes ne valent plus le PDF entier.
    const autres = await prisma.commissionApporteur.count({
      where: { autofactureNumero: k, id: { notIn: lignes.map((l) => l.id) } },
    });
    const attendu =
      autres === 0 ? montantDesPdf(k, lignes, figees, await piecesFigees(avoirsDe(lignes))) : null;
    if ((suspendues.get(k) ?? []).length === 0 && attendu !== null && attendu !== p.totalCents) {
      signalerErreurReseau(
        "virement : le montant recalculé ne correspond pas au PDF",
        new Error(`autofacture ${k} : ${p.totalCents} centimes recalculés, ${attendu} sur le PDF`),
      );
      return {
        ok: false,
        message: `Le montant recalculé ne correspond pas à l'autofacture N° ${k} : signalé, rien n'est confirmé.`,
      };
    }
    total += p.totalCents;
  }
  // Jamais de virement nul ou négatif (il ferait marquer des reprises déduites sans paiement).
  if (total <= 0) {
    return { ok: false, message: "Rien à virer : le total de ce virement n'est pas positif." };
  }
  const aVerser = avant;
  const numerosVerses = [
    ...new Set(aVerser.map((c) => c.autofactureNumero).filter((n): n is string => !!n)),
  ];
  // Preuve du compte payé : sondée AVANT la transaction (une table absente la ferait échouer).
  const preuve = compte.compte?.empreinte && (await tablePreuveDisponible()) ? compte.compte : null;
  // Compte lu mais aucune empreinte : `IBAN_EMPREINTE_SECRET` manque. Le virement est gardé, mais la
  // preuve du compte payé n'est pas écrite : on le signale (Sentry + journal), sans donnée personnelle.
  if (compte.compte && !compte.compte.empreinte) {
    console.warn(
      "[apporteurs] IBAN_EMPREINTE_SECRET absent : virement gardé, preuve du compte payé non écrite",
    );
    try {
      Sentry.captureMessage(
        "apporteurs : IBAN_EMPREINTE_SECRET absent, preuve du compte non écrite",
        { level: "warning", tags: { service: "apporteurs", etape: "virement-fait" } },
      );
    } catch {
      // Sentry muet : rien d'autre à faire.
    }
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // Seconde lecture du gel, DANS la transaction du versement : une demande ouverte entre le premier
        // contrôle et l'écriture est vue ici, et rien n'est écrit.
        if ((await demandesQuiGelent([apporteurId], new Date(), tx)).has(apporteurId)) {
          throw new GelPendantVersement();
        }
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
        if (preuve) {
          await ecrirePreuveDeCompte(tx, {
            apporteurId,
            numeros: numerosVerses,
            verseAt: maintenant,
            compte: { fin4: preuve.fin4, empreinte: preuve.empreinte! },
            declarePar: compteSaisi.acteurId ?? "console",
          });
        }
      },
      { timeout: 15_000 },
    );
  } catch (err) {
    if (err instanceof GelPendantVersement) return { ok: false, message: MESSAGE_GEL };
    throw err;
  }
  const numeros = numerosVerses;
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
        ...(compte.compte ? { compteFin: compte.compte.fin4 } : {}),
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
  /** Paiement intégral du client (le délai de 30 jours court de là), s'il est connu. */
  paiementIntegralAt: Date | null;
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
      factureId: true,
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
        paiementIntegralAt: null,
      });
    } else {
      cur.lignes += 1;
      if (emission.getTime() < cur.emissionAt.getTime()) cur.emissionAt = emission;
    }
  }
  const suspendues = await suspenduesParNumero();
  // Le régime de chaque PIÈCE (figé) ; sans pièce lue, celui de la fiche (comportement d'avant).
  const regimes = await regimesDesPieces(
    lignes.flatMap((l) => [l.autofactureNumero, l.avoirNumero]).filter((n): n is string => !!n),
  );
  for (const [numero, ls] of parNumero) {
    const v = m.get(numero);
    if (v) v.paiementIntegralAt = await paiementIntegralLe(ls.map((x) => x.factureId));
    const fiche = ls[0]!.apporteur.regimeTva;
    const regimeFacture = regimes.has(numero) ? regimes.get(numero)! : fiche;
    const p = aVirerPartielCents(
      {
        facture: regimeFacture,
        avoir: (n) => (regimes.has(n) ? regimes.get(n)! : regimeFacture),
      },
      ls,
      suspendues.get(numero) ?? [],
    );
    // Rien à virer tant que la suspension dure (partiel refusé), ou total nul : pas affiché.
    if (!p.partielPossible || p.totalCents <= 0) m.delete(numero);
    else m.get(numero)!.totalCents = p.totalCents;
  }
  // Les plus anciennes d'abord : ce sont les premières à virer.
  return [...m.values()].sort((a, b) => a.emissionAt.getTime() - b.emissionAt.getTime());
}
