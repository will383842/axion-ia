/**
 * RÉCEPTION DES DEMANDES SIGNÉES DU STUDIO — idempotence et anti-rejeu (lot PV-1).
 *
 * Clé d'idempotence = identifiant du run Zernio (`cleIdempotence`). Avant tout effet, une
 * ligne de journal « en cours » (`reponse_statut = 0`) RÉSERVE la clé : deux appels
 * simultanés du même run ne produisent qu'UN traitement. Le journal garde la réponse
 * rendue, rejouée telle quelle si le Studio retente (même corps).
 *
 *   · même clé, même corps  → réponse enregistrée rejouée (`x-axion-rejeu: 1`), aucun effet ;
 *   · même clé, autre corps → 409 `cle_reutilisee` ;
 *   · même nonce, autre clé → 409 `nonce_reutilise` ;
 *   · clé réservée il y a < 2 min → 409 `en_cours` ; plus vieille : réservation abandonnée,
 *     reprise (le journal ne contient aucune donnée de personne).
 *
 * 🔴 MARQUE « E-MAIL EN FILE ». `mettreEnFileGuide` n'a aucune déduplication par demande :
 * l'idempotence de l'e-mail repose sur CE journal. Dès que l'e-mail est en file (`en-file` /
 * `en-validation`), la ligne reçoit `reponseCorps = { marque: "email_en_file", …réponse }`
 * (statut encore 0). Après cette marque la clé n'est JAMAIS libérée :
 *   · une exception tardive enregistre la réponse (200) au lieu de supprimer la ligne ;
 *   · une réservation reprise après 2 min qui porte la marque est CLOSE (réponse rejouée),
 *     jamais retraitée : pas de second e-mail.
 *
 * ⚠️ SECRET PARTAGÉ AVEC LES VIDÉOS. `controlerEntree` (`src/server/videos/entree.ts`) exige
 * aussi `VIDEOS_SITE_ENABLED=true`, vérifie la signature avec `VIDEOS_STUDIO_HMAC_SECRET` et
 * partage le seau de débit `internal:videos:<ip>`. Choix assumé pour ce lot : la signature
 * couvre méthode + chemin + empreinte du corps, donc une requête vidéo ne se rejoue pas ici
 * (ni l'inverse). Contrepartie : une fuite du secret ouvre les DEUX routes. Séparer secret,
 * drapeau et préfixe de débit (paramètres de `controlerEntree`) est le suivi recommandé,
 * avant d'allumer `GUIDES_RESEAU_ENABLED`.
 *
 * Seuls les traitements ABOUTIS sont journalisés : un corps invalide (422) ou une adresse
 * refusée ne consomment pas la clé, pour que le Studio puisse rappeler avec l'adresse corrigée.
 */
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { masquerDonneesSensibles } from "@/lib/security/masquage-donnees-sensibles";
import type { Prisma } from "../../../prisma/generated/client";
import type { EntreeSignee } from "@/server/videos/entree";
import { reponseJson } from "@/server/videos/reponse";
import { analyserCorps } from "./contrat";
import { traiterDemande } from "./traitement";

const RESERVATION_PERIMEE_MS = 2 * 60_000;
const MARQUE_EMAIL_EN_FILE = "email_en_file";

/** Réponse portée par la marque « e-mail en file », ou null si la marque est absente. */
function reponseMarquee(reponseCorps: unknown): Record<string, unknown> | null {
  if (typeof reponseCorps !== "object" || reponseCorps === null) return null;
  const { marque, ...reste } = reponseCorps as Record<string, unknown>;
  return marque === MARQUE_EMAIL_EN_FILE ? reste : null;
}

function estUniciteViolee(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

function rejouer(statut: number, corps: unknown): Response {
  return reponseJson(statut, corps, { "x-axion-rejeu": "1" });
}

/** Lit la ligne de la clé et décide : rejeu, conflit, ou réservation à reprendre. */
async function conflitSurLaCle(
  e: EntreeSignee,
  cle: string,
  maintenant: number,
): Promise<Response | "reprendre"> {
  const vue = await prisma.guideReseauReception.findUnique({ where: { cleIdempotence: cle } });
  if (vue === null) return "reprendre";
  if (vue.corpsSha256 !== e.corpsSha256) {
    return reponseJson(409, { ok: false, erreur: "cle_reutilisee" });
  }
  if (vue.reponseStatut === 0) {
    if (maintenant - vue.recueLe.getTime() < RESERVATION_PERIMEE_MS) {
      return reponseJson(409, { ok: false, erreur: "en_cours" });
    }
    const marquee = reponseMarquee(vue.reponseCorps);
    if (marquee !== null) {
      // L'e-mail est déjà en file : on clôt la réponse, on ne retraite RIEN.
      await prisma.guideReseauReception
        .updateMany({
          where: { id: vue.id, reponseStatut: 0 },
          data: { reponseStatut: 200, reponseCorps: marquee as Prisma.InputJsonValue },
        })
        .catch(() => undefined);
      return rejouer(200, marquee);
    }
    await prisma.guideReseauReception.deleteMany({ where: { id: vue.id, reponseStatut: 0 } });
    return "reprendre";
  }
  return rejouer(vue.reponseStatut, vue.reponseCorps);
}

export async function recevoirDemande(e: EntreeSignee): Promise<Response> {
  const analyse = analyserCorps(e.corps);
  if (!analyse.ok) {
    return reponseJson(422, { ok: false, erreur: analyse.erreur, champs: analyse.champs });
  }
  const d = analyse.demande;
  const maintenant = Date.now();

  // Le nonce a-t-il déjà servi pour une AUTRE clé ? (même clé : traité ci-dessous.)
  const nonceVu = await prisma.guideReseauReception.findUnique({ where: { nonce: e.nonce } });
  if (nonceVu !== null && nonceVu.cleIdempotence !== d.cleIdempotence) {
    return reponseJson(409, { ok: false, erreur: "nonce_reutilise" });
  }

  for (let tentative = 0; tentative < 2; tentative++) {
    try {
      await prisma.guideReseauReception.create({
        data: {
          cleIdempotence: d.cleIdempotence,
          nonce: e.nonce,
          corpsSha256: e.corpsSha256,
          reponseStatut: 0,
          reponseCorps: {},
        },
      });
      break;
    } catch (err) {
      if (!estUniciteViolee(err)) throw err;
      const verdict = await conflitSurLaCle(e, d.cleIdempotence, maintenant);
      if (verdict !== "reprendre") return verdict;
      // Même clé avec un nonce déjà pris par une autre ligne : jamais deux fois le même nonce.
      if (tentative === 1) return reponseJson(409, { ok: false, erreur: "nonce_reutilise" });
    }
  }

  // Réponse à enregistrer dès que l'e-mail est en file (posée AVANT l'écriture de la marque :
  // si cette écriture échoue, le catch sait déjà que l'e-mail est parti).
  let enFile: Record<string, unknown> | null = null;
  try {
    const r = await traiterDemande(d, new Date(), {
      apresMiseEnFile: async (m) => {
        enFile = {
          ok: true,
          demandeId: m.demandeId,
          nouvelle: m.nouvelle,
          guide: m.guide,
          accord: m.accord,
        };
        await prisma.guideReseauReception.updateMany({
          where: { cleIdempotence: d.cleIdempotence, reponseStatut: 0 },
          data: {
            reponseCorps: { marque: MARQUE_EMAIL_EN_FILE, ...enFile } as Prisma.InputJsonValue,
          },
        });
      },
    });
    if (!r.ok) {
      // Rien n'a été fait : la clé est rendue pour une nouvelle tentative corrigée.
      await prisma.guideReseauReception.deleteMany({
        where: { cleIdempotence: d.cleIdempotence, reponseStatut: 0 },
      });
      return reponseJson(422, { ok: false, erreur: r.erreur });
    }
    const corps = {
      ok: true,
      demandeId: r.demandeId,
      nouvelle: r.nouvelle,
      guide: r.guide,
      accord: r.accord,
    };
    await prisma.guideReseauReception.updateMany({
      where: { cleIdempotence: d.cleIdempotence },
      data: { reponseStatut: 200, reponseCorps: corps as Prisma.InputJsonValue },
    });
    return reponseJson(200, corps);
  } catch (err) {
    // Diagnostic : exception nettoyée de toute donnée de personne (adresse, jeton…).
    try {
      Sentry.captureException(masquerDonneesSensibles(err), {
        tags: { area: "guides-reseau", action: "recevoirDemande" },
      });
    } catch {
      /* l'observabilité ne casse jamais la réponse */
    }
    console.error(
      "[guides-reseau] traitement en échec :",
      err instanceof Error ? err.name : "erreur",
    );
    const mise: Record<string, unknown> | null = enFile;
    if (mise !== null) {
      // L'e-mail est en file : la clé n'est JAMAIS libérée. La réponse est enregistrée.
      await prisma.guideReseauReception
        .updateMany({
          where: { cleIdempotence: d.cleIdempotence },
          data: { reponseStatut: 200, reponseCorps: mise as Prisma.InputJsonValue },
        })
        .catch(() => undefined);
      return reponseJson(200, mise);
    }
    // Rien n'est parti : libère la réservation, le Studio pourra retenter.
    await prisma.guideReseauReception
      .deleteMany({ where: { cleIdempotence: d.cleIdempotence, reponseStatut: 0 } })
      .catch(() => undefined);
    return reponseJson(500, { ok: false, erreur: "erreur_interne" });
  }
}
