// ⚠️ PAS de `import "server-only"` : `supprimerVideosCandidature` était appelée
// par la purge de rétention, qui tourne dans le WORKER (`tsx`) — purge retirée
// le 2026-10-07 (décision de Will : aucune candidature effacée automatiquement).
// Le module reste importable hors Next (`aucun-module-du-worker-nimporte-server-only.spec.ts`).

/**
 * VIDÉOS DÉPOSÉES PAR LE CANDIDAT — disque et cycle de vie (Will, 2026-09-28).
 *
 * Disque : `<volume CV>/videos/<candidature>/<vidéo>` (+ `.part` pendant l'envoi).
 * Un DOSSIER par candidature : l'effacer efface tout, sans liste à tenir — c'est
 * ce qui rend l'effacement RGPD sûr quel que soit le nombre de vidéos.
 *
 * Cycle : `envoi` (morceaux) → `analyse` (antivirus) → `disponible` | `rejetee`.
 * Une vidéo n'est lisible en console qu'en `disponible` : jamais sans verdict.
 *
 * L12 — toute écriture d'état passe par `etatVideo()`, qui pose `statut` (texte,
 * toujours lu) ET `etatFerme` (liste fermée Postgres) : phase « expand ».
 */

import { mkdir, open, rename, rm, stat, unlink } from "node:fs/promises";
import { join } from "node:path";

import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { getCvStorageBasePath } from "@/server/careers/cv-storage";
import { analyserFichier } from "@/server/careers/clamav";
import { consignerEvenement } from "@/features/admin-job-applications/journal";
import { formatReel, tailleLisible, VIDEO_MORCEAU_OCTETS } from "@/lib/careers/videos";
import { etatVideo } from "@/lib/careers/etats-candidat";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dossier des vidéos d'une candidature. Les identifiants sont vérifiés : jamais de chemin forgé. */
export function dossierVideos(applicationId: string): string {
  if (!UUID.test(applicationId)) throw new Error("identifiant de candidature invalide");
  return join(getCvStorageBasePath(), "videos", applicationId);
}

export function cheminVideo(applicationId: string, videoId: string): string {
  if (!UUID.test(videoId)) throw new Error("identifiant de vidéo invalide");
  return join(dossierVideos(applicationId), videoId);
}

const partiel = (chemin: string) => `${chemin}.part`;

/**
 * Écrit UN morceau à sa place. Idempotent : un morceau déjà reçu (renvoi après
 * une coupure réseau) est accepté sans rien réécrire. Un morceau qui sauterait
 * un trou est refusé : le fichier est écrit dans l'ordre, sans trou possible.
 */
export async function ecrireMorceau(
  video: { id: string; applicationId: string; taille: number; octetsRecus: number },
  index: number,
  donnees: Buffer,
): Promise<{ ok: true; octetsRecus: number } | { ok: false; raison: string }> {
  const debut = index * VIDEO_MORCEAU_OCTETS;
  if (!Number.isInteger(index) || index < 0) return { ok: false, raison: "index" };
  if (debut + donnees.length > video.taille) return { ok: false, raison: "depasse" };
  if (donnees.length > VIDEO_MORCEAU_OCTETS) return { ok: false, raison: "morceau-trop-gros" };
  if (debut < video.octetsRecus) return { ok: true, octetsRecus: video.octetsRecus }; // déjà reçu
  if (debut > video.octetsRecus) return { ok: false, raison: "trou" };

  const chemin = partiel(cheminVideo(video.applicationId, video.id));
  await mkdir(dossierVideos(video.applicationId), { recursive: true });
  const fichier = await open(chemin, debut === 0 ? "w" : "r+");
  try {
    await fichier.write(donnees, 0, donnees.length, debut);
  } finally {
    await fichier.close();
  }
  const octetsRecus = debut + donnees.length;
  await prisma.jobApplicationVideo.update({ where: { id: video.id }, data: { octetsRecus } });
  return { ok: true, octetsRecus };
}

/**
 * Dernier morceau reçu : taille exacte, FORMAT RÉEL lu dans les premiers octets,
 * puis passage en analyse. Un faux fichier (un .exe renommé en .mp4) est rejeté
 * ICI, avant même l'antivirus, et effacé.
 */
export async function finaliserVideo(video: {
  id: string;
  applicationId: string;
  taille: number;
  octetsRecus: number;
}): Promise<{ ok: true } | { ok: false; raison: string }> {
  if (video.octetsRecus !== video.taille) return { ok: false, raison: "incomplet" };
  const final = cheminVideo(video.applicationId, video.id);
  const enCours = partiel(final);
  const reel = await stat(enCours).catch(() => null);
  if (!reel || reel.size !== video.taille) return { ok: false, raison: "incomplet" };

  const f = await open(enCours, "r");
  const debut = Buffer.alloc(16);
  try {
    await f.read(debut, 0, 16, 0);
  } finally {
    await f.close();
  }
  const mime = formatReel(debut);
  if (!mime) {
    await unlink(enCours).catch(() => {});
    await prisma.jobApplicationVideo.update({
      where: { id: video.id },
      data: {
        ...etatVideo("rejetee"),
        motifRejet: "Ce fichier n'est pas une vidéo MP4, MOV ou WebM.",
      },
    });
    return { ok: false, raison: "format" };
  }
  await rename(enCours, final);
  await prisma.jobApplicationVideo.update({
    where: { id: video.id },
    data: { ...etatVideo("analyse"), mime },
  });
  void analyserVideo(video.id);
  return { ok: true };
}

/** Analyses en cours dans CE processus — une vidéo n'est jamais analysée deux fois en même temps. */
const enCours = new Set<string>();

/**
 * Passe la vidéo à l'antivirus. Sain → `disponible` + ligne de journal + fiche
 * « à traiter ». Infecté → fichier EFFACÉ, `rejetee`, alerte Sentry. Antivirus
 * indisponible → la vidéo RESTE en analyse (jamais montrée sans verdict) ;
 * `relancerAnalysesEnAttente` la reprendra.
 */
export async function analyserVideo(videoId: string): Promise<void> {
  if (enCours.has(videoId)) return;
  enCours.add(videoId);
  try {
    const v = await prisma.jobApplicationVideo.findUnique({ where: { id: videoId } });
    if (!v || v.statut !== "analyse") return;
    const chemin = cheminVideo(v.applicationId, v.id);
    const verdict = await analyserFichier(chemin);
    if (verdict.issue === "indisponible") {
      console.warn(
        `[videos] antivirus indisponible pour ${v.id} : ${verdict.raison} — reprise plus tard`,
      );
      return;
    }
    if (verdict.issue === "infecte") {
      await unlink(chemin).catch(() => {});
      await prisma.jobApplicationVideo.update({
        where: { id: v.id },
        data: {
          ...etatVideo("rejetee"),
          analyseLe: new Date(),
          motifRejet: `Refusée par l'antivirus (${verdict.signature}).`,
        },
      });
      Sentry.captureMessage(`[videos] fichier infecté refusé : ${verdict.signature}`, {
        level: "warning",
        tags: { videoId: v.id },
      });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.jobApplicationVideo.update({
        where: { id: v.id },
        data: { ...etatVideo("disponible"), analyseLe: new Date() },
      });
      await tx.jobApplication.update({
        where: { id: v.applicationId },
        data: { needsAttention: true },
      });
      await consignerEvenement(
        {
          applicationId: v.applicationId,
          type: "piece_recue",
          authorId: null,
          authorName: "Le candidat (dépôt en ligne)",
          summary: `Vidéo déposée : ${v.nomOriginal} (${tailleLisible(v.taille)})`,
          meta: { videoId: v.id, antivirus: "sain" },
        },
        tx,
      );
    });
  } catch (e) {
    Sentry.captureException(e, { tags: { action: "analyserVideo" } });
  } finally {
    enCours.delete(videoId);
  }
}

/**
 * Reprend les vidéos restées en analyse plus de 2 minutes (redémarrage, antivirus
 * indisponible). Appelée à l'ouverture de la fiche et de la page du candidat :
 * pas de cron, parce que le worker n'a pas le volume des fichiers.
 */
export async function relancerAnalysesEnAttente(applicationId: string): Promise<void> {
  const attente = await prisma.jobApplicationVideo
    .findMany({
      where: {
        applicationId,
        statut: "analyse",
        createdAt: { lt: new Date(Date.now() - 120_000) },
      },
      select: { id: true },
    })
    .catch(() => []);
  for (const v of attente) void analyserVideo(v.id);
}

/**
 * Efface TOUTES les vidéos d'une candidature (dossier entier). Best-effort,
 * idempotent : appelée AVANT la suppression de la ligne, aux deux chemins
 * (suppression console, effacement RGPD). Il n'y a plus de purge de rétention
 * des candidatures (décision de Will, 2026-10-07).
 */
export async function supprimerVideosCandidature(applicationId: string): Promise<void> {
  try {
    await rm(dossierVideos(applicationId), { recursive: true, force: true });
  } catch {
    // identifiant invalide ou disque indisponible : rien à effacer de notre côté
  }
}

/** Efface UNE vidéo (le candidat la retire depuis sa page). */
export async function supprimerVideo(v: { id: string; applicationId: string }): Promise<void> {
  const chemin = cheminVideo(v.applicationId, v.id);
  await unlink(chemin).catch(() => {});
  await unlink(partiel(chemin)).catch(() => {});
  await prisma.jobApplicationVideo.delete({ where: { id: v.id } }).catch(() => {});
}
