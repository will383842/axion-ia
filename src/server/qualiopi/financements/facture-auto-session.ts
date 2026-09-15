/**
 * Qualiopi — PASSAGE du cron « facture du lendemain » (worker BullMQ, hors Next).
 *
 * Pour chaque session réalisée dont le lendemain de la fin est arrivé :
 *
 *   1. décision pure (`facture-auto-regles.ts`) ;
 *   2. SOUS VERROU CONSULTATIF par session, décision RELUE, puis émission par le
 *      MÊME chemin que le bouton « Générer la facture de formation »
 *      (`facture-formation-emission.ts`) — même numérotation légale continue,
 *      même acheteur, même facturation par créance ;
 *   3. PDF par le même chemin que le bouton ;
 *   4. e-mail `facture-envoi` préparé par le même chemin que « Envoyer par
 *      email » (`facture-envoi-email.ts`), avec `exigerValidation` : il attend
 *      dans « E-mails à valider », quelles que soient les règles
 *      d'automatisation. 🛑 Rien ne part à un client sans validation.
 *
 * Journal : `qualiopi.facture.generer.auto`, `qualiopi.facture.pdf.generer` et
 * `facturation.email.facture`, tous `adminUserId: null` — ce sont les codes du
 * bouton, sauf le premier, distinct pour qu'on sache sans ambiguïté qu'aucun
 * humain n'a déclenché l'émission.
 *
 * ## 🔴 Pourquoi un verrou, et pas seulement « une facture existe-t-elle ? »
 *
 * Lire puis écrire se traverse à deux : deux passages simultanés (un worker qui
 * redémarre pendant un déploiement, deux conteneurs pendant la bascule) lisent
 * « aucune facture », et chacun en émet une — deux numéros de la série légale
 * consommés pour une seule prestation, dont l'un devra être annulé par avoir.
 * Aucune contrainte de base ne l'interdit (une session peut légitimement porter
 * plusieurs factures : une par créance), et en poser une demanderait une
 * migration. `pg_try_advisory_xact_lock` sur la session sérialise les passages
 * SANS migration ; le verrou tient le temps de la seule émission (quelques
 * requêtes), jamais du rendu PDF, et se relâche au commit.
 *
 * ⚠️ Le bouton manuel ne prend PAS ce verrou : son comportement est inchangé.
 * Un clic humain à la seconde exacte du passage reste théoriquement possible ;
 * le passage est quotidien, à heure fixe, et relit l'état sous verrou.
 *
 * ⚠️ Ce module ne doit mener, par ses imports, ni à `server-only`, ni à
 * `next/headers`, ni à un fichier `"use server"` : le job mourrait en silence.
 * Garde : `facture-auto-session.graphe-worker.spec.ts`.
 */

import { prisma } from "@/lib/prisma";
import {
  chargerSessionsFactureAuto,
  deciderFactureAuto,
  SESSION_FACTURE_AUTO_SELECT,
  ACTION_JOURNAL_FACTURE_AUTO,
  ACTION_JOURNAL_EMAIL_FACTURE,
  type SessionFactureAuto,
} from "@/server/qualiopi/financements/facture-auto-regles";
import {
  emettreFactureFormationSession,
  genererPdfFactureFormation,
  type FactureSessionEmise,
  type ResultatEmission,
} from "@/server/qualiopi/financements/facture-formation-emission";
import { preparerEnvoiFactureEmail } from "@/server/qualiopi/financements/facture-envoi-email";

/**
 * Plafond de factures émises par passage.
 *
 * 🔴 Ce passage émet des pièces comptables numérotées à de vrais clients. Une
 * borne n'est pas un confort : une dégénérescence (une reprise qui marque cent
 * sessions « réalisées », une borne basse mal réglée) doit se voir dans le
 * journal et s'arrêter d'elle-même, pas s'écouler. 10 : très au-dessus du
 * volume quotidien normal (quelques sessions par semaine). Ce qui déborde est
 * repris au passage suivant — la sélection est un ÉTAT, pas une fenêtre.
 */
export const PLAFOND_FACTURES_AUTO_PAR_PASSAGE = 10;

export interface FactureAutoEmise {
  sessionId: string;
  numero: string;
  email: "garee" | "non_preparee";
  motifEmail?: string;
}

export interface BilanFacturesLendemain {
  examinees: number;
  emises: FactureAutoEmise[];
  dejaFacturees: number;
  nonAutomatisables: number;
  /** Refus du chemin d'émission lui-même (identité de l'organisme, accord…). */
  refusees: Array<{ sessionId: string; motif: string }>;
  /** Un autre passage tenait la session : il la traite, celui-ci s'abstient. */
  verrouPris: number;
  erreurs: number;
  plafondAtteint: boolean;
}

function bilanVide(): BilanFacturesLendemain {
  return {
    examinees: 0,
    emises: [],
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
  factureId: string,
  changes: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: null,
        action,
        targetType: "FactureFormation",
        targetId: factureId,
        changes: changes as never,
        ipAddress: null,
        userAgent: null,
      },
    });
  } catch (err) {
    console.error(
      `[facture-auto] journal « ${action} » non écrit pour ${factureId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

type IssueVerrou =
  | { etat: "verrou_pris" }
  | { etat: "introuvable" }
  | { etat: "plus_eligible"; verdict: string }
  | { etat: "tentee"; resultat: ResultatEmission<FactureSessionEmise> };

/**
 * Relit la session SOUS VERROU et n'émet que si la décision tient toujours.
 *
 * `pg_try_advisory_xact_lock` et non `pg_advisory_xact_lock` : un passage qui
 * trouve la session tenue ne doit pas attendre pour ensuite constater qu'elle
 * est facturée — il s'abstient, et le suivant relira l'état.
 */
async function emettreSousVerrou(sessionId: string, now: Date): Promise<IssueVerrou> {
  const cle = `facture_auto_session:${sessionId}`;
  return prisma.$transaction(
    async (tx) => {
      const lignes = await tx.$queryRaw<Array<{ acquis: boolean }>>`
        SELECT pg_try_advisory_xact_lock(hashtext(${cle})) AS acquis`;
      if (lignes[0]?.acquis !== true) return { etat: "verrou_pris" } as const;

      const fraiche = await prisma.trainingSession.findUnique({
        where: { id: sessionId },
        select: SESSION_FACTURE_AUTO_SELECT,
      });
      if (fraiche === null) return { etat: "introuvable" } as const;
      const decision = deciderFactureAuto(fraiche as unknown as SessionFactureAuto, now);
      if (decision.verdict !== "emettre") {
        return { etat: "plus_eligible", verdict: decision.verdict } as const;
      }
      const resultat = await emettreFactureFormationSession({
        sessionId,
        destinataire: decision.destinataire,
        ventilation: decision.ventilation,
      });
      return { etat: "tentee", resultat } as const;
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

/** PDF puis e-mail garé. Ne lève pas : ce qui échoue est RENDU, et l'alerte le porte. */
async function pdfPuisEmail(
  facture: FactureSessionEmise,
): Promise<Pick<FactureAutoEmise, "email" | "motifEmail">> {
  const pdf = await genererPdfFactureFormation(facture.factureId);
  if ("error" in pdf) return { email: "non_preparee", motifEmail: pdf.error };
  await journaliser("qualiopi.facture.pdf.generer", facture.factureId, {
    documentId: pdf.data.documentId,
  });

  const envoi = await preparerEnvoiFactureEmail(
    { factureId: facture.factureId },
    { exigerValidation: true },
  );
  if ("error" in envoi) return { email: "non_preparee", motifEmail: envoi.error };

  const { to, numero, estAvoir, pdfHash, garePourValidation, enqueued } = envoi.data;
  // Le journal d'e-mail est écrit dès que quelque chose a été fait, garé ou
  // non : il décrit ce qui s'est passé, pas ce qu'on voulait.
  await journaliser(ACTION_JOURNAL_EMAIL_FACTURE, facture.factureId, {
    to,
    numero,
    estAvoir,
    pdfHash,
    automatique: true,
    garePourValidation,
  });
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
 * Le passage du cron. Fail-soft par session : une fiche incomplète ou une
 * erreur n'empêche pas les autres factures du jour.
 */
export async function genererFacturesDuLendemain(
  now: Date = new Date(),
): Promise<BilanFacturesLendemain> {
  const bilan = bilanVide();
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return bilan;

  const sessions = await chargerSessionsFactureAuto(now);
  for (const s of sessions) {
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

    try {
      const issue = await emettreSousVerrou(s.id, now);
      if (issue.etat === "verrou_pris") {
        bilan.verrouPris += 1;
        continue;
      }
      if (issue.etat === "introuvable") continue;
      if (issue.etat === "plus_eligible") {
        if (issue.verdict === "deja_facturee") bilan.dejaFacturees += 1;
        else if (issue.verdict === "non_automatisable") bilan.nonAutomatisables += 1;
        continue;
      }
      if ("error" in issue.resultat) {
        bilan.refusees.push({ sessionId: s.id, motif: issue.resultat.error });
        continue;
      }

      const facture = issue.resultat.data;
      await journaliser(ACTION_JOURNAL_FACTURE_AUTO, facture.factureId, {
        sessionId: s.id,
        numero: facture.numero,
        destinataire: facture.destinataire,
        ventilation: facture.ventilation,
        totalHtCents: facture.totalHtCents,
      });

      let suite: Pick<FactureAutoEmise, "email" | "motifEmail">;
      try {
        suite = await pdfPuisEmail(facture);
      } catch (err) {
        suite = {
          email: "non_preparee",
          motifEmail: err instanceof Error ? err.message : String(err),
        };
      }
      bilan.emises.push({ sessionId: s.id, numero: facture.numero, ...suite });
    } catch (err) {
      bilan.erreurs += 1;
      console.error(
        `[facture-auto] erreur session ${s.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }
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
  const nonPreparees = b.emises.filter((e) => e.email !== "garee");
  const anomalie = nonPreparees.some((e) => e.motifEmail?.startsWith("ANOMALIE"));
  const parties = [
    `${b.emises.length} facture(s) émise(s)`,
    `${b.emises.length - nonPreparees.length} e-mail(s) en attente de validation`,
    `${nonPreparees.length} e-mail(s) NON préparé(s)`,
    `${b.nonAutomatisables} non automatisable(s)`,
    `${b.refusees.length} refus`,
    `${b.dejaFacturees} déjà facturée(s)`,
    `${b.verrouPris} tenue(s) par un autre passage`,
    `${b.erreurs} erreur(s)`,
  ];
  let ligne = `[formation-crons] factures-lendemain: ${parties.join(", ")} sur ${b.examinees} session(s)`;
  if (b.emises.length > 0) {
    ligne += ` — ${b.emises.map((e) => `${e.numero}${e.email === "garee" ? "" : ` (e-mail : ${e.motifEmail ?? "non préparé"})`}`).join(", ")}`;
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
