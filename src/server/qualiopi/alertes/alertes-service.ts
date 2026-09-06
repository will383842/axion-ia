/**
 * Qualiopi — Service alertes système (T15 AGENT A).
 *
 * creerOuDedup      : crée une alerte (skip si doublon code+cibleId non résolue).
 * resoudreAlerte    : marque une alerte résolue + resolueAt.
 * marquerLu         : marque une alerte lue.
 * marquerToutLu     : marque toutes les alertes non-lues comme lues.
 * listAlertes       : liste les alertes (filtres optionnels).
 * countNonLues      : compte les alertes non lues.
 * synchroniserAlertes : évalue + crée/résout en masse.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", toutes les fonctions
 * retournent des fallbacks vides/null sans appel Prisma.
 */

import { prisma } from "@/lib/prisma";
import type { AlerteNiveau, AlerteSysteme } from "../../../../prisma/generated/client";
import { evaluerAlertesDetaille } from "./evaluateur";
import { ALERTE_CATALOGUE } from "./catalogue";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AlerteInput {
  readonly code: string;
  readonly niveau: AlerteNiveau;
  readonly titre: string;
  readonly message: string;
  readonly cibleType?: string;
  readonly cibleId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ListAlertesOptions {
  readonly resolue?: boolean;
  readonly lu?: boolean;
  readonly niveau?: AlerteNiveau;
  readonly limit?: number;
}

export type { AlerteSysteme };

// ─────────────────────────────────────────────────────────────────────────────
// Guard stub
// ─────────────────────────────────────────────────────────────────────────────

function isStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

// ─────────────────────────────────────────────────────────────────────────────
// creerOuDedup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée une alerte en DB. Si une alerte (code, cibleId) non résolue existe déjà,
 * retourne `null` (dé-duplication silencieuse).
 *
 * 🔴 Le `findFirst` préalable est CONSERVÉ, mais il ne décide plus seul : depuis
 * T3a, un index unique partiel garantit l'unicité en base. La lecture évite
 * simplement une écriture inutile dans le cas courant ; le conflit, lui, est
 * absorbé ci-dessous.
 *
 * Ce rattrapage n'est pas une précaution abstraite : `portail.ts` appelle cette
 * fonction en `void creerOuDedup(...)`, sans `await`. Sans le `catch`, une
 * course entre deux stagiaires signalant la même chose à la même seconde
 * produirait un **rejet non traité** — c'est-à-dire, en pratique, un plantage de
 * requête pour un doublon dont la réponse correcte est « ne rien faire ».
 */
export async function creerOuDedup(input: AlerteInput): Promise<AlerteSysteme | null> {
  if (isStub()) return null;

  const existing = await prisma.alerteSysteme.findFirst({
    where: {
      code: input.code,
      resolue: false,
      ...(input.cibleId !== undefined ? { cibleId: input.cibleId } : { cibleId: null }),
    },
  });
  if (existing) return null;

  try {
    return await prisma.alerteSysteme.create({
      data: {
        code: input.code,
        niveau: input.niveau,
        titre: input.titre,
        message: input.message,
        ...(input.cibleType !== undefined ? { cibleType: input.cibleType } : {}),
        ...(input.cibleId !== undefined ? { cibleId: input.cibleId } : {}),
        metadata: (input.metadata ?? {}) as never,
      },
    });
  } catch (err) {
    // P2002 = violation de contrainte d'unicité. Quelqu'un a créé la même
    // alerte entre notre lecture et notre écriture : le résultat voulu est
    // atteint, il l'est juste par l'autre. On rend `null`, comme pour un
    // doublon détecté à la lecture — TOUTE autre erreur remonte.
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
      return null;
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// resoudreAlerte
// ─────────────────────────────────────────────────────────────────────────────

export async function resoudreAlerte(id: string): Promise<AlerteSysteme | null> {
  if (isStub()) return null;
  return prisma.alerteSysteme.update({
    where: { id },
    data: { resolue: true, resolueAt: new Date() },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// marquerLu
// ─────────────────────────────────────────────────────────────────────────────

export async function marquerLu(id: string): Promise<AlerteSysteme | null> {
  if (isStub()) return null;
  return prisma.alerteSysteme.update({
    where: { id },
    data: { lu: true },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// marquerToutLu
// ─────────────────────────────────────────────────────────────────────────────

export async function marquerToutLu(): Promise<{ count: number }> {
  if (isStub()) return { count: 0 };
  const result = await prisma.alerteSysteme.updateMany({
    where: { lu: false },
    data: { lu: true },
  });
  return { count: result.count };
}

// ─────────────────────────────────────────────────────────────────────────────
// listAlertes
// ─────────────────────────────────────────────────────────────────────────────

export async function listAlertes(options?: ListAlertesOptions): Promise<AlerteSysteme[]> {
  if (isStub()) return [];
  return prisma.alerteSysteme.findMany({
    where: {
      ...(options?.resolue !== undefined ? { resolue: options.resolue } : {}),
      ...(options?.lu !== undefined ? { lu: options.lu } : {}),
      ...(options?.niveau !== undefined ? { niveau: options.niveau } : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    ...(options?.limit !== undefined ? { take: options.limit } : {}),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// countNonLues
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alertes non lues ET encore ACTIVES.
 *
 * 🔴 `resolue: false` manquait. Le compteur additionnait donc les alertes déjà
 * résolues mais jamais marquées lues — et résoudre une alerte ne la marque pas
 * lue. La pastille affichait 17 là où la page listait 5 alertes actives, et
 * l'écart ne pouvait que croître : une pastille qu'on ne peut pas faire
 * redescendre cesse d'être un signal.
 */
export async function countNonLues(): Promise<number> {
  if (isStub()) return 0;
  return prisma.alerteSysteme.count({ where: { lu: false, resolue: false } });
}

/**
 * Combien d'alertes ACTIVES au total, éventuellement pour un seul niveau.
 *
 * 🔴 2026-09-02 (audit certificateur) — l'écran des alertes calculait son total
 * en comptant les lignes qu'il venait de rendre. Tant que la liste n'était pas
 * plafonnée, les deux nombres coïncidaient ; le jour où on la plafonne, ils
 * divergent, et l'écran annoncerait « 100 alertes actives » là où le registre en
 * porte 1 589. Le COMPTE vient donc d'un compteur, l'AFFICHAGE d'une liste
 * bornée — jamais l'un déduit de l'autre.
 */
export async function countAlertesActives(
  niveau?: AlerteNiveau,
  opts?: { readonly lu?: boolean },
): Promise<number> {
  if (isStub()) return 0;
  return prisma.alerteSysteme.count({
    where: {
      resolue: false,
      ...(niveau !== undefined ? { niveau } : {}),
      ...(opts?.lu !== undefined ? { lu: opts.lu } : {}),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// synchroniserAlertes
// ─────────────────────────────────────────────────────────────────────────────

/** Ce qu'un passage du moteur a réellement fait — et ce qu'il a laissé de côté. */
export interface SyntheseSynchronisation {
  crees: number;
  resolues: number;
  /**
   * Règles dont la moisson a été tronquée au plafond. 🔴 Remontée jusqu'ici
   * exprès : une troncature qui ne quitte pas l'évaluateur n'est pas déclarée,
   * elle est journalisée — et un journal que personne ne lit ne prévient
   * personne. L'appelant (cron, action de console) doit pouvoir la relayer.
   */
  tronquees: { nom: string; trouvees: number; retenues: number }[];
  /**
   * Alertes DEJA OUVERTES dont le libelle a ete remis a jour depuis la regle.
   *
   * Declare pour la meme raison que `tronquees` : un rafraichissement muet ne
   * previent personne qu'un texte a change sous les yeux du lecteur. Vaut
   * normalement zero.
   */
  rafraichies: number;
}

/**
 * Évalue les alertes, crée les nouvelles et résout automatiquement celles dont
 * la condition a disparu.
 *
 * T3a — un `createMany` et un `updateMany`, au lieu d'un aller-retour par
 * alerte. La dé-duplication est désormais garantie par un index unique partiel
 * (migration `20260816160000_alertes_dedup_garantie_base`) et non plus par une
 * lecture-puis-écriture que deux passages concurrents pouvaient traverser.
 */
export async function synchroniserAlertes(): Promise<SyntheseSynchronisation> {
  if (isStub()) return { crees: 0, resolues: 0, tronquees: [], rafraichies: 0 };

  const {
    candidates: candidats,
    reglesEnEchec,
    reglesTronquees: tronquees,
  } = await evaluerAlertesDetaille();

  // ── T3a — une SALVE, plus un aller-retour par alerte ──────────────────────
  //
  // Avant : pour chaque candidate, un `findFirst` puis un `create`. À 400
  // alertes ouvertes et 28 règles, le cron passait des centaines d'allers-
  // retours à faire ce qu'une insertion sait faire seule — et la dé-duplication
  // reposait sur une lecture-puis-écriture que deux passages concurrents
  // pouvaient traverser tous les deux.
  //
  // `skipDuplicates` s'appuie sur l'index UNIQUE PARTIEL posé par la migration
  // `20260816160000_alertes_dedup_garantie_base` : la base refuse le doublon,
  // le moteur n'a plus à le chercher. La règle métier n'a pas bougé d'un mot ;
  // c'est le nombre de requêtes qui change.
  //
  // ⚠️ Deux candidates identiques DANS LE MÊME lot : `ON CONFLICT DO NOTHING`
  // ne dédoublonne pas à l'intérieur d'une même commande sur toutes les
  // versions. On dédoublonne donc en mémoire avant d'insérer — c'est gratuit et
  // ça ne dépend pas du comportement exact de Postgres.
  const vus = new Set<string>();
  const aInserer = candidats
    .filter((c) => {
      const cle = `${c.code}::${c.cibleId ?? "null"}`;
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    })
    .map((c) => ({
      code: c.code,
      niveau: c.niveau,
      titre: c.titre,
      message: c.message,
      ...(c.cibleType !== undefined ? { cibleType: c.cibleType } : {}),
      ...(c.cibleId !== undefined ? { cibleId: c.cibleId } : {}),
      // Pas de `metadata` : `AlerteCandidate` n'en porte pas, et la colonne a
      // `@default("{}")`. L'ancien code passait `input.metadata ?? {}` sur un
      // champ qu'aucune règle ne renseignait — une valeur par défaut recopiée
      // à la main.
    }));

  const { count: crees } =
    aInserer.length > 0
      ? await prisma.alerteSysteme.createMany({ data: aInserer, skipDuplicates: true })
      : { count: 0 };

  // ── 🔴 UNE CORRECTION DE LIBELLE N'ATTEIGNAIT JAMAIS LE STOCK ─────────────
  //
  // `createMany({ skipDuplicates: true })` INSERE ou NE FAIT RIEN. Une alerte
  // deja ouverte garde donc, pour toujours, le titre et le message ecrits le
  // jour de sa creation — meme quand la regle qui la produit a ete corrigee.
  //
  // Cas reel du 2026-09-06, releve sur la prod par une session voisine :
  // `emargement_aucune_signature` disait « Liens d'emargement PARTIS, aucune
  // signature ». La regle ne sait rien d'un envoi — sa condition est « un jeton
  // vivant existe », c'est-a-dire FABRIQUE, et `emettreLiensSessionAction` ne
  // contient aucun `enqueueEmail`. Le titre a ete corrige en « Lien d'emargement
  // EMIS » le 2026-09-05 (`catalogue.ts`, `evaluateur.ts:567`), et l'ecran
  // affichait toujours l'ancien : les lignes ouvertes n'avaient pas bouge.
  //
  // 🔑 Ce n'est pas un detail de formulation. Le commentaire du catalogue le dit
  // lui-meme : « une alerte qui nomme une cause fausse est pire qu'une alerte
  // absente — elle deplace l'attention ». Elle l'a fait : le libelle a oriente
  // vers « relancer la stagiaire » alors que l'hypothese vivante etait qu'elle
  // n'avait jamais rien recu.
  //
  // ⚠️ On NE touche ni `resolue`, ni `resolueAt`, ni `createdAt` : l'anciennete
  // d'une alerte est une information, la rafraichir la ferait rajeunir. Seuls
  // le titre, le message et le niveau — c'est-a-dire ce que la REGLE dit
  // aujourd'hui — sont remis a jour.
  //
  // ⚠️ Une LECTURE d'abord, des ecritures ensuite, et seulement sur ce qui a
  // reellement derive : le cas courant est zero ecriture. Ecrire sans comparer
  // ferait tourner `updatedAt` de toutes les alertes ouvertes chaque nuit.
  let rafraichies = 0;
  if (aInserer.length > 0) {
    const codes = [...new Set(aInserer.map((c) => c.code))];
    const ouvertes = await prisma.alerteSysteme.findMany({
      where: { resolue: false, code: { in: codes } },
      select: { id: true, code: true, cibleId: true, titre: true, message: true, niveau: true },
    });
    const parCle = new Map(ouvertes.map((a) => [`${a.code}::${a.cibleId ?? "null"}`, a]));

    for (const c of aInserer) {
      const ligne = parCle.get(`${c.code}::${c.cibleId ?? "null"}`);
      if (ligne === undefined) continue;
      if (ligne.titre === c.titre && ligne.message === c.message && ligne.niveau === c.niveau) {
        continue;
      }
      await prisma.alerteSysteme.update({
        where: { id: ligne.id },
        data: { titre: c.titre, message: c.message, niveau: c.niveau },
      });
      rafraichies++;
    }

    if (rafraichies > 0) {
      console.warn(
        `[alertes-service] ${rafraichies} alerte(s) ouverte(s) rafraichie(s) : leur libelle ` +
          "avait derive de la regle qui les produit.",
      );
    }
  }

  // 🔴 Une règle en échec (fail-soft) ne produit AUCUNE candidate : résoudre
  // « ce qui n'est plus signalé » effacerait alors en masse toutes les alertes
  // ouvertes de ses codes — un timeout DB un matin suffirait. Créations
  // conservées, résolution suspendue jusqu'au prochain tour sain.
  if (reglesEnEchec.length > 0) {
    console.warn(
      `[alertes-service] résolution auto SUSPENDUE ce tour : ${reglesEnEchec.length} règle(s) en échec (${reglesEnEchec.join(", ")})`,
    );
    return { crees, resolues: 0, tronquees, rafraichies };
  }

  // Résolution automatique : codes à resolutionAuto=true dont la condition
  // a disparu — on vérifie par (code, cibleId) pour la précision.
  const codesAutoResolution = Object.entries(ALERTE_CATALOGUE)
    .filter(([, entry]) => entry.resolutionAuto)
    .map(([code]) => code);

  // Ensemble des (code::cibleId) encore actifs
  const actifSet = new Set(candidats.map((c) => `${c.code}::${c.cibleId ?? "null"}`));

  const alertesOuvertes = await prisma.alerteSysteme.findMany({
    where: {
      code: { in: codesAutoResolution },
      resolue: false,
    },
    select: { id: true, code: true, cibleId: true },
  });

  // ── T3a — UN `updateMany`, plus un `update` par alerte ────────────────────
  //
  // Le `try/catch` par alerte du code précédent n'était pas une résilience : il
  // avalait l'erreur et passait à la suivante, si bien qu'un incident de base
  // laissait le compteur `resolues` mentir sur ce qui avait réellement été
  // écrit. Une seule commande est à la fois plus rapide et plus honnête —
  // elle réussit entièrement ou échoue franchement.
  const aResoudre = alertesOuvertes
    .filter((a) => !actifSet.has(`${a.code}::${a.cibleId ?? "null"}`))
    .map((a) => a.id);

  const { count: resolues } =
    aResoudre.length > 0
      ? await prisma.alerteSysteme.updateMany({
          where: { id: { in: aResoudre } },
          data: { resolue: true, resolueAt: new Date() },
        })
      : { count: 0 };

  return { crees, resolues, tronquees, rafraichies };
}
