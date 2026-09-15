/**
 * Qualiopi — PASSAGE du cron « facture du lendemain » (worker BullMQ, hors Next).
 *
 * À chaque passage :
 *
 *   1. REPRISE des factures que l'automate a émises et laissées incomplètes
 *      (sans PDF, ou sans e-mail préparé) — un worker mort entre le `create` et
 *      la suite, une transaction qui a dépassé son délai. Jamais de seconde
 *      facture : on complète celle qui existe.
 *   2. Pour chaque session réalisée dont le lendemain de la fin est arrivé :
 *      - décision pure (`facture-auto-regles.ts`) ;
 *      - trace de TENTATIVE sur la session, AVANT toute écriture ;
 *      - émission par le MÊME chemin que le bouton « Générer la facture de
 *        formation » (`facture-formation-emission.ts`), qui prend le verrou
 *        consultatif de la session, refuse une seconde facture vivante, et relit
 *        SOUS ce verrou la décision de l'automate (`garde`) ;
 *      - PDF par le même chemin que le bouton ;
 *      - e-mail `facture-envoi` préparé par le même chemin que « Envoyer par
 *        email » (`facture-envoi-email.ts`), avec `exigerValidation` : il attend
 *        dans « E-mails à valider », quelles que soient les règles
 *        d'automatisation. 🛑 Rien ne part à un client sans validation.
 *   3. Horodatage du passage, que l'alerte lit pour dire « le cron ne tourne
 *      plus ».
 *
 * Journal (tous `adminUserId: null`) :
 *   - `qualiopi.facture.generer.auto.tentative` (session) — avant d'émettre ;
 *   - `qualiopi.facture.generer.auto` (facture) — émission réussie ;
 *   - `qualiopi.facture.generer.auto.echec` (session) — refus ou exception, avec
 *     le motif : c'est lui que l'alerte lit, plutôt qu'un seuil en jours ;
 *   - `qualiopi.facture.pdf.generer` et `facturation.email.facture` — les codes
 *     du bouton.
 *
 * 🔴 Une exception n'est JAMAIS lue comme « rien n'a été écrit » : une
 * transaction peut lever après un `create` validé. Les factures incomplètes sont
 * retrouvées par l'état de la base (`facturesSessionIncompletes`), et l'alerte
 * les signale même sans aucun journal.
 *
 * ⚠️ Ce module ne doit mener, par ses imports, ni à `server-only`, ni à
 * `next/headers`, ni à un fichier `"use server"` : le job mourrait en silence.
 * Garde : `facture-auto-session.graphe-worker.spec.ts`.
 */

import { prisma } from "@/lib/prisma";
import {
  chargerSessionsFactureAuto,
  chargerSessionFactureAuto,
  deciderFactureAuto,
  facturesSessionIncompletes,
  ACTION_JOURNAL_FACTURE_AUTO,
  ACTION_JOURNAL_TENTATIVE_FACTURE_AUTO,
  ACTION_JOURNAL_ECHEC_FACTURE_AUTO,
  ACTION_JOURNAL_EMAIL_FACTURE,
  CLE_DERNIER_PASSAGE_FACTURE_AUTO,
  type FactureIncomplete,
} from "@/server/qualiopi/financements/facture-auto-regles";
import {
  emettreFactureFormationSession,
  genererPdfFactureFormation,
} from "@/server/qualiopi/financements/facture-formation-emission";
import { preparerEnvoiFactureEmail } from "@/server/qualiopi/financements/facture-envoi-email";
import { avecVerrouFactureSession } from "@/server/qualiopi/financements/verrou-facture-session";

/**
 * Plafond de factures émises par passage — et, séparément, de factures reprises.
 *
 * 🔴 Ce passage émet des pièces comptables numérotées à de vrais clients. Une
 * borne n'est pas un confort : une dégénérescence (une reprise qui marque cent
 * sessions « réalisées », une borne basse mal réglée) doit se voir dans le
 * journal et s'arrêter d'elle-même, pas s'écouler. 10 : très au-dessus du
 * volume quotidien normal (quelques sessions par semaine). Ce qui déborde est
 * repris au passage suivant — la sélection est un ÉTAT, pas une fenêtre.
 */
export const PLAFOND_FACTURES_AUTO_PAR_PASSAGE = 10;

/**
 * Une facture est reconnue comme émise par l'automate si son journal de
 * génération existe, ou si une TENTATIVE sur sa session la précède de moins de
 * 15 minutes (le processus est mort avant le journal de génération).
 */
const FENETRE_TENTATIVE_MS = 15 * 60_000;

export interface FactureAutoEmise {
  sessionId: string;
  numero: string;
  email: "garee" | "non_preparee";
  motifEmail?: string;
}

export interface BilanFacturesLendemain {
  examinees: number;
  emises: FactureAutoEmise[];
  /** Factures automatiques incomplètes COMPLÉTÉES à ce passage (aucune émission). */
  reprises: FactureAutoEmise[];
  dejaFacturees: number;
  nonAutomatisables: number;
  /** Refus du chemin d'émission lui-même (identité de l'organisme, accord…). */
  refusees: Array<{ sessionId: string; motif: string }>;
  /** Un autre passage (ou un clic) tenait la session : il la traite. */
  verrouPris: number;
  erreurs: number;
  plafondAtteint: boolean;
}

function bilanVide(): BilanFacturesLendemain {
  return {
    examinees: 0,
    emises: [],
    reprises: [],
    dejaFacturees: 0,
    nonAutomatisables: 0,
    refusees: [],
    verrouPris: 0,
    erreurs: 0,
    plafondAtteint: false,
  };
}

/** Journal sans administrateur — best-effort : un log raté n'annule pas la pièce. */
async function journaliser(
  action: string,
  cible: { type: "FactureFormation" | "TrainingSession"; id: string },
  changes: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action,
        targetType: cible.type,
        targetId: cible.id,
        changes: changes as never,
        ipAddress: null,
        userAgent: null,
      },
    });
  } catch (err) {
    console.error(
      `[facture-auto] journal « ${action} » non écrit pour ${cible.id}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Complète une facture : PDF si demandé, puis e-mail garé si demandé. Ne lève
 * pas : ce qui échoue est RENDU, et l'alerte le porte.
 */
async function completerFacture(
  factureId: string,
  a: { pdf: boolean; email: boolean },
): Promise<Pick<FactureAutoEmise, "email" | "motifEmail">> {
  if (a.pdf) {
    const pdf = await genererPdfFactureFormation(factureId);
    if ("error" in pdf) return { email: "non_preparee", motifEmail: pdf.error };
    await journaliser(
      "qualiopi.facture.pdf.generer",
      { type: "FactureFormation", id: factureId },
      { documentId: pdf.data.documentId },
    );
  }
  if (!a.email) return { email: "garee" };

  const envoi = await preparerEnvoiFactureEmail({ factureId }, { exigerValidation: true });
  if ("error" in envoi) return { email: "non_preparee", motifEmail: envoi.error };

  const { to, numero, estAvoir, pdfHash, garePourValidation, enqueued } = envoi.data;
  // Le journal d'e-mail est écrit dès que quelque chose a été fait, garé ou
  // non : il décrit ce qui s'est passé, pas ce qu'on voulait.
  await journaliser(
    ACTION_JOURNAL_EMAIL_FACTURE,
    { type: "FactureFormation", id: factureId },
    { to, numero, estAvoir, pdfHash, automatique: true, garePourValidation },
  );
  if (garePourValidation !== true) {
    // 🛑 Inatteignable tant que `enqueueEmail` honore `exigerValidation`. Si ce
    // n'est plus le cas, c'est l'ordre permanent qui est rompu : on le crie.
    return {
      email: "non_preparee",
      motifEmail: enqueued
        ? "ANOMALIE : l'e-mail est parti SANS validation"
        : "e-mail non garé en validation",
    };
  }
  return { email: "garee" };
}

/**
 * 🔴 REPRISE — les factures que l'automate a émises et laissées incomplètes.
 *
 * ⚠️ Seulement celles de l'AUTOMATE : une facture émise au bouton et restée
 * sans e-mail est un choix humain possible (remise en main propre, dépôt sur une
 * plateforme) ; l'alerte la signale, l'automate n'y touche pas.
 */
async function reprendreFacturesIncompletes(
  now: Date,
  bilan: BilanFacturesLendemain,
): Promise<void> {
  const incompletes = await facturesSessionIncompletes(now);
  if (incompletes.length === 0) return;

  const journaux = await prisma.activityLog.findMany({
    where: {
      OR: [
        { action: ACTION_JOURNAL_FACTURE_AUTO, targetId: { in: incompletes.map((f) => f.id) } },
        {
          action: ACTION_JOURNAL_TENTATIVE_FACTURE_AUTO,
          targetId: { in: [...new Set(incompletes.map((f) => f.sessionId))] },
        },
      ],
    },
    select: { action: true, targetId: true, createdAt: true },
  });
  const automatique = (f: FactureIncomplete) =>
    journaux.some(
      (j) =>
        (j.action === ACTION_JOURNAL_FACTURE_AUTO && j.targetId === f.id) ||
        (j.action === ACTION_JOURNAL_TENTATIVE_FACTURE_AUTO &&
          j.targetId === f.sessionId &&
          j.createdAt.getTime() <= f.createdAt.getTime() + 60_000 &&
          j.createdAt.getTime() >= f.createdAt.getTime() - FENETRE_TENTATIVE_MS),
    );

  for (const f of incompletes.filter(automatique)) {
    if (bilan.reprises.length >= PLAFOND_FACTURES_AUTO_PAR_PASSAGE) {
      bilan.plafondAtteint = true;
      return;
    }
    try {
      const issue = await avecVerrouFactureSession(f.sessionId, async () => {
        // Relue SOUS verrou : un clic « Envoyer par email » a pu passer entre-temps.
        const [actuelle] = await facturesSessionIncompletes(now, { ids: [f.id] });
        if (actuelle === undefined) return null;
        return completerFacture(f.id, { pdf: actuelle.sansPdf, email: actuelle.sansEmail });
      });
      if (!issue.acquis) {
        bilan.verrouPris += 1;
        continue;
      }
      if (issue.valeur !== null) {
        bilan.reprises.push({ sessionId: f.sessionId, numero: f.numero, ...issue.valeur });
      }
    } catch (err) {
      bilan.erreurs += 1;
      console.error(`[facture-auto] reprise de ${f.numero} en erreur:`, message(err));
    }
  }
}

async function consignerPassage(now: Date): Promise<void> {
  try {
    const value = { at: now.toISOString() };
    await prisma.siteSetting.upsert({
      where: { key: CLE_DERNIER_PASSAGE_FACTURE_AUTO },
      create: {
        key: CLE_DERNIER_PASSAGE_FACTURE_AUTO,
        value,
        description:
          "Dernier passage du cron « facture du lendemain ». Lu par l'alerte facture_auto_non_emise pour dire que le cron ne tourne plus.",
        category: "qualiopi",
      },
      update: { value },
    });
  } catch (err) {
    console.warn("[facture-auto] horodatage du passage non écrit (fail-soft):", message(err));
  }
}

/**
 * Le passage du cron. Fail-soft par session : une fiche incomplète ou une
 * erreur n'empêche pas les autres factures du jour.
 */
export async function genererFacturesDuLendemain(
  now: Date = new Date(),
): Promise<BilanFacturesLendemain> {
  const bilan = bilanVide();
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return bilan;

  await reprendreFacturesIncompletes(now, bilan);

  for (const s of await chargerSessionsFactureAuto(now)) {
    const decision = deciderFactureAuto(s, now);
    if (decision.verdict === "attendre" || decision.verdict === "hors_champ") continue;
    bilan.examinees += 1;
    if (decision.verdict === "deja_facturee") {
      bilan.dejaFacturees += 1;
      continue;
    }
    if (decision.verdict === "non_automatisable") {
      bilan.nonAutomatisables += 1;
      continue;
    }
    if (bilan.emises.length >= PLAFOND_FACTURES_AUTO_PAR_PASSAGE) {
      bilan.plafondAtteint = true;
      break;
    }

    await journaliser(
      ACTION_JOURNAL_TENTATIVE_FACTURE_AUTO,
      { type: "TrainingSession", id: s.id },
      { destinataire: decision.destinataire, ventilation: decision.ventilation },
    );

    let verdictSousVerrou: string | null = null;
    try {
      const resultat = await emettreFactureFormationSession(
        { sessionId: s.id, destinataire: decision.destinataire, ventilation: decision.ventilation },
        {
          // 🔑 La décision de l'AUTOMATE, relue SOUS le verrou : une facture, une
          // facture libre ou une fiche modifiée entre la lecture de masse et
          // l'émission fait renoncer.
          garde: async () => {
            const fraiche = await chargerSessionFactureAuto(s.id);
            if (fraiche === null) {
              verdictSousVerrou = "introuvable";
              return "Session introuvable";
            }
            const d = deciderFactureAuto(fraiche, now);
            verdictSousVerrou = d.verdict;
            return d.verdict === "emettre" ? null : `Session plus éligible (${d.verdict})`;
          },
        },
      );

      if ("error" in resultat) {
        if (resultat.code === "verrou_pris") bilan.verrouPris += 1;
        else if (resultat.code === "deja_facturee") bilan.dejaFacturees += 1;
        else if (resultat.code === "garde") {
          if (verdictSousVerrou === "deja_facturee") bilan.dejaFacturees += 1;
          else if (verdictSousVerrou === "non_automatisable") bilan.nonAutomatisables += 1;
        } else {
          bilan.refusees.push({ sessionId: s.id, motif: resultat.error });
          await journaliser(
            ACTION_JOURNAL_ECHEC_FACTURE_AUTO,
            { type: "TrainingSession", id: s.id },
            { motif: resultat.error },
          );
        }
        continue;
      }

      const facture = resultat.data;
      await journaliser(
        ACTION_JOURNAL_FACTURE_AUTO,
        { type: "FactureFormation", id: facture.factureId },
        {
          sessionId: s.id,
          numero: facture.numero,
          destinataire: facture.destinataire,
          ventilation: facture.ventilation,
          totalHtCents: facture.totalHtCents,
        },
      );

      let suite: Pick<FactureAutoEmise, "email" | "motifEmail">;
      try {
        suite = await completerFacture(facture.factureId, { pdf: true, email: true });
      } catch (err) {
        suite = { email: "non_preparee", motifEmail: message(err) };
      }
      bilan.emises.push({ sessionId: s.id, numero: facture.numero, ...suite });
    } catch (err) {
      bilan.erreurs += 1;
      console.error(`[facture-auto] erreur session ${s.id}:`, message(err));
      await journaliser(
        ACTION_JOURNAL_ECHEC_FACTURE_AUTO,
        { type: "TrainingSession", id: s.id },
        { motif: `erreur : ${message(err)}` },
      );
    }
  }

  await consignerPassage(now);
  return bilan;
}

/**
 * La ligne du journal du worker. Les NUMÉROS, pas seulement un compte : « 2
 * émises » ne dit pas quelles pièces viennent de naître, et c'est la première
 * question qu'on se pose en relisant le journal.
 */
export function ligneJournalBilan(b: BilanFacturesLendemain): {
  niveau: "log" | "warn" | "error";
  ligne: string;
} {
  const traitees = [...b.emises, ...b.reprises];
  const nonPreparees = traitees.filter((e) => e.email !== "garee");
  const anomalie = nonPreparees.some((e) => e.motifEmail?.startsWith("ANOMALIE"));
  const parties = [
    `${b.emises.length} facture(s) émise(s)`,
    `${b.reprises.length} reprise(s)`,
    `${traitees.length - nonPreparees.length} e-mail(s) en attente de validation`,
    `${nonPreparees.length} e-mail(s) NON préparé(s)`,
    `${b.nonAutomatisables} non automatisable(s)`,
    `${b.refusees.length} refus`,
    `${b.dejaFacturees} déjà facturée(s)`,
    `${b.verrouPris} tenue(s) par un autre passage`,
    `${b.erreurs} erreur(s)`,
  ];
  let ligne = `[formation-crons] factures-lendemain: ${parties.join(", ")} sur ${b.examinees} session(s)`;
  if (traitees.length > 0) {
    ligne += ` — ${traitees.map((e) => `${e.numero}${e.email === "garee" ? "" : ` (e-mail : ${e.motifEmail ?? "non préparé"})`}`).join(", ")}`;
  }
  if (b.refusees.length > 0) {
    ligne += ` — refus : ${b.refusees.map((r) => `${r.sessionId} (${r.motif})`).join(", ")}`;
  }
  if (b.plafondAtteint) {
    ligne +=
      ` — PLAFOND de ${PLAFOND_FACTURES_AUTO_PAR_PASSAGE} atteint : le reste est repris au ` +
      "passage suivant, et un afflux de cette taille mérite d'être regardé.";
  }
  const niveau =
    anomalie || b.erreurs > 0
      ? "error"
      : nonPreparees.length > 0 || b.refusees.length > 0 || b.plafondAtteint
        ? "warn"
        : "log";
  return { niveau, ligne };
}
