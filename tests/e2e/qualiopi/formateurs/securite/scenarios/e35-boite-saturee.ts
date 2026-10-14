// E35 — Boîte saturée : des relances en file, puis une demande de code F17 et
// un lien de connexion — F17 et la connexion partent les premiers ; au plus
// 30 relances par passage.
//
// ⚠️ Le worker d'e-mails du dépôt est bridé à 40 envois par heure, et il est
// PARTAGÉ par tous les specs du job. Enfiler 40 vraies relances l'épuiserait
// pour une heure et ferait échouer les autres équipes. Le scénario sépare donc
// les deux preuves :
//   (A) l'ORDRE, par la vraie file et le vrai worker : la file est suspendue un
//       instant, on y pose 3 relances (avec la priorité que leur donne le
//       passage des campagnes), PUIS F17 (`envoyerCodeSignature`) et le lien de
//       connexion (`sendFormateurMagicLinkAction`) ; on relâche, et on lit
//       l'heure de prise de chaque job ;
//   (B) le PLAFOND, par le vrai passage des campagnes sur 40 fiches dues (la
//       vraie campagne F9, ses vraies règles), dont seul l'envoi final est
//       remplacé par un relevé : rien n'entre dans la file.

import { sendFormateurMagicLinkAction } from "@/server/actions/formateur/auth.actions";
import { emailsQueue, enqueueEmail } from "@/server/queue/queues";
import type { EmailJobName } from "@/server/queue/types";
import { PRIORITE_RELANCE, passerCampagnes } from "@/server/relances/passer-campagnes";
import type { EnvoiFormateur } from "@/server/qualiopi/formateurs-independants/envois";
import { envoyerCodeSignature } from "@/server/qualiopi/formateurs-independants/code-signature-envoi";
import { CAMPAGNE_RELANCE_DOSSIER } from "@/server/qualiopi/formateurs-independants/relance-dossier";

import {
  allumerParLaConsole,
  attendre,
  avecVerrouInterrupteurs,
  creerAdmin,
  creerIndependant,
  creerPieceASigner,
  menage,
  prisma,
  validerTextesParLaConsole,
  valeursDuBanc,
} from "../donnees";

function dansLaFenetre(): Date {
  const d = new Date();
  d.setUTCHours(8, 30, 0, 0);
  return d;
}

async function partieA() {
  const t = await creerIndependant({ actif: true });
  const contrat = await creerPieceASigner(t.id, "contrat_sous_traitance", "en_attente");
  const file = emailsQueue;
  if (file === null) throw new Error("banc : la file d'e-mails n'existe pas");

  await file.pause();
  let f17: unknown;
  let connexion: unknown;
  let files: { attente: string[]; prioritaires: string[] } = { attente: [], prioritaires: [] };
  try {
    for (let i = 0; i < 3; i++) {
      await enqueueEmail(
        "formateur-dossier-relance" as EmailJobName,
        t.email,
        "fr",
        { prenom: t.prenom, valeurs: await valeursDuBanc("formateur-dossier-relance") },
        { entityType: "Trainer", entityId: t.id, priority: PRIORITE_RELANCE },
      );
    }
    f17 = await envoyerCodeSignature({ documentGenereId: contrat.id, maintenant: new Date() });
    const fd = new FormData();
    fd.set("email", t.email);
    connexion = await sendFormateurMagicLinkAction(undefined, fd);

    // L'état de la file, figée : dans quelle voie chaque envoi attend-il ?
    // File suspendue : la voie sans priorité s'appelle « paused » le temps de la pause.
    const voie = async (etats: Array<"wait" | "paused" | "prioritized">) =>
      (await file.getJobs(etats, 0, 500)).filter((j) => j.data.to === t.email);
    const attente = await voie(["wait", "paused"]);
    const prioritaires = await voie(["prioritized"]);
    files = {
      attente: attente.map((j) => j.name).sort(),
      prioritaires: prioritaires.map((j) => j.name).sort(),
    };
    // F17 ne peut pas être OUVERT par le worker du banc (sa clé PII est fictive
    // et non conforme) : on le retire de la file avant de la relâcher, et on
    // clôt sa ligne — sinon il consommerait le débit de tous en réessais.
    for (const j of attente.filter((x) => x.name === "formateur-code-signature")) {
      await j.remove();
      await prisma.emailLog.updateMany({
        where: { jobId: j.id ?? "" },
        data: {
          status: "cancelled",
          error: "banc : retiré de la file (clé PII du worker fictive)",
        },
      });
    }
  } finally {
    await file.resume();
  }

  const lignes = await attendre(
    () =>
      prisma.emailLog.findMany({
        where: { recipient: t.email },
        select: { template: true, status: true, jobId: true },
      }),
    (l) => l.length === 5 && l.every((x) => x.status !== "pending"),
    90_000,
  );
  const prises: Array<{
    template: string;
    status: string;
    prisA: number | null;
    priorite: number;
  }> = [];
  for (const l of lignes) {
    if (l.template === "formateur-code-signature") continue;
    const job = l.jobId ? await file.getJob(l.jobId) : undefined;
    prises.push({
      template: l.template,
      status: l.status,
      prisA: job?.processedOn ?? null,
      priorite: job?.opts.priority ?? 0,
    });
  }
  await prisma.emailLog.deleteMany({ where: { recipient: t.email } });
  return { adresse: t.email, f17, connexion, files, prises };
}

async function partieB() {
  const maintenant = dansLaFenetre();
  const ids: string[] = [];
  for (let i = 0; i < 40; i++) {
    const t = await creerIndependant({ dossierStatut: "a_completer" } as never);
    ids.push(t.id);
    // L'origine de la relance : le lien du dossier, parti il y a quatre jours.
    await prisma.emailLog.create({
      data: {
        template: "formateur-dossier-lien",
        recipient: t.email,
        locale: "fr",
        entityType: "Trainer",
        entityId: t.id,
        status: "sent",
        sentAt: new Date(maintenant.getTime() - 4 * 86_400_000),
        createdAt: new Date(maintenant.getTime() - 4 * 86_400_000),
      } as never,
    });
  }
  const miennes = new Set(ids);
  const registre = [
    {
      ...CAMPAGNE_RELANCE_DOSSIER,
      lireFaits: async (m: Date) =>
        (await CAMPAGNE_RELANCE_DOSSIER.lireFaits(m)).filter((f) => miennes.has(f.entityId)),
    },
  ];
  const releves: EnvoiFormateur[] = [];
  const bilan = await passerCampagnes(maintenant, {
    registre,
    envoyer: async (e: EnvoiFormateur) => {
      releves.push(e);
      return "envoye";
    },
  } as never);
  await prisma.emailLog.deleteMany({ where: { entityId: { in: ids } } });
  return {
    bilan,
    envois: releves.length,
    priorites: [...new Set(releves.map((e) => e.priority ?? 0))],
    gabarits: [...new Set(releves.map((e) => e.gabarit))],
    destinatairesDistincts: new Set(releves.map((e) => e.destinataire)).size,
  };
}

export default async function e35(): Promise<unknown> {
  try {
    return await avecVerrouInterrupteurs(async () => {
      const direction = await creerAdmin("super_admin");
      await allumerParLaConsole(direction, ["textes_valides", "dossier_en_ligne", "relances_auto"]);
      await validerTextesParLaConsole(direction, [
        { gabarit: "formateur-code-signature" },
        { gabarit: "formateur-dossier-relance" },
      ]);
      return { a: await partieA(), b: await partieB(), prioriteRelance: PRIORITE_RELANCE };
    });
  } finally {
    await menage();
  }
}
