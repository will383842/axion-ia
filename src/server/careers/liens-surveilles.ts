// ⚠️ PAS de `import "server-only"` : ce module tourne dans le WORKER (`tsx`).
// Gardé par `tests/unit/ci/aucun-module-du-worker-nimporte-server-only.spec.ts`.

/**
 * LIENS VIDÉO SURVEILLÉS — passage hebdomadaire (Will, 2026-09-28).
 *
 * « Un lien meurt » : le candidat supprime sa vidéo, ferme son Drive, change de
 * portfolio, et six mois plus tard il ne reste rien pour juger son travail.
 * Chaque lundi, chaque lien trouvé dans une candidature active est appelé une
 * fois ; son état est rangé dans `job_application_links`, et la fiche affiche
 * « mort depuis le … ».
 *
 * Doctrine :
 *  · la règle d'état est PURE (`etatDepuisStatut`, `lib/careers/liens-video`) ;
 *  · YouTube / Vimeo / TikTok passent par leur oEmbed officiel ;
 *  · Instagram / Facebook / LinkedIn sont « invérifiables » sans appel ;
 *  · une requête à la fois, délai 10 s, plafond de liens par passage ;
 *  · table absente (fenêtre app/worker, P2021) → le passage s'abstient.
 */

import { prisma } from "@/lib/prisma";
import {
  estDerriereConnexion,
  etatDepuisStatut,
  extraireLiensVideo,
  sourcesDeLiens,
  TYPES_JOURNAL_DU_CANDIDAT,
  urlOembed,
  type EtatLien,
} from "@/lib/careers/liens-video";
import { etatLien } from "@/lib/careers/etats-candidat";

export const PLAFOND_LIENS = 600;
const DELAI_MS = 10_000;
/** Dossiers clos : inutile de surveiller leurs liens. */
const CLOS = ["rejected", "withdrawn"] as const;

export type Appeler = (url: string) => Promise<number | null>;

/** GET avec redirections suivies ; `null` si délai ou erreur réseau. Le corps n'est pas lu. */
async function appelerParDefaut(url: string): Promise<number | null> {
  try {
    const rep = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(DELAI_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AxionIA-LinkCheck/1.0; +https://axion-ia.com)",
      },
    });
    await rep.body?.cancel().catch(() => {});
    return rep.status;
  } catch {
    return null;
  }
}

export async function etatDuLien(
  url: string,
  appeler: Appeler = appelerParDefaut,
): Promise<{ etat: EtatLien; statut: number | null }> {
  if (estDerriereConnexion(url)) return { etat: "inverifiable", statut: null };
  const oembed = urlOembed(url);
  const statut = await appeler(oembed ?? url);
  return { etat: etatDepuisStatut(statut, oembed !== null), statut };
}

type CleLien = { applicationId_url: { applicationId: string; url: string } };
type CreationLien = {
  applicationId: string;
  url: string;
  etat: EtatLien;
  etatFerme?: EtatLien;
  httpStatus: number | null;
  verifieLe: Date;
  mortDepuis: Date | null;
};
type MiseAJourLien = Partial<Omit<CreationLien, "applicationId" | "url">>;

/** Retire la colonne enum d'une écriture (repli de la fenêtre app/worker). */
function sansEtatFerme<T extends { etatFerme?: unknown }>(v: T): Omit<T, "etatFerme"> {
  const { etatFerme: _ignore, ...reste } = v;
  return reste;
}

/**
 * L12 — écrit l'état d'un lien, colonne texte ET colonne enum (`etat_ferme`).
 *
 * 🔴 FENÊTRE APP/WORKER (AGENTS.md) : ce module tourne dans le WORKER, rebâti
 * depuis les sources en quelques minutes, alors que la migration qui crée
 * `etat_ferme` est jouée par l'entrypoint de l'APP, ~50 min plus tard. Pendant
 * cette fenêtre, écrire — ou même RELIRE, ce que fait un `upsert` sans
 * `select` — la nouvelle colonne lève P2022 (« colonne absente »). Le passage
 * du lundi retombe alors sur l'écriture texte seule, comme avant L12 ; le
 * rattrapage SQL de la migration comblera la colonne enum ensuite.
 */
async function ecrireEtatDuLien(
  cle: CleLien,
  create: CreationLien,
  update: MiseAJourLien,
): Promise<void> {
  try {
    await prisma.jobApplicationLink.upsert({ where: cle, create, update, select: { id: true } });
  } catch (e) {
    if ((e as { code?: string }).code !== "P2022") throw e;
    await prisma.jobApplicationLink.upsert({
      where: cle,
      create: sansEtatFerme(create),
      update: sansEtatFerme(update),
      select: { id: true },
    });
  }
}

export interface BilanLiens {
  readonly abstenu: boolean;
  readonly verifies: number;
  readonly morts: number;
  readonly inverifiables: number;
}

export async function surveillerLiens(
  maintenant: Date = new Date(),
  appeler: Appeler = appelerParDefaut,
): Promise<BilanLiens> {
  try {
    await prisma.jobApplicationLink.count();
  } catch (e) {
    if ((e as { code?: string }).code === "P2021") {
      return { abstenu: true, verifies: 0, morts: 0, inverifiables: 0 };
    }
    throw e;
  }

  const candidatures = await prisma.jobApplication.findMany({
    where: { status: { notIn: [...CLOS] } },
    select: {
      id: true,
      answers: true,
      motivation: true,
      linkedinUrl: true,
      events: {
        where: { type: { in: ["piece_recue", "email_recu", "note"] } },
        select: { type: true, summary: true, occurredAt: true, body: true },
      },
    },
  });

  let verifies = 0;
  let morts = 0;
  let inverifiables = 0;
  for (const c of candidatures) {
    if (verifies >= PLAFOND_LIENS) break;
    const liens = extraireLiensVideo(
      sourcesDeLiens(
        {
          answers: (c.answers ?? null) as Record<string, unknown> | null,
          motivation: c.motivation,
          linkedinUrl: c.linkedinUrl,
          evenements: c.events.filter((e) => TYPES_JOURNAL_DU_CANDIDAT.has(e.type)),
        },
        (d) => d.toISOString().slice(0, 10),
      ),
    );
    for (const l of liens) {
      if (verifies >= PLAFOND_LIENS) break;
      const url = l.url.slice(0, 2000);
      const { etat, statut } = await etatDuLien(url, appeler);
      verifies += 1;
      if (etat === "mort") morts += 1;
      if (etat === "inverifiable") inverifiables += 1;
      const cle = { applicationId_url: { applicationId: c.id, url } };
      const avant = await prisma.jobApplicationLink.findUnique({
        where: cle,
        select: { mortDepuis: true },
      });
      const mortDepuis = etat === "mort" ? (avant?.mortDepuis ?? maintenant) : null;
      const create = {
        applicationId: c.id,
        url,
        ...etatLien(etat),
        httpStatus: statut,
        verifieLe: maintenant,
        mortDepuis,
      };
      // « Invérifiable » ne remet PAS à zéro une mort constatée : on ne sait pas.
      const update =
        etat === "inverifiable"
          ? { verifieLe: maintenant, httpStatus: statut }
          : { ...etatLien(etat), httpStatus: statut, verifieLe: maintenant, mortDepuis };
      await ecrireEtatDuLien(cle, create, update);
    }
  }
  return { abstenu: false, verifies, morts, inverifiables };
}
