// Banc @formateurs, équipe ARGENT — l'EXÉCUTEUR côté serveur, lancé par `tsx`.
//
// Pourquoi un processus à part : voir `serveur/executer.ts` (Playwright ne charge pas
// `@sentry/nextjs`). Ce fichier joue une LISTE d'étapes (`argent-protocole.ts`) contre
// le code serveur RÉEL et la base du banc, puis rend une ligne
// `@@BANC-ARGENT@@[résultats]` sur la sortie standard.
//
// Ce qui est simulé ici, et rien d'autre :
//   · le RÉSEAU : coupé (`reseau-simule.ts`, aucune route servie). Telegram, le
//     registre des entreprises… échouent comme une coupure, que le code traite
//     déjà en « au mieux ». Aucun test d'argent n'atteint un vrai service ;
//   · les GESTES HUMAINS sans service hors session (valider un relevé) : l'étape écrit
//     l'effet exact du clic, documenté dans le protocole ;
//   · la date de bascule et la population des passages globaux, restreintes au test.
// La file d'e-mails est RÉELLE (Redis du job, worker en tâche de fond, puits SMTP).
// L'horloge n'est jamais truquée : chaque étape reçoit son `maintenant`.

import { prisma } from "@/lib/prisma";
import { encryptPii } from "@/lib/pii-crypto";
import { empreinteIban } from "@/lib/iban-empreinte";
import { empreinteAttendue } from "@/server/email/textes-formateurs-a-valider";
import { lireVirementsSortants } from "@/server/paiements-sortants/virements";
import {
  emettreAutofacture,
  journalSysteme,
} from "@/server/qualiopi/remuneration/autofacture-emission";
import { echeanceEffective } from "@/server/qualiopi/remuneration/echeance";
import { runRemunerationMensuelle } from "@/server/qualiopi/remuneration/statements";
import { contresignerDemiJournee } from "@/server/qualiopi/emargement/contresignature-service";
import { envoyerDemandesContresignature } from "@/server/qualiopi/emargement/demande-contresignature";
import { signerCreneau } from "@/server/qualiopi/emargement/signature-service";
import { creerTokenInscription } from "@/server/qualiopi/emargement/token-service";
import {
  enregistrerAvisFormateur,
  terminerBilanFormateur,
} from "@/server/qualiopi/formateurs-independants/bilan-fin-formation/service";
import {
  demanderChangementIban,
  validerDemandeChangement,
} from "@/server/qualiopi/formateurs-independants/changements-coordonnees";
import { ecrireIndemniteDecidee } from "@/server/qualiopi/formateurs-independants/paiement/indemnite-annulation-base";
import { uniqueHistoriqueRetire } from "@/server/qualiopi/formateurs-independants/paiement/lecture-passage";
import { passerPaiementsMission } from "@/server/qualiopi/formateurs-independants/paiement/passage-mission";
import {
  ecrireMoisMission,
  lireCandidats,
} from "@/server/qualiopi/formateurs-independants/paiement/passage-mission-base";
import { calculerReleveDuMois } from "@/server/qualiopi/formateurs-independants/argent/calcul-mission";
import { emettreAvoirMission } from "@/server/qualiopi/formateurs-independants/paiement/corrections-mission";
import { signalerDesaccord } from "@/server/qualiopi/formateurs-independants/paiement/desaccord-mission";
import { ecrireMoisDansTransaction } from "@/server/qualiopi/formateurs-independants/paiement/passage-mission-base";
import { demiJourneesSignees, parMoisCivil } from "@/server/qualiopi/remuneration/heures-animees";
import { prendreVerrousRemuneration } from "@/server/qualiopi/remuneration/verrou-remuneration";
import { passerSuiviMission } from "@/server/qualiopi/formateurs-independants/paiement/suivi-mission";
import { contexteVirementMission } from "@/server/qualiopi/formateurs-independants/paiement/virement-mission-base";
import {
  envoyerVirementEnAttente,
  envoyerVirementsFaits,
  reprendreVirementsFaitsSansF37,
} from "@/server/qualiopi/formateurs-independants/paiement/virement-fait-envoi";
import { lirePiecesSuivies } from "@/server/qualiopi/formateurs-independants/mon-dossier";
import {
  etatPiece,
  libelleEtatPiece,
} from "@/server/qualiopi/formateurs-independants/pieces-a-renouveler";
import { apresDecisionPiece } from "@/server/qualiopi/formateurs-independants/pieces-decision";
import { apercu } from "@/server/qualiopi/formateurs-independants/envois";
import { emailsQueue } from "@/server/queue/queues";
import { passerCampagnes } from "@/server/relances/passer-campagnes";
import { REGISTRE_CAMPAGNES } from "@/server/relances/registre-campagnes";

import { MARQUEUR_RESULTAT_ARGENT, type EntreeArgent, type EtapeArgent } from "./argent-protocole";
import { installerReseauSimule } from "./reseau-simule";

/** ⛔ Jamais ailleurs que sur une base locale : le banc écrit. */
function exigerBaseLocale(): void {
  let hote = "";
  try {
    hote = new URL(process.env["DATABASE_URL"] ?? "").hostname;
  } catch {
    // illisible : refusé ci-dessous
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(hote)) {
    throw new Error(`banc @formateurs (argent) : base non locale refusée (« ${hote || "?"} »)`);
  }
}

const quand = (iso: string) => new Date(iso);

/**
 * F36 joint sa facture depuis R2. Sans seau, le worker REFUSE l'envoi, à bon droit, puis
 * BullMQ le RETENTE cinq fois (avec le stockage R2 simulé du banc, il peut partir du
 * premier coup : rien ne change alors ici). Chaque tentative consomme une place du
 * bridage du worker (40 e-mails par heure, pour TOUT le banc) : cinq tentatives par
 * facture affameraient les envois des autres scénarios. Le job est donc retiré de la
 * file après sa PREMIÈRE tentative (une place), une fois que le banc l'a vu partir.
 * Le journal des envois garde sa ligne ; le spec lit le job (`jobF36`) dans la copie
 * gardée ici, sous la clé `banc:argent:f36:<relevé>`.
 */
async function retirerF36ApresUnRefus(statementId: string): Promise<void> {
  const r = await prisma.trainerStatement.findUnique({
    where: { id: statementId },
    select: { trainer: { select: { email: true } } },
  });
  const ligne = await prisma.emailLog.findFirst({
    where: { recipient: r?.trainer.email ?? "", template: "autofacture-transmission" },
    orderBy: { createdAt: "desc" },
    select: { jobId: true },
  });
  if (!emailsQueue || !ligne?.jobId) return;
  const job = await emailsQueue.getJob(ligne.jobId);
  if (!job) return;
  const client = await emailsQueue.client;
  // Le Redis du job est éphémère : la copie disparaît avec lui.
  await client.set(`banc:argent:f36:${statementId}`, JSON.stringify(job.data));
  const limite = Date.now() + 30_000;
  while (Date.now() < limite) {
    const etat = await job.getState();
    const relu = await emailsQueue.getJob(ligne.jobId);
    if (etat !== "active" && (relu?.attemptsMade ?? 0) >= 1) break;
    if (etat === "completed" || etat === "failed") break;
    await new Promise((res) => setTimeout(res, 250));
  }
  await job.remove().catch(() => undefined);
}

/**
 * Joue `fn` en RETENANT SEULEMENT LES ENVOIS qu'elle enfile (V1-C-11, voir le protocole) :
 * ces jobs sont posés en différé, puis promus une fois `fn` terminée, quand leur ligne
 * « pending » est écrite. La file d'e-mails étant PARTAGÉE avec les autres équipes du
 * job, elle n'est jamais mise en pause : les envois des autres scénarios continuent de
 * partir pendant ce temps. Seul `add` de CE processus est enveloppé.
 */
async function sousWorkerRetenu<T>(fn: () => Promise<T>): Promise<T> {
  if (!emailsQueue) return fn();
  const file = emailsQueue;
  const ajouter = file.add.bind(file);
  const retenus: Array<{ promote: () => Promise<void> }> = [];
  (file as { add: unknown }).add = async (nom: string, donnees: unknown, opts?: object) => {
    const job = await (ajouter as (...a: unknown[]) => Promise<{ promote: () => Promise<void> }>)(
      nom,
      donnees,
      { ...opts, delay: 3_600_000 },
    );
    retenus.push(job);
    return job;
  };
  try {
    return await fn();
  } finally {
    (file as { add: unknown }).add = ajouter;
    for (const job of retenus) await job.promote().catch(() => undefined);
  }
}

async function jouerCorrection(e: Extract<EtapeArgent, { etape: "correction" }>): Promise<unknown> {
  const ANNULE = new Error("banc : transaction annulée");
  let observe: unknown = null;
  await prisma
    .$transaction(
      async (tx) => {
        if (e.retraitMd === "simule")
          await tx.$executeRawUnsafe(`DROP INDEX "statement_unique_trainer_periode"`);
        const piece = await tx.trainerStatement.findUniqueOrThrow({
          where: { id: e.statementId },
          select: { periodeYear: true, periodeMonth: true, tvaRegime: true },
        });
        await prendreVerrousRemuneration(tx, {
          periodes: [{ year: piece.periodeYear, month: piece.periodeMonth }],
          trainerIds: [e.mois.trainerId],
        });
        let correction: unknown;
        if (e.geste === "avoir") {
          correction = await emettreAvoirMission(tx, e.statementId, quand(e.maintenant));
        } else {
          const { count } = await tx.trainerStatement.updateMany({
            where: {
              id: e.statementId,
              statut: { in: ["brouillon", "a_valider", "valide"] },
              autofactureAt: null,
            },
            data: { statut: "annule" },
          });
          if (count === 1) {
            await tx.trainerFeeLine.updateMany({
              where: { statementId: e.statementId, statut: { not: "annule" } },
              data: { statut: "annule", annuleMotif: "autre" },
            });
          }
          correction = { annule: count === 1 };
        }
        const [mois] = parMoisCivil(demiJourneesSignees(e.mois.contresignatures));
        const conditions = {
          tarifJourneeHtCents: e.mois.tarifJourneeHtCents,
          forfaitDeplacementParJourHtCents: null,
          regimeTva: piece.tvaRegime,
        } as const;
        const aEcrire = {
          trainerId: e.mois.trainerId,
          sessionId: e.mois.sessionId,
          releve: calculerReleveDuMois(mois!, conditions),
          regimeTva: piece.tvaRegime,
          tarifJourneeHtCents: e.mois.tarifJourneeHtCents,
          sansEcart: true,
        };
        // Deux passages successifs : le premier réécrit (ou non), le second n'ajoute rien.
        const reecritures = [
          await ecrireMoisDansTransaction(tx, aEcrire, quand(e.maintenant)),
          await ecrireMoisDansTransaction(tx, aEcrire, quand(e.maintenant)),
        ];
        const releves = await tx.trainerStatement.findMany({
          where: { trainerId: e.mois.trainerId, sessionId: e.mois.sessionId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            statut: true,
            avoirDeId: true,
            totalHtCents: true,
            totalTtcCents: true,
            feeLines: { select: { statut: true, montantHtCents: true, objet: true } },
          },
        });
        observe = { correction, reecritures, releves };
        throw ANNULE;
      },
      { timeout: 30_000 },
    )
    .catch((err: unknown) => {
      if (err !== ANNULE) throw err;
    });
  return observe;
}

const CLE_BASCULE = "formateurs.passage_paiement";
const CLE_BILAN = "formateurs.bilan_fin_formation";

/** Ce que l'étape pose le temps de son exécution (bascule, bilan), à partir de ses champs. */
function reglagesPoses(e: EtapeArgent): Record<string, unknown> {
  const poses: Record<string, unknown> = { ...(e.poser ?? {}) };
  if (e.etape === "run-mensuel" || e.etape === "suivi" || e.etape === "signaler-desaccord")
    poses[CLE_BASCULE] = { date: e.bascule };
  if (e.etape === "passage")
    poses[CLE_BILAN] = e.bilanAllumeLe
      ? { actif: true, allumeLe: e.bilanAllumeLe }
      : { actif: false };
  if (e.etape === "terminer-bilan") poses[CLE_BILAN] = { actif: true, allumeLe: e.bilanAllumeLe };
  return poses;
}

/** Égalité JSON indépendante de l'ordre des clés (jsonb les réordonne). */
function canonique(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonique);
  if (v === null || typeof v !== "object") return v;
  return Object.fromEntries(
    Object.keys(v)
      .sort()
      .map((k) => [k, canonique((v as Record<string, unknown>)[k])]),
  );
}
const memeJson = (a: unknown, b: unknown) =>
  JSON.stringify(canonique(a)) === JSON.stringify(canonique(b));

/**
 * Joue `fn` sous les réglages de l'étape (`ReglagesDuPas`, voir le protocole) : les
 * interrupteurs et textes allumés, la bascule et le bilan sont posés, puis remis à leur
 * valeur d'avant SI personne ne les a changés entre-temps (une autre équipe qui aurait
 * posé la sienne pendant l'étape la garde). Le banc d'argent ne laisse donc rien derrière
 * lui.
 */
async function avecReglages<T>(e: EtapeArgent, fn: () => Promise<T>): Promise<T> {
  const description = "banc @formateurs (argent) — réglage d'une étape";
  const allumer: Record<string, unknown> = { ...(e.allumer ?? {}) };
  if (e.textes && e.textes.length > 0) {
    allumer["formateurs.textes_valides"] = { actif: true };
    for (const c of e.textes) {
      const empreinte = empreinteAttendue(`textes_valides.${c}`);
      if (empreinte === null) throw new Error(`texte « ${c} » : aucune empreinte attendue`);
      allumer[`textes_valides.${c}`] = { valide: true, empreinte };
    }
  }
  // Tout ce que l'étape allume est rendu à la fin de l'étape, comme la date de bascule :
  // les verrous des équipes A et B (`argent-verrou.ts`) garantissent que personne d'autre
  // ne bascule ces lignes pendant ce temps.
  const poses = { ...allumer, ...reglagesPoses(e) };
  const avant = new Map<string, { value: unknown; description: string | null } | null>();
  for (const [key, value] of Object.entries(poses)) {
    avant.set(
      key,
      await prisma.setting.findUnique({
        where: { key },
        select: { value: true, description: true },
      }),
    );
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as never, description },
      update: { value: value as never },
    });
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(poses)) {
      const actuel = await prisma.setting.findUnique({ where: { key }, select: { value: true } });
      if (!actuel || !memeJson(actuel.value, value)) continue;
      const precedent = avant.get(key) ?? null;
      if (precedent === null) await prisma.setting.deleteMany({ where: { key } });
      else
        await prisma.setting.update({
          where: { key },
          data: { value: precedent.value as never, description: precedent.description },
        });
    }
  }
}

async function jouerEtape(e: EtapeArgent): Promise<unknown> {
  switch (e.etape) {
    case "passage": {
      const sessions = new Set(e.sessionIds);
      return passerPaiementsMission(quand(e.maintenant), {
        dateBascule: async () => e.dateBascule,
        uniqueHistoriqueRetire:
          e.retraitMd === "declare" ? async () => true : () => uniqueHistoriqueRetire(prisma),
        candidats: async (d) => (await lireCandidats(d)).filter((c) => sessions.has(c.sessionId)),
        ecrireMois: ecrireMoisMission,
      });
    }
    case "signer-stagiaire": {
      // Le chemin du stagiaire : un lien (jeton) remis à son adresse, puis la signature.
      const inscription = await prisma.enrollment.findUniqueOrThrow({
        where: { id: e.enrollmentId },
        select: { trainee: { select: { email: true } }, session: { select: { dateFin: true } } },
      });
      const { tokenId } = await creerTokenInscription({
        enrollmentId: e.enrollmentId,
        dateFinSession: inscription.session.dateFin,
        destinataireEmail: inscription.trainee.email,
        maintenant: quand(e.maintenant),
      });
      return signerCreneau({
        creneauId: e.creneauId,
        porteur: { type: "stagiaire", enrollmentId: e.enrollmentId, tokenId },
        methode: "confirmation_accessible",
        nomConfirme: e.nomConfirme,
        maintenant: quand(e.maintenant),
      });
    }
    case "contresigner":
      return contresignerDemiJournee({
        sessionId: e.sessionId,
        trainerId: e.trainerId,
        date: e.date,
        demiJournee: e.demiJournee,
        methode: e.methode ?? "confirmation_accessible",
        nomConfirme: e.nomConfirme,
        maintenant: quand(e.maintenant),
      }).catch((err: unknown) => ({
        ok: false,
        leve: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      }));
    case "valider-et-emettre": {
      // L'effet du clic « Valider » (trainer-remuneration.ts, transition `a_valider` →
      // `valide`) : écriture conditionnelle sur le statut lu, lignes figées.
      const valide = await prisma.$transaction(async (tx) => {
        const { count } = await tx.trainerStatement.updateMany({
          where: { id: e.statementId, statut: "a_valider" },
          data: { statut: "valide" },
        });
        if (count === 1) {
          await tx.trainerFeeLine.updateMany({
            where: { statementId: e.statementId, statut: "calcule" },
            data: { statut: "valide" },
          });
        }
        return count === 1;
      });
      const emission = await emettreAutofacture(
        e.statementId,
        journalSysteme("rattrapage_automatique"),
      );
      if ("data" in emission) await retirerF36ApresUnRefus(e.statementId);
      return {
        valide,
        emission: "data" in emission ? emission : { error: emission.error, code: emission.code },
      };
    }
    case "run-mensuel":
      return runRemunerationMensuelle({ year: e.year, month: e.month });
    case "terminer-bilan": {
      const avis = await enregistrerAvisFormateur({
        sessionId: e.sessionId,
        trainerId: e.trainerId,
        note: 5,
        commentaire: "Bilan du banc : groupe assidu, objectifs atteints.",
        maintenant: quand(e.maintenant),
      });
      const fin = await terminerBilanFormateur({
        sessionId: e.sessionId,
        trainerId: e.trainerId,
        maintenant: quand(e.maintenant),
      });
      return { avis, fin };
    }
    case "suivi":
      return passerSuiviMission(quand(e.maintenant));
    case "demandes-contresignature": {
      const passer = () => envoyerDemandesContresignature(quand(e.maintenant));
      return e.retenirLeWorker ? sousWorkerRetenu(passer) : passer();
    }
    case "campagnes": {
      const miens = new Set(e.trainerIds);
      const passer = () =>
        passerCampagnes(quand(e.maintenant), {
          registre: REGISTRE_CAMPAGNES.map((c) => ({
            ...c,
            lireFaits: async (m: Date) =>
              (await c.lireFaits(m)).filter((f) => miens.has(f.entityId)),
          })),
        });
      return e.retenirLeWorker ? sousWorkerRetenu(passer) : passer();
    }
    case "virements": {
      const ids = new Set(e.ids);
      const vus = await lireVirementsSortants(quand(e.maintenant), echeanceEffective);
      return vus
        .filter((v) => ids.has(v.pieceId))
        .map((v) => ({
          pieceId: v.pieceId,
          flux: v.flux,
          couleur: v.couleur,
          dateCible: v.dateCible,
          echeance: v.echeance,
          montantCents: v.montantCents,
        }));
    }
    case "garde-virement": {
      const r = await prisma.trainerStatement.findUniqueOrThrow({
        where: { id: e.statementId },
        select: {
          trainerId: true,
          echeanceAt: true,
          totalTtcCents: true,
          sessionId: true,
          periodeYear: true,
          periodeMonth: true,
          dateFacture: true,
          feeLines: { where: { statut: { not: "annule" } }, select: { objet: true } },
        },
      });
      if (r.echeanceAt === null) throw new Error("garde-virement : relevé sans échéance");
      const { verdict, preuve } = await contexteVirementMission(
        prisma as never,
        {
          trainerId: r.trainerId,
          echeanceAt: r.echeanceAt,
          totalTtcCents: r.totalTtcCents,
          sessionId: r.sessionId,
          periodeYear: r.periodeYear,
          periodeMonth: r.periodeMonth,
          dateFacture: r.dateFacture,
          objets: r.feeLines.map((l) => l.objet ?? null),
        },
        e.empreinteAffichee,
        quand(e.maintenant),
      );
      return { verdict, ibanFin4: preuve?.ibanFin4 ?? null };
    }
    case "virements-faits":
      await envoyerVirementsFaits(e.ids);
      return null;
    case "reprendre-f37":
      return reprendreVirementsFaitsSansF37(quand(e.maintenant));
    case "f38":
      return envoyerVirementEnAttente(e.statementId);
    case "apres-decision-piece":
      return apresDecisionPiece({
        documentId: e.documentId,
        decision: e.decision,
        motifFerme: null,
        maintenant: quand(e.maintenant),
      });
    case "demander-iban":
      return demanderChangementIban(e.trainerId, e.iban, quand(e.maintenant));
    case "valider-demande":
      return validerDemandeChangement({
        demandeId: e.demandeId,
        adminId: e.adminId,
        maintenant: quand(e.maintenant),
      });
    case "indemnite":
      return ecrireIndemniteDecidee({
        missionId: e.missionId,
        annuleeA: quand(e.annuleeA),
        parAxion: e.parAxion,
      });
    case "signaler-desaccord":
      return signalerDesaccord({
        trainerId: e.trainerId,
        statementId: e.statementId,
        texte: e.texte,
        maintenant: quand(e.maintenant),
      });
    case "correction": {
      if (e.retraitMd !== "simule") return jouerCorrection(e);
      // `DROP INDEX` pose un verrou exclusif sur la table des relevés jusqu'à l'annulation
      // de la transaction : les autres équipes du job y écrivent aussi. L'attente est donc
      // BORNÉE (`lock_timeout`) et l'étape rejouée si le verrou ou un interblocage la refuse,
      // au lieu de figer ou de faire échouer un scénario voisin.
      for (let essai = 1; ; essai++) {
        try {
          return await jouerCorrection(e);
        } catch (err) {
          const code = (err as { meta?: { code?: string }; code?: string }).meta?.code;
          const msg = String((err as Error).message ?? err);
          const verrou =
            code === "55P03" || code === "40P01" || /55P03|40P01|lock timeout|deadlock/i.test(msg);
          if (!verrou || essai >= 6) throw err;
          await new Promise((res) => setTimeout(res, 500 * essai));
        }
      }
    }
    case "etat-piece": {
      const e2 = etatPiece(await lirePiecesSuivies(e.trainerId), e.type, quand(e.maintenant));
      return { etat: e2.etat, libelle: libelleEtatPiece(e2) };
    }
    case "apercu": {
      const r = await apercu({
        gabarit: e.gabarit as Parameters<typeof apercu>[0]["gabarit"],
        destinataire: e.destinataire,
        payload: e.payload as Parameters<typeof apercu>[0]["payload"],
      });
      const texte = r.html
        .replace(/<style[\s\S]*?<\/style>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;|&#160;/g, " ")
        .replace(/&#x27;|&#39;|&rsquo;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
      return { sujet: r.sujet, texte };
    }
    case "chiffrer-iban":
      return {
        iban: encryptPii(e.iban, { aad: `trainer:${e.trainerId}:iban`, cleExigee: true }),
        empreinte: empreinteIban(e.iban),
      };
    case "empreintes-textes":
      // La clé du registre porte le préfixe : `textes_valides.<gabarit>[#variante]`.
      return Object.fromEntries(e.cles.map((c) => [c, empreinteAttendue(`textes_valides.${c}`)]));
  }
}

async function principal(): Promise<void> {
  exigerBaseLocale();
  const brute = process.env["BANC_ENTREE_ARGENT"];
  if (!brute) throw new Error("banc @formateurs (argent) : BANC_ENTREE_ARGENT absente");
  const { etapes } = JSON.parse(brute) as EntreeArgent;
  const reseau = installerReseauSimule([]);
  const resultats: unknown[] = [];
  try {
    for (const e of etapes) resultats.push(await avecReglages(e, () => jouerEtape(e)));
  } finally {
    reseau.restaurer();
  }
  await emailsQueue?.close().catch(() => undefined);
  process.stdout.write(`\n${MARQUEUR_RESULTAT_ARGENT}${JSON.stringify(resultats)}\n`);
}

principal().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    process.exit(1);
  },
);
