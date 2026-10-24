/**
 * Les ALERTES du circuit visio (chantier visio, PR 4 ; plan §3.14) — sur le
 * magasin d'alertes EXISTANT (correction anti-doublon A3).
 *
 * ## Une seule table d'alertes : `AlerteSysteme`
 *
 * Aucune table ni aucun service parallèle : une panne du circuit s'écrit dans
 * `AlerteSysteme` par `creerOuDedup` (`qualiopi/alertes/alertes-service.ts`),
 * avec un code `visio.*` déclaré au catalogue. Elle apparaît donc dans l'écran
 * d'alertes de la console, avec sa dé-duplication (code, cible), sa
 * résolution et son routage. La table `AlerteVisio` posée par la PR 2 reste
 * VIDE et abandonnée (aucune migration destructive : son retrait, s'il vient,
 * sera une PR `schema` à part).
 *
 * ## Un seul objet de codes, une seule façon de « signaler une fois » (V1, C3)
 *
 * `CODES_ALERTES_VISIO` porte TOUS les codes `visio.*` (balayage du dossier
 * client, enregistreur, circuit du compte rendu) ; `CODES_ALERTES_CIRCUIT`
 * (`alertes-circuit.ts`) n'en est que l'alias. Et `signalerUneFois` est la
 * seule règle d'envoi : créer par `creerOuDedup`, envoyer si l'alerte ouverte
 * n'est pas encore partie, marquer `notifiedAt` (colonne existante) SEULEMENT
 * si l'envoi a réussi — un envoi raté repart au passage suivant. Avant, le
 * balayage du dossier client marquait `metadata.telegramLe` pendant que
 * l'enregistreur marquait `notifiedAt` : un correctif posé d'un côté ne
 * s'appliquait pas à l'autre, et un écran qui lisait `notifiedAt` se trompait
 * pour `visio.balayage_en_panne`.
 *
 * ## Pannes techniques seulement — pas de rappel de travail
 *
 * « Rendez-vous tenu sans compte rendu » (l'ancien « F1 ») n'est PAS une alerte :
 * c'est la pastille « À faire le point » qui existe déjà
 * (`admin-rendezvous/suivi-queries.ts`). Deux rappels pour le même geste après
 * un appel, c'était un doublon. Rien de ce qui est du travail de Will ne part
 * sur Telegram (décision B17 sans réponse).
 *
 * ## La panne du balayage du dossier client
 *
 * Une panne OUVERTE = une alerte `visio.balayage_en_panne` non résolue. Les
 * étapes en panne sont listées dans `metadata.etapes`, chaque essai d'envoi
 * est compté (`metadata.essais`). Toutes les étapes revenues au vert →
 * l'alerte est résolue ; une rechute ouvre une NOUVELLE alerte (son message
 * porte l'instant de la panne : pour `creerOuDedup`, c'est un fait nouveau) et
 * repart.
 *
 * Aucune parole, aucun nom de personne dans une alerte (PA-12).
 *
 * Module neutre (le worker l'appelle ; types seulement à l'import). `notify`
 * et la création sont INJECTÉS : les tests n'envoient rien. Par défaut,
 * `creerOuDedup` est chargé à la demande (il tire le client Prisma global).
 */

import type { NotifyInput, NotifyResult } from "@/server/notifications/types";
import type { AlerteInput } from "@/server/qualiopi/alertes/alertes-service";
import type { Tx } from "@/features/dossier-client/base";

/**
 * TOUS les codes d'alerte du chantier visio. Chacun est au catalogue
 * (`ALERTE_CATALOGUE`), sans résolution automatique, pour la direction
 * (gardes `les-codes-d-alerte-du-circuit-sont-au-catalogue.spec.ts`,
 * `la-table-alertes-visio-reste-vide.spec.ts`).
 */
export const CODES_ALERTES_VISIO = {
  // ── balayage du dossier client (PR 4) ──
  /** Une étape du balayage du dossier client échoue. */
  balayageEnPanne: "visio.balayage_en_panne",
  /**
   * Des rendez-vous Calendly que la fiche automatique n'a pas osé ranger : ce n'est
   * PAS une panne (code propre, jamais mêlé à `balayageEnPanne` ni à `etapesEnEchec`).
   */
  rendezVousAClasser: "visio.rendez_vous_a_classer",
  /**
   * Une fiche prospect créée toute seule ressemble à d'autres (« doublon possible »).
   * Une alerte par fiche (cible = la fiche) : à fusionner plus tard, quand le SIRET est connu.
   */
  doublonPossible: "visio.doublon_possible",
  // ── enregistreur (PR 5) ──
  /** Le worker ne relit pas le témoin de clé. */
  temoinCle: "visio.temoin_cle",
  // (Les alertes J-14 / J-3 d'expiration du jeton sont retirées : le jeton
  // n'expire plus depuis la révision du 02/10, décision de Williams.)
  /** L'extension ne donne aucun signe pendant un rendez-vous. */
  extensionSilencieuse: "visio.extension_silencieuse",
  /** V2, N2 — un appareil bat avec une extension qui ne peut plus enregistrer de visio. */
  extensionTropAncienne: "visio.extension_trop_ancienne",
  /** V2, N3 — une fin tardive signale une personne sans accord après le traitement. */
  fenetreTardive: "visio.fenetre_tardive",
  // ── circuit du compte rendu (PR 6) ──
  /** Crédit OpenAI épuisé, plafond atteint, clé absente : en pause. */
  circuitSuspendu: "visio.circuit_suspendu",
  /**
   * Une étape programmée que le worker en place ne sait pas exécuter (V1 F4).
   * Code DISTINCT de `circuitSuspendu` : l'anti-doublon porte sur
   * (code, cible) et les deux sont sans cible — sous le même code, une pause
   * « quota » déjà ouverte avalait celle qui nomme l'étape.
   */
  etapeSansGestionnaire: "visio.etape_sans_gestionnaire",
  /** Une étape a échoué définitivement : note manuelle proposée. */
  etapeEnEchec: "visio.etape_en_echec",
  /** La base n'est pas migrée depuis plus de 2 heures. */
  schemaEnRetard: "visio.schema_en_retard",
  /** Une demande d'arrêt de l'enregistrement a été entendue. */
  demandeDArret: "visio.demande_d_arret",
  /** Un compte rendu attend la validation de Will (rappel de travail, console). */
  compteRenduAValider: "visio.compte_rendu_a_valider",
  /** Un son n'a pas été supprimé à son échéance. */
  audioNonPurge: "visio.audio_non_purge",
  /** Une étape attend une réponse de Will (enregistrement de moins de 90 s). */
  reponseAttendue: "visio.reponse_attendue",
} as const;

/** Le code d'une panne du balayage du dossier client. */
export const VISIO_BALAYAGE_EN_PANNE = CODES_ALERTES_VISIO.balayageEnPanne;

export type Notifier = (input: NotifyInput<"MONITORING_ALERT">) => Promise<NotifyResult>;

export type CreerAlerte = (input: AlerteInput) => Promise<unknown>;

export type ResultatSignalement = "envoyee" | "deja_envoyee" | "echec_envoi";

type TxAlertes = Pick<Tx, "alerteSysteme">;

type Metadonnees = Record<string, string | number | null | string[]>;

async function creerOuDedupParDefaut(input: AlerteInput): Promise<unknown> {
  const { creerOuDedup } = await import("@/server/qualiopi/alertes/alertes-service");
  return creerOuDedup(input);
}

/** Une alerte technique à signaler une fois. */
export interface AlerteASignaler {
  readonly code: string;
  readonly niveau: AlerteInput["niveau"];
  readonly titre: string;
  readonly message: string;
  /** `null` : une alerte sans cible (une par code). */
  readonly cibleId: string | null;
  readonly cibleType?: string;
  readonly metadata?: Metadonnees;
}

/**
 * LA règle d'envoi des alertes visio (V1, C3). Crée l'alerte (dé-dupliquée
 * par `creerOuDedup`), puis l'envoie si l'alerte OUVERTE (code, cible) n'est
 * pas encore partie. `notifiedAt` n'est posé que si `envoyer` répond vrai.
 * `completer` met à jour les métadonnées de l'alerte ouverte à chaque passage
 * (`tente` : un envoi vient d'être essayé).
 *
 * Rend `null` quand aucune alerte n'est ouverte après la création (fermée à la
 * main avec le même message : rien à envoyer, choix de Will).
 */
export async function signalerUneFois(
  db: TxAlertes,
  alerte: AlerteASignaler,
  deps: {
    readonly envoyer: () => Promise<boolean>;
    readonly creer?: CreerAlerte;
    readonly maintenant: Date;
    readonly completer?: (actuelles: unknown, tente: boolean) => Metadonnees;
  },
): Promise<ResultatSignalement | null> {
  await (deps.creer ?? creerOuDedupParDefaut)({
    code: alerte.code,
    niveau: alerte.niveau,
    titre: alerte.titre,
    message: alerte.message,
    ...(alerte.cibleId !== null
      ? { cibleType: alerte.cibleType ?? "visio", cibleId: alerte.cibleId }
      : {}),
    ...(alerte.metadata ? { metadata: alerte.metadata } : {}),
  });
  const ouverte = await db.alerteSysteme.findFirst({
    where: { code: alerte.code, resolue: false, cibleId: alerte.cibleId },
    select: { id: true, notifiedAt: true, metadata: true },
  });
  if (!ouverte) return null;
  // Avant V1 C3, le balayage marquait `metadata.telegramLe` au lieu de
  // `notifiedAt` : une alerte ouverte à cette époque est DÉJÀ partie (sinon
  // elle repartait une fois sur Telegram au déploiement).
  if (ouverte.notifiedAt || dejaPartieAvantC3(ouverte.metadata)) {
    if (deps.completer) {
      await db.alerteSysteme.update({
        where: { id: ouverte.id },
        data: { metadata: deps.completer(ouverte.metadata, false) },
      });
    }
    return "deja_envoyee";
  }
  let envoyee = false;
  try {
    envoyee = await deps.envoyer();
  } catch {
    envoyee = false;
  }
  const metadata = deps.completer?.(ouverte.metadata, true);
  if (envoyee || metadata) {
    await db.alerteSysteme.update({
      where: { id: ouverte.id },
      data: {
        ...(metadata ? { metadata } : {}),
        ...(envoyee ? { notifiedAt: deps.maintenant } : {}),
      },
    });
  }
  return envoyee ? "envoyee" : "echec_envoi";
}

function dejaPartieAvantC3(metadata: unknown): boolean {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    typeof (metadata as Record<string, unknown>)["telegramLe"] === "string"
  );
}

interface MetaPanne {
  etapes: string[];
  essais: number;
  dernierEssaiLe: string | null;
}

function lireMeta(brut: unknown): MetaPanne {
  const m = brut !== null && typeof brut === "object" ? (brut as Record<string, unknown>) : {};
  return {
    etapes: Array.isArray(m["etapes"])
      ? m["etapes"].filter((e): e is string => typeof e === "string")
      : [],
    essais: typeof m["essais"] === "number" ? m["essais"] : 0,
    dernierEssaiLe: typeof m["dernierEssaiLe"] === "string" ? m["dernierEssaiLe"] : null,
  };
}

async function panneOuverte(db: TxAlertes) {
  return db.alerteSysteme.findFirst({
    where: { code: VISIO_BALAYAGE_EN_PANNE, resolue: false, cibleId: null },
    select: { id: true, metadata: true },
  });
}

/**
 * Une étape du balayage échoue : l'alerte est ouverte (ou complétée) dans
 * `AlerteSysteme`, puis envoyée sur Telegram si elle n'est pas encore partie.
 */
export async function signalerPanneDuBalayage(
  db: TxAlertes,
  panne: { readonly etape: string; readonly erreur: string },
  deps: { readonly notifier: Notifier; readonly creer?: CreerAlerte; readonly maintenant?: Date },
): Promise<ResultatSignalement> {
  const maintenant = deps.maintenant ?? new Date();
  const titre = "Balayage du dossier client en panne";
  const r = await signalerUneFois(
    db,
    {
      code: VISIO_BALAYAGE_EN_PANNE,
      niveau: "important",
      titre,
      message:
        `Le balayage du dossier client échoue depuis le ${maintenant.toISOString()} ` +
        `(étape « ${panne.etape} »). Il continue de tourner ; les autres étapes passent.`,
      cibleId: null,
      metadata: { etapes: [panne.etape], essais: 0, dernierEssaiLe: null },
    },
    {
      maintenant,
      ...(deps.creer ? { creer: deps.creer } : {}),
      envoyer: async () => {
        const n = await deps.notifier({
          category: "MONITORING_ALERT",
          payload: {
            kind: VISIO_BALAYAGE_EN_PANNE,
            details: {
              legacyBody: `${titre}\n\nÉtape « ${panne.etape} » en échec (${panne.erreur}).`,
              etape: panne.etape,
              erreur: panne.erreur,
            },
          },
        });
        return n.channels.telegram === "sent";
      },
      completer: (actuelles, tente) => {
        const meta = lireMeta(actuelles);
        if (!meta.etapes.includes(panne.etape)) meta.etapes.push(panne.etape);
        return tente
          ? { ...meta, essais: meta.essais + 1, dernierEssaiLe: maintenant.toISOString() }
          : { ...meta };
      },
    },
  );
  return r ?? "echec_envoi";
}

/**
 * L'étape est revenue au vert : elle sort de la panne ; plus aucune étape en
 * panne → l'alerte est résolue (une rechute en ouvrira une nouvelle).
 */
export async function leverPanneDuBalayage(
  db: TxAlertes,
  etape: string,
  maintenant: Date = new Date(),
): Promise<boolean> {
  const ouverte = await panneOuverte(db);
  if (ouverte === null) return false;
  const meta = lireMeta(ouverte.metadata);
  if (!meta.etapes.includes(etape)) return false;
  const reste = meta.etapes.filter((e) => e !== etape);
  await db.alerteSysteme.update({
    where: { id: ouverte.id },
    data:
      reste.length === 0
        ? { resolue: true, resolueAt: maintenant, metadata: { ...meta, etapes: [] } }
        : { metadata: { ...meta, etapes: reste } },
  });
  return reste.length === 0;
}

/**
 * « N rendez-vous à classer » : la fiche automatique a laissé des rendez-vous à
 * Will (doute). Code PROPRE, sans rapport avec une panne : il ne passe jamais par
 * `VISIO_BALAYAGE_EN_PANNE`. `nombre` 0 résout l'alerte ouverte.
 *
 * L'identité de l'alerte est l'EMPREINTE de l'ensemble trié des rendez-vous à classer
 * (condensat court, sans nom ni adresse), dans le message ET `metadata.empreinte` :
 *   · même ensemble, alerte ouverte → rien ; envoi raté (`notifiedAt` vide) → retenté ;
 *   · même ensemble, alerte FERMÉE à la main → rien (`creerOuDedup` retrouve son message) :
 *     Will a répondu, on ne le redit pas ;
 *   · ensemble différent (un rendez-vous de plus, ou un autre après 1 -> 0 -> 1) → l'ouverte
 *     est refermée et une nouvelle s'ouvre, avec un message neuf donc une nouvelle alerte.
 * Ne contient ni nom ni adresse : des nombres, des raisons, un condensat.
 */
export async function signalerRendezVousAClasser(
  db: TxAlertes,
  etat: {
    readonly nombre: number;
    readonly raisons: Readonly<Record<string, number>>;
    readonly empreinte: string;
  },
  deps: { readonly notifier: Notifier; readonly creer?: CreerAlerte; readonly maintenant?: Date },
): Promise<ResultatSignalement | "resolue" | "rien"> {
  const maintenant = deps.maintenant ?? new Date();
  const code = CODES_ALERTES_VISIO.rendezVousAClasser;
  const ouverte = await db.alerteSysteme.findFirst({
    where: { code, resolue: false, cibleId: null },
    select: { id: true, metadata: true, notifiedAt: true },
  });
  if (etat.nombre <= 0) {
    if (ouverte === null) return "rien";
    await db.alerteSysteme.update({
      where: { id: ouverte.id },
      data: { resolue: true, resolueAt: maintenant },
    });
    return "resolue";
  }
  const empreinteOuverte =
    ouverte !== null &&
    ouverte.metadata !== null &&
    typeof ouverte.metadata === "object" &&
    typeof (ouverte.metadata as Record<string, unknown>)["empreinte"] === "string"
      ? ((ouverte.metadata as Record<string, unknown>)["empreinte"] as string)
      : null;
  // Même ensemble, déjà envoyée : rien. Pas encore envoyée : on retombe sur `signalerUneFois`,
  // avec le MÊME message (l'alerte est retrouvée, rien n'est créé, l'envoi est retenté).
  if (ouverte !== null && empreinteOuverte === etat.empreinte && ouverte.notifiedAt) {
    return "deja_envoyee";
  }
  if (ouverte !== null && empreinteOuverte !== etat.empreinte) {
    await db.alerteSysteme.update({
      where: { id: ouverte.id },
      data: { resolue: true, resolueAt: maintenant },
    });
  }
  // Triées : le message (donc l'identité de l'alerte) ne dépend pas de l'ordre de la base.
  const raisonsTriees = Object.entries(etat.raisons).sort(([a], [b]) => a.localeCompare(b));
  const detail = raisonsTriees.map(([r, n]) => `${n} ${r}`).join(", ");
  const titre = `${etat.nombre} rendez-vous à classer à la main`;
  const r = await signalerUneFois(
    db,
    {
      code,
      niveau: "important",
      titre,
      message:
        // Le message porte l'empreinte : le même ensemble redit le même message (dé-dupliqué,
        // y compris après une fermeture à la main), un ensemble différent en fait un neuf.
        `La fiche automatique n'a pas rangé ${etat.nombre} rendez-vous Calendly ` +
        `(${detail}) [empreinte ${etat.empreinte}]. ` +
        `Ce n'est pas une panne : ouvrez l'onglet « À classer » de la console.`,
      cibleId: null,
      metadata: {
        nombre: etat.nombre,
        empreinte: etat.empreinte,
        raisons: raisonsTriees.map(([r, n]) => `${r}:${n}`),
      },
    },
    {
      maintenant,
      ...(deps.creer ? { creer: deps.creer } : {}),
      envoyer: async () => {
        const n = await deps.notifier({
          category: "MONITORING_ALERT",
          payload: {
            kind: code,
            details: {
              legacyBody: `${titre}

${detail}`,
              nombre: etat.nombre,
            },
          },
        });
        return n.channels.telegram === "sent";
      },
    },
  );
  return r ?? "echec_envoi";
}

/**
 * « Doublon possible » : une fiche vient d'être créée toute seule alors que
 * `nombreProches` fiches lui ressemblent. Une alerte par fiche créée (dé-dupliquée
 * par `signalerUneFois` sur la cible), sans nom ni adresse : le lien est dans
 * l'historique de la fiche.
 */
export async function signalerDoublonPossible(
  db: TxAlertes,
  doublon: { readonly clientId: string; readonly proches: number },
  deps: { readonly notifier: Notifier; readonly creer?: CreerAlerte; readonly maintenant?: Date },
): Promise<ResultatSignalement> {
  const maintenant = deps.maintenant ?? new Date();
  const code = CODES_ALERTES_VISIO.doublonPossible;
  const titre = "Fiche prospect créée : doublon possible";
  const r = await signalerUneFois(
    db,
    {
      code,
      niveau: "important",
      titre,
      message:
        `Une fiche prospect a été créée toute seule au rendez-vous, mais ${doublon.proches} ` +
        `fiche(s) lui ressemble(nt). Le lien est dans son historique ; la fusion se fera ` +
        `quand le SIRET sera renseigné.`,
      cibleType: "Client",
      cibleId: doublon.clientId,
      metadata: { proches: doublon.proches },
    },
    {
      maintenant,
      ...(deps.creer ? { creer: deps.creer } : {}),
      envoyer: async () => {
        const n = await deps.notifier({
          category: "MONITORING_ALERT",
          payload: {
            kind: code,
            details: {
              legacyBody: `${titre}

${doublon.proches} fiche(s) proche(s).`,
              proches: doublon.proches,
            },
          },
        });
        return n.channels.telegram === "sent";
      },
    },
  );
  return r ?? "echec_envoi";
}

/**
 * Envoie les alertes « doublon possible » écrites avec leur fiche mais pas encore parties
 * (`notifiedAt` vide) : un envoi raté, ou un passage interrompu, est retenté au suivant.
 */
export async function envoyerDoublonsEnAttente(
  db: Pick<Tx, "alerteSysteme">,
  deps: { readonly notifier: Notifier; readonly creer?: CreerAlerte; readonly maintenant?: Date },
): Promise<number> {
  const enAttente = await db.alerteSysteme.findMany({
    where: { code: CODES_ALERTES_VISIO.doublonPossible, resolue: false, notifiedAt: null },
    select: { cibleId: true, metadata: true },
    take: 50,
  });
  let n = 0;
  for (const a of enAttente) {
    if (!a.cibleId) continue;
    const meta = a.metadata !== null && typeof a.metadata === "object" ? a.metadata : {};
    const proches = (meta as Record<string, unknown>)["proches"];
    await signalerDoublonPossible(
      db,
      { clientId: a.cibleId, proches: typeof proches === "number" ? proches : 0 },
      deps,
    );
    n += 1;
  }
  return n;
}
