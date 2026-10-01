/**
 * Ce que le BALAYAGE du circuit doit faire pour l'enregistreur (PR 5) :
 *
 *   · clôture d'office des enregistrements abandonnés (`cloture.ts`) ;
 *   · reprise des purges de refus (`reprendrePurgesDesRefus`) : un son qui a
 *     résisté à la suppression, un morceau arrivé pendant un refus ;
 *   · témoin de clé déchiffré côté worker (`temoin-cle.ts`) ;
 *   · alertes TECHNIQUES :
 *       - jeton d'appareil qui expire (J-14, puis J-3) ;
 *       - extension silencieuse pendant un rendez-vous « Discutons » ;
 *       - témoin de clé en échec (clé absente ou différente sur le worker).
 *
 * ## Les alertes passent par `AlerteSysteme` (anti-doublon A3)
 *
 * Pas de table ni de service d'alerte parallèle : chaque alerte est créée par
 * `creerOuDedup` (`qualiopi/alertes/alertes-service.ts`) avec un code `visio.*`
 * du catalogue (guichet « direction », `resolutionAuto: false` : c'est CE
 * balayage qui la ferme quand la cause disparaît). La table `alertes_visio`
 * posée par la PR 2 reste vide : elle est abandonnée (ADR 0053, amendement du
 * 29/09 ; garde `la-table-alertes-visio-reste-vide.spec.ts`).
 *
 * Une alerte ouverte part UNE fois sur Telegram (`notify`, catégorie
 * `MONITORING_ALERT`) ; elle n'est marquée envoyée (`notifiedAt`) que si un
 * canal répond `sent` : un envoi raté est retenté au passage suivant. C'est la
 * règle commune `signalerUneFois` (`alertes.ts`, V1 C3), et les codes viennent
 * de l'objet unique `CODES_ALERTES_VISIO`. Le
 * niveau `important` la tient hors de l'envoi groupé par e-mail
 * (`envoi-groupe.ts` ne prend que les `critique`), donc `notifiedAt` n'a qu'un
 * seul écrivain pour ces codes.
 *
 * BRANCHEMENT. `balayerEnregistreur()` est appelé à chaque passage du
 * balayage de la PR 4 (`visio-balayage-worker`, cadence 5 min), après le
 * dossier client et dans son propre `try`. Garde :
 * `le-worker-de-balayage-appelle-l-enregistreur.spec.ts`. La clôture et la
 * reprise des purges tournent aussi à chaque requête de l'extension
 * (`garde-route.ts`).
 *
 * Alertes : pannes techniques SEULEMENT, jamais de nom de personne, jamais de
 * parole. Module sans `server-only` : il est destiné au worker.
 */

import type { PrismaClient } from "../../../prisma/generated/client";
import type { AlerteInput } from "@/server/qualiopi/alertes/alertes-service";
import { CODES_ALERTES_VISIO, signalerUneFois } from "./alertes";
import { cloturerEnregistrements, type BilanCloture } from "./cloture";
import { extensionSilencieuse } from "./battement-appareil";
import { lireDrapeauEnregistrement } from "./drapeau";
import { joursAvantExpiration, seuilAlerteJeton } from "./jeton";
import {
  reprendrePurgesDesRefus,
  versionAccepteePourVisio,
  type BilanReprisePurges,
} from "./sessions";
import { stockageR2, type StockageAudio } from "./stockage-audio";
import { verifierTemoinCleWorker } from "./temoin-cle";

export interface Notifieur {
  (alerte: {
    readonly cle: string;
    readonly titre: string;
    readonly detail: string;
  }): Promise<boolean>;
}

/** `creerOuDedup` — injecté par les tests, le vrai sinon (import paresseux). */
export type CreerAlerte = (input: AlerteInput) => Promise<unknown>;

const creerOuDedupReel: CreerAlerte = async (input) => {
  const { creerOuDedup } = await import("@/server/qualiopi/alertes/alertes-service");
  return creerOuDedup(input);
};

type Db = Pick<
  PrismaClient,
  | "enregistrement"
  | "enregistrementTranche"
  | "enregistrementMorceau"
  | "appareilEnregistrement"
  | "calendlyEvent"
  | "alerteSysteme"
  | "setting"
  | "battementCircuit"
>;

interface AlerteVisio {
  readonly code: string;
  readonly cibleId: string | null;
  readonly titre: string;
  readonly message: string;
  readonly metadata?: Record<string, string | number | null | string[]>;
}

/**
 * Crée l'alerte et l'envoie sur Telegram si elle ne l'a pas encore été, par
 * la règle commune `signalerUneFois`. Rend vrai si elle est partie à CE passage.
 */
async function signaler(
  db: Pick<PrismaClient, "alerteSysteme">,
  creer: CreerAlerte,
  notifier: Notifieur,
  alerte: AlerteVisio,
  maintenant: Date,
): Promise<boolean> {
  const r = await signalerUneFois(
    db,
    {
      code: alerte.code,
      niveau: "important",
      titre: alerte.titre,
      message: alerte.message,
      cibleId: alerte.cibleId,
      cibleType: "appareil_enregistrement",
      ...(alerte.metadata ? { metadata: alerte.metadata } : {}),
    },
    {
      creer,
      maintenant,
      envoyer: () =>
        notifier({
          cle: `${alerte.code}:${alerte.cibleId ?? "-"}`,
          titre: alerte.titre,
          detail: alerte.message,
        }),
    },
  );
  return r === "envoyee";
}

/** La cause a disparu : l'alerte ouverte se ferme (elle repartira si elle revient). */
async function lever(
  db: Pick<PrismaClient, "alerteSysteme">,
  code: string,
  cibleId: string | null,
  maintenant: Date,
): Promise<void> {
  await db.alerteSysteme.updateMany({
    where: { code, resolue: false, cibleId },
    data: { resolue: true, resolueAt: maintenant },
  });
}

export interface BilanBalayageEnregistreur {
  readonly cloture: BilanCloture;
  readonly purges: BilanReprisePurges;
  readonly temoinOk: boolean;
  readonly alertes: number;
}

/** Une passe de balayage pour l'enregistreur. */
export async function balayerEnregistreur(
  db: Db,
  notifier: Notifieur,
  entree: {
    readonly maintenant: Date;
    readonly version: string;
    readonly env?: Record<string, string | undefined>;
    readonly creer?: CreerAlerte;
    readonly stockage?: StockageAudio;
  },
): Promise<BilanBalayageEnregistreur> {
  const { maintenant } = entree;
  const creer = entree.creer ?? creerOuDedupReel;
  const drapeau = lireDrapeauEnregistrement(entree.env ?? process.env);
  const cloture = await cloturerEnregistrements(db, maintenant);
  const purges = await reprendrePurgesDesRefus(db, entree.stockage ?? stockageR2, maintenant);
  let alertes = 0;
  const jour = maintenant.toISOString().slice(0, 10);

  // Témoin de clé : lu par le worker. Rien à vérifier tant que le site ne l'a
  // pas écrit (aucune requête de l'extension encore) : ce n'est pas une panne.
  const temoin = await verifierTemoinCleWorker(db, {
    maintenant,
    drapeauBrut: drapeau.demande,
    version: entree.version,
  });
  const temoinOk = temoin === "absent" || temoin.ok;
  if (!temoinOk && drapeau.effectif !== "ferme") {
    const envoyee = await signaler(
      db,
      creer,
      notifier,
      {
        code: CODES_ALERTES_VISIO.temoinCle,
        cibleId: null,
        titre: "Visio : comptes rendus bloqués (clé de sécurité absente) — prévenez Claude",
        // La date distingue une rechute d'une alerte déjà close à la main.
        message: `Constaté le ${jour} : PII_ENCRYPTION_KEY absente ou différente sur le worker, le son déposé ne pourra pas être transcrit.`,
      },
      maintenant,
    );
    if (envoyee) alertes += 1;
  } else if (temoinOk) {
    await lever(db, CODES_ALERTES_VISIO.temoinCle, null, maintenant);
  }

  // Jetons qui expirent (J-14, J-3) : une alerte par appareil et par seuil.
  const appareils = await db.appareilEnregistrement.findMany({
    select: {
      id: true,
      expireLe: true,
      revoqueLe: true,
      dernierBattementLe: true,
      versionExtension: true,
    },
  });
  for (const a of appareils) {
    // V2, N2 — une copie sans RGPD-01 sur un appareil valide : le site refuse
    // ses visios ; Will doit recopier l'extension avant le prochain appel.
    const version = a.versionExtension ?? null;
    const tropAncienne =
      a.revoqueLe === null &&
      a.expireLe.getTime() > maintenant.getTime() &&
      version !== null &&
      !versionAccepteePourVisio(version);
    if (tropAncienne) {
      const envoyee = await signaler(
        db,
        creer,
        notifier,
        {
          code: CODES_ALERTES_VISIO.extensionTropAncienne,
          cibleId: a.id,
          titre: "Visio : l'extension du poste est trop ancienne pour enregistrer",
          message: `Constaté le ${jour} : version ${(version ?? "").slice(0, 20)} sur le poste, les visios seront refusées. Recopiez l'extension à jour puis rechargez-la dans Chrome.`,
        },
        maintenant,
      );
      if (envoyee) alertes += 1;
    } else {
      await lever(db, CODES_ALERTES_VISIO.extensionTropAncienne, a.id, maintenant);
    }
    const seuil = seuilAlerteJeton(a, maintenant);
    const codeSeuil =
      seuil === 14
        ? CODES_ALERTES_VISIO.jetonJ14
        : seuil === 3
          ? CODES_ALERTES_VISIO.jetonJ3
          : null;
    // Jeton renouvelé, révoqué, ou passé au seuil suivant : l'ancienne alerte se ferme.
    for (const code of [CODES_ALERTES_VISIO.jetonJ14, CODES_ALERTES_VISIO.jetonJ3]) {
      if (code !== codeSeuil) await lever(db, code, a.id, maintenant);
    }
    if (codeSeuil === null) continue;
    const envoyee = await signaler(
      db,
      creer,
      notifier,
      {
        code: codeSeuil,
        cibleId: a.id,
        titre: `Visio : le jeton de l'enregistreur expire dans ${joursAvantExpiration(a.expireLe, maintenant)} jour(s)`,
        message: `Jeton valable jusqu'au ${a.expireLe.toISOString().slice(0, 10)}. Console → Rendez-vous → Enregistreur → « Renouveler », puis coller le nouveau jeton dans l'extension.`,
      },
      maintenant,
    );
    if (envoyee) alertes += 1;
  }

  // Extension silencieuse pendant un rendez-vous « Discutons ».
  let silencieuse = false;
  let ev: { id: string; startTime: Date | null } | undefined;
  if (drapeau.effectif === "ouvert") {
    const enCours = await db.calendlyEvent.findMany({
      where: {
        startTime: { lte: maintenant },
        endTime: { gte: maintenant },
        status: { not: "canceled" },
      },
      select: { id: true, eventTypeName: true, linkedJobApplicationId: true, startTime: true },
    });
    const actifs = appareils.filter((a) => a.revoqueLe === null);
    silencieuse = extensionSilencieuse(
      { rendezVousEnCours: enCours, appareils: actifs },
      maintenant,
    );
    ev = enCours[0];
  }
  if (silencieuse) {
    const envoyee = await signaler(
      db,
      creer,
      notifier,
      {
        code: CODES_ALERTES_VISIO.extensionSilencieuse,
        cibleId: null,
        titre: "Visio : l'extension ne donne aucun signe pendant un rendez-vous",
        message: `Rendez-vous commencé à ${ev?.startTime?.toISOString().slice(0, 16) ?? jour} (UTC) : Chrome fermé, extension désactivée ou jeton absent, il ne sera pas enregistré.`,
        metadata: { calendlyEventId: ev?.id ?? null },
      },
      maintenant,
    );
    if (envoyee) alertes += 1;
  } else {
    await lever(db, CODES_ALERTES_VISIO.extensionSilencieuse, null, maintenant);
  }

  return { cloture, purges, temoinOk, alertes };
}

/**
 * Le notifieur réel : une alerte technique `MONITORING_ALERT` (Telegram),
 * comptée envoyée seulement si un canal répond `sent`. Aucun nom, aucune parole.
 * Import paresseux : rien n'est chargé tant qu'aucune alerte ne part.
 */
export const notifierParTelegram: Notifieur = async (alerte) => {
  const { notify } = await import("@/server/notifications");
  const r = await notify({
    category: "MONITORING_ALERT",
    payload: {
      kind: "visio_enregistreur",
      details: { titre: alerte.titre, detail: alerte.detail },
    },
    dedupKey: alerte.cle,
  });
  return Object.values(r.channels).includes("sent");
};
