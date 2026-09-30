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
  // ── enregistreur (PR 5) ──
  /** Le worker ne relit pas le témoin de clé. */
  temoinCle: "visio.temoin_cle",
  /** Le jeton de l'appareil expire dans 14 jours. */
  jetonJ14: "visio.jeton_expire_j14",
  /** Le jeton de l'appareil expire dans 3 jours. */
  jetonJ3: "visio.jeton_expire_j3",
  /** L'extension ne donne aucun signe pendant un rendez-vous. */
  extensionSilencieuse: "visio.extension_silencieuse",
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
