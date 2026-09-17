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

  const cible = input.cibleId !== undefined ? { cibleId: input.cibleId } : { cibleId: null };

  const existing = await prisma.alerteSysteme.findFirst({
    where: { code: input.code, resolue: false, ...cible },
  });
  if (existing) return null;

  // 🔴 2026-09-07 — `resolutionAuto: false` NE TENAIT PAS SA PROMESSE.
  //
  // Le `findFirst` ci-dessus ne regarde que les alertes NON résolues. Une alerte
  // fermée à la main était donc RECRÉÉE à l'identique au balayage suivant, dès
  // que sa règle produisait encore le candidat. Pour un code dont la cause est un
  // fait PASSÉ — une session démarrée sans accord tracé, un taux de satisfaction
  // déjà mesuré sous le seuil —, aucun geste humain ne pouvait la fermer :
  // l'administrateur cliquait « Résoudre » et la retrouvait le lendemain matin.
  //
  // Vécu le 2026-09-06 sur `formateur_mission_expiree` (corrigé au cas par cas
  // par #1016) ; l'audit qui a suivi a trouvé SEPT autres codes dans la même
  // situation — `resolutionAuto: false` ET produits par `evaluerAlertes`.
  //
  // 🔑 Le drapeau ne pilotait QUE la résolution automatique, jamais la
  // re-création. Son nom disait l'inverse de ce qu'il faisait, et c'est ce qui
  // rendait le défaut invisible : on lisait « la fermeture est un acte humain »
  // là où le code disait « la fermeture ne tient pas ».
  //
  // ⚠️ La comparaison porte sur le MESSAGE, et pas seulement sur (code, cible).
  // Un « ne jamais recréer après résolution » serait faux : une habilitation
  // renouvelée puis ré-expirée des années plus tard doit crier de nouveau. Le
  // message porte la donnée qui distingue les deux cas — la date d'échéance, la
  // valeur mesurée, le nom de la pièce. Message identique = la même chose est
  // redite à quelqu'un qui a déjà répondu ; message différent = un fait NOUVEAU,
  // et l'alerte doit revenir.
  if (ALERTE_CATALOGUE[input.code]?.resolutionAuto === false) {
    const dejaTraitee = await prisma.alerteSysteme.findFirst({
      where: { code: input.code, resolue: true, message: input.message, ...cible },
      select: { id: true },
    });
    if (dejaTraitee) return null;
  }

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
// creerOuActualiser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée l'alerte, ou RAFRAÎCHIT celle qui est déjà ouverte.
 *
 * 🔴 2026-09-17 — LE DÉFAUT QUE `creerOuDedup` LAISSAIT PASSER, ET QU'IL A
 * COÛTÉ 43 HEURES.
 *
 * `creerOuDedup` rend `null` dès qu'une alerte du même code est ouverte, et ne
 * touche à rien. C'est juste pour un fait ACCOMPLI — « ce devis est expiré » ne
 * change pas de contenu. C'est faux pour un ÉTAT QUI DURE : pendant la panne
 * d'envoi du 15 au 17 septembre, le titre affiché à l'écran restait figé sur le
 * compte du tout premier passage, alors que les échecs s'accumulaient. Une
 * alerte dont le contenu ne bouge plus se lit comme une vieille alerte qu'on a
 * déjà vue — c'est-à-dire qu'elle cesse d'informer précisément au moment où
 * elle aurait le plus à dire.
 *
 * Pire : une alerte de ce genre n'étant jamais refermée automatiquement (voir
 * `resolutionAuto`), la dé-duplication est définitive. La PREMIÈRE panne de
 * l'histoire du système consomme le signal, et toutes les suivantes sont
 * silencieuses tant que personne n'a cliqué « résolue ». Un fusible qui ne
 * fond qu'une fois.
 *
 * Ici, on met à jour `titre`, `message` et `metadata` de l'alerte ouverte, et
 * on la repasse NON LUE : l'état a changé, il mérite un second regard.
 * `createdAt` n'est PAS touché — « depuis quand » doit rester le début de
 * l'incident, pas l'heure du dernier passage du cron.
 */
export async function creerOuActualiser(input: AlerteInput): Promise<AlerteSysteme | null> {
  if (isStub()) return null;

  const existante = await prisma.alerteSysteme.findFirst({
    where: {
      code: input.code,
      resolue: false,
      ...(input.cibleId !== undefined ? { cibleId: input.cibleId } : { cibleId: null }),
    },
    select: { id: true, titre: true, message: true, niveau: true },
  });

  if (existante) {
    // ⚠️ Une LECTURE d'abord, une écriture ensuite, et seulement sur ce qui a
    // réellement bougé — même discipline que le rafraîchissement de
    // `synchroniserAlertes`. Réécrire à l'identique ferait tourner `updatedAt`
    // à chaque passage horaire, et surtout re-marquerait l'alerte « non lue »
    // toutes les heures : au bout d'une journée, la pastille qui devrait dire
    // « du nouveau » ne dirait plus que « le cron est passé ».
    const identique =
      existante.titre === input.titre &&
      existante.message === input.message &&
      existante.niveau === input.niveau;
    if (identique) return null;

    return prisma.alerteSysteme.update({
      where: { id: existante.id },
      data: {
        titre: input.titre,
        message: input.message,
        niveau: input.niveau,
        // L'état a CHANGÉ (le compte a monté, le motif a tourné) : ce n'est plus
        // l'alerte qu'on a lue hier, elle mérite un second regard.
        lu: false,
        metadata: (input.metadata ?? {}) as never,
      },
    });
  }

  return creerOuDedup(input);
}

// ─────────────────────────────────────────────────────────────────────────────
// resoudreAlertesParCode
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Referme toutes les alertes ouvertes portant l'un de ces codes.
 *
 * 🔑 Ce n'est PAS `resolutionAuto`, et la distinction est le cœur du sujet.
 * `synchroniserAlertes` referme ce que son balayage ne voit plus parmi les
 * candidates — or les alertes de la sonde e-mail ne sont JAMAIS des candidates
 * de ce balayage, donc les y inscrire les ferait refermer au premier tour, avant
 * lecture (c'est le piège que le catalogue documente sur six codes).
 *
 * Ici, c'est l'ÉMETTEUR qui referme, et seulement sur une preuve positive :
 * un envoi a réussi depuis. Un appelant qui n'a rien pu mesurer ne doit pas
 * appeler cette fonction — l'absence de mesure n'est pas un rétablissement.
 */
export async function resoudreAlertesParCode(codes: readonly string[]): Promise<number> {
  if (isStub() || codes.length === 0) return 0;
  const { count } = await prisma.alerteSysteme.updateMany({
    where: { code: { in: [...codes] }, resolue: false },
    data: { resolue: true, resolueAt: new Date() },
  });
  return count;
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
  /**
   * 🔴 RÈGLES QUI ONT LEVÉ ce tour, par leur NOM.
   *
   * Remontée jusqu'ici pour la même raison que `tronquees`, et l'enjeu est plus
   * grand : une seule règle en échec SUSPEND la résolution automatique de
   * TOUTES les alertes (voir plus bas). Le tableau se fige, les alertes qui
   * devraient se fermer s'accumulent, et la lecture devient du bruit — c'est-à-
   * dire ce qui apprend à ignorer les critiques.
   *
   * ⚠️ Les NOMS, jamais un compte. « 3 règles en échec » est un nombre qui bouge
   * pour plusieurs raisons et qu'on apprend à survoler ; un nom qui apparaît est
   * un fait, et c'est lui qui permet d'agir.
   */
  reglesEnEchec: string[];
}

/**
 * Clé du marqueur d'état du dernier balayage.
 *
 * 🔑 Il faut une TRACE PERSISTÉE, et pas seulement une valeur de retour : le
 * balayage nominal est un CRON. Sa synthèse ne passe devant personne. Sans
 * marqueur, l'état « une règle boite » ne serait visible qu'à l'instant où
 * quelqu'un clique « Synchroniser » — c'est-à-dire presque jamais, et jamais au
 * moment où ça compte.
 */
const CLE_DERNIER_BALAYAGE = "alertes_dernier_balayage";

/** L'état du dernier passage du moteur, tel que l'écran le lit. */
export interface EtatDernierBalayage {
  /** Horodatage ISO du dernier balayage connu. */
  readonly at: string;
  /** Noms des règles qui ont levé à ce passage. Vide = moteur sain. */
  readonly reglesEnEchec: readonly string[];
}

/**
 * Consigne l'état du balayage qui vient d'avoir lieu.
 *
 * ⚠️ ÉCRIT À CHAQUE PASSAGE, y compris quand tout va bien — et c'est la moitié
 * de la correction. Un marqueur posé seulement en cas d'échec resterait affiché
 * après la réparation : l'écran annoncerait une panne résolue depuis des
 * semaines, et on apprendrait à ignorer ce bandeau-là aussi.
 *
 * ⚠️ FAIL-SOFT : ne pas pouvoir écrire le marqueur ne doit pas faire échouer le
 * balayage. La trace est un confort de lecture ; les alertes, elles, sont le
 * travail.
 */
async function consignerBalayage(reglesEnEchec: string[], at: Date): Promise<void> {
  try {
    const valeur: EtatDernierBalayage = { at: at.toISOString(), reglesEnEchec };
    await prisma.siteSetting.upsert({
      where: { key: CLE_DERNIER_BALAYAGE },
      create: {
        key: CLE_DERNIER_BALAYAGE,
        value: valeur as unknown as object,
        description:
          "État du dernier balayage du moteur d'alertes (horodatage + règles en échec). Écrit à chaque passage, y compris sain. Lu par l'écran des alertes.",
        category: "general",
      },
      update: { value: valeur as unknown as object },
    });
  } catch (err) {
    console.warn("[alertes-service] marqueur de balayage non écrit (fail-soft)", err);
  }
}

/**
 * L'état du dernier balayage, ou `null` si aucun n'a encore été consigné.
 *
 * ⚠️ `null` ne veut PAS dire « tout va bien » : il veut dire « on ne sait pas ».
 * L'écran doit le formuler ainsi — c'est le cas d'un moteur qui n'a jamais
 * tourné depuis la livraison de ce marqueur, et le confondre avec un moteur sain
 * rétablirait le silence qu'on corrige.
 */
export async function lireDernierBalayage(): Promise<EtatDernierBalayage | null> {
  if (isStub()) return null;
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: CLE_DERNIER_BALAYAGE },
      select: { value: true },
    });
    const v = row?.value;
    /*
      ⚠️ CETTE LIGNE N'EST PAS OBSERVABLE PAR UN TEST, et je l'écris plutôt que
      de faire semblant. Une mutation qui la neutralise laisse la suite verte :
      sur une chaîne, un nombre ou un tableau, `o["at"]` vaut `undefined` et le
      contrôle suivant rend déjà `null`.

      Ce qu'elle évite tient à la FORME du chemin, pas à son résultat : sans
      elle, une valeur `null` ou absente ferait LEVER `o["at"]`, et c'est le
      `catch` qui rendrait `null`. Même réponse, obtenue par une exception —
      c'est-à-dire une exception utilisée comme flot de contrôle, dans un
      `catch` qui est là pour les pannes de base.

      On la garde pour cette raison-là, et pour aucune autre.
    */
    if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    if (typeof o["at"] !== "string") return null;
    const regles = Array.isArray(o["reglesEnEchec"])
      ? (o["reglesEnEchec"] as unknown[]).filter((r): r is string => typeof r === "string")
      : [];
    return { at: o["at"], reglesEnEchec: regles };
  } catch {
    return null;
  }
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
  if (isStub()) return { crees: 0, resolues: 0, tronquees: [], rafraichies: 0, reglesEnEchec: [] };

  const {
    candidates: candidats,
    reglesEnEchec,
    reglesTronquees: tronquees,
    codesTronques,
  } = await evaluerAlertesDetaille();

  // 🔑 Consigné AVANT toute sortie anticipée : l'état du moteur est connu ici,
  // et c'est le seul endroit où les deux chemins — sain et boiteux — passent.
  await consignerBalayage(reglesEnEchec, new Date());

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
    return { crees, resolues: 0, tronquees, rafraichies, reglesEnEchec };
  }

  // Résolution automatique : codes à resolutionAuto=true dont la condition
  // a disparu — on vérifie par (code, cibleId) pour la précision.
  //
  // 🔴 2026-09-15 — SAUF les codes d'une règle TRONQUÉE ce tour. Une candidate
  // écartée par le plafond n'a pas disparu, elle n'a pas été lue : la fermer
  // serait prendre une limite de lecture pour une cause résolue. Seuls ces codes
  // sont gelés ; les autres se referment normalement.
  const gelesParTroncature = new Set(codesTronques);
  if (gelesParTroncature.size > 0) {
    console.warn(
      `[alertes-service] résolution auto GELÉE ce tour pour ${gelesParTroncature.size} code(s) ` +
        `tronqué(s) (${[...gelesParTroncature].join(", ")})`,
    );
  }
  const codesAutoResolution = Object.entries(ALERTE_CATALOGUE)
    .filter(([code, entry]) => entry.resolutionAuto && !gelesParTroncature.has(code))
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

  return { crees, resolues, tronquees, rafraichies, reglesEnEchec };
}
