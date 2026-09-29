/**
 * Ce que le BALAYAGE du circuit doit faire pour l'enregistreur (PR 5) :
 *
 *   · clôture d'office des enregistrements abandonnés (`cloture.ts`) ;
 *   · témoin de clé déchiffré côté worker (`temoin-cle.ts`) ;
 *   · alertes TECHNIQUES, une fois chacune (table `alertes_visio`) :
 *       - jeton d'appareil qui expire (J-14, puis J-3) ;
 *       - extension silencieuse pendant un rendez-vous « Discutons » ;
 *       - témoin de clé en échec (clé absente ou différente sur le worker).
 *
 * ⚠️ BRANCHEMENT. Le balayage lui-même (`visio-balayage-worker`, cadence
 * 5 min) est livré par la PR 4, pas encore fusionnée quand cette PR a été
 * écrite. `balayerEnregistreur()` est donc exporté ici, prêt à être appelé par
 * ce worker (une ligne, au rebase). En attendant, la clôture tourne aussi à
 * chaque requête de l'extension (`garde-route.ts`) : le cas qui compte — un
 * enregistrement abandonné pendant qu'on s'en sert — est couvert.
 *
 * Alertes : pannes techniques SEULEMENT, jamais de nom de personne, jamais de
 * parole. Une alerte n'est marquée envoyée que si `notify()` dit `sent`.
 *
 * Module sans `server-only` : il est destiné au worker.
 */

import type { CategorieAlerteVisio, PrismaClient } from "../../../prisma/generated/client";
import { cloturerEnregistrements, type BilanCloture } from "./cloture";
import { extensionSilencieuse } from "./battement-appareil";
import { lireDrapeauEnregistrement } from "./drapeau";
import { joursAvantExpiration, seuilAlerteJeton } from "./jeton";
import { verifierTemoinCleWorker } from "./temoin-cle";

export interface Notifieur {
  (alerte: {
    readonly cle: string;
    readonly titre: string;
    readonly detail: string;
  }): Promise<boolean>;
}

type Db = Pick<
  PrismaClient,
  | "enregistrement"
  | "appareilEnregistrement"
  | "calendlyEvent"
  | "alerteVisio"
  | "setting"
  | "battementCircuit"
>;

/**
 * Envoie une alerte une seule fois (clé stable). Rejouée tant que l'envoi n'a
 * pas abouti. Rend vrai si l'alerte est (ou était déjà) envoyée.
 */
export async function alerterUneFois(
  db: Pick<PrismaClient, "alerteVisio">,
  notifier: Notifieur,
  alerte: {
    readonly cle: string;
    readonly categorie: CategorieAlerteVisio;
    readonly titre: string;
    readonly detail: string;
  },
  maintenant: Date,
): Promise<boolean> {
  const cle = alerte.cle.slice(0, 120);
  const ligne = await db.alerteVisio.upsert({
    where: { cle },
    create: { cle, categorie: alerte.categorie, premiereLe: maintenant },
    update: {},
  });
  if (ligne.envoyeeLe) return true;
  let envoyee = false;
  try {
    envoyee = await notifier({ cle, titre: alerte.titre, detail: alerte.detail });
  } catch {
    envoyee = false;
  }
  await db.alerteVisio.update({
    where: { cle },
    data: {
      essais: { increment: 1 },
      dernierEssaiLe: maintenant,
      ...(envoyee ? { envoyeeLe: maintenant } : {}),
    },
  });
  return envoyee;
}

export interface BilanBalayageEnregistreur {
  readonly cloture: BilanCloture;
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
  },
): Promise<BilanBalayageEnregistreur> {
  const { maintenant } = entree;
  const drapeau = lireDrapeauEnregistrement(entree.env ?? process.env, maintenant);
  const cloture = await cloturerEnregistrements(db, maintenant);
  let alertes = 0;

  // Témoin de clé : lu par le worker. Rien à vérifier tant que le site ne l'a
  // pas écrit (aucune requête de l'extension encore) : ce n'est pas une panne.
  const temoin = await verifierTemoinCleWorker(db, {
    maintenant,
    drapeauBrut: drapeau.demande,
    version: entree.version,
  });
  const temoinOk = temoin === "absent" || temoin.ok;
  if (!temoinOk && drapeau.effectif !== "ferme") {
    const envoyee = await alerterUneFois(
      db,
      notifier,
      {
        cle: `temoin-cle:${maintenant.toISOString().slice(0, 10)}`,
        categorie: "configuration",
        titre: "Visio : le worker ne relit pas le témoin de clé",
        detail:
          "PII_ENCRYPTION_KEY absente ou différente sur le worker : le son déposé ne pourra pas être transcrit.",
      },
      maintenant,
    );
    if (envoyee) alertes += 1;
  }

  // Jetons qui expirent (J-14, J-3) : une alerte par appareil et par seuil.
  const appareils = await db.appareilEnregistrement.findMany({
    where: { revoqueLe: null },
    select: { id: true, expireLe: true, revoqueLe: true, dernierBattementLe: true },
  });
  for (const a of appareils) {
    const seuil = seuilAlerteJeton(a, maintenant);
    if (seuil === null) continue;
    const envoyee = await alerterUneFois(
      db,
      notifier,
      {
        cle: `jeton-expire:${a.id}:j${seuil}`,
        categorie: "configuration",
        titre: `Visio : le jeton de l'enregistreur expire dans ${joursAvantExpiration(a.expireLe, maintenant)} jour(s)`,
        detail:
          "Console → Rendez-vous → Enregistreur → « Renouveler », puis coller le nouveau jeton dans l'extension.",
      },
      maintenant,
    );
    if (envoyee) alertes += 1;
  }

  // Extension silencieuse pendant un rendez-vous « Discutons ».
  if (drapeau.effectif === "ouvert") {
    const enCours = await db.calendlyEvent.findMany({
      where: {
        startTime: { lte: maintenant },
        endTime: { gte: maintenant },
        status: { not: "canceled" },
      },
      select: { id: true, eventTypeName: true },
    });
    if (extensionSilencieuse({ rendezVousEnCours: enCours, appareils }, maintenant)) {
      const ev = enCours[0];
      const envoyee = await alerterUneFois(
        db,
        notifier,
        {
          cle: `extension-silencieuse:${ev?.id ?? maintenant.toISOString().slice(0, 13)}`,
          categorie: "circuit",
          titre: "Visio : l'extension ne donne aucun signe pendant un rendez-vous",
          detail:
            "Chrome fermé, extension désactivée ou jeton absent : le rendez-vous en cours ne sera pas enregistré.",
        },
        maintenant,
      );
      if (envoyee) alertes += 1;
    }
  }

  return { cloture, temoinOk, alertes };
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
    payload: { kind: "visio_enregistreur", details: { titre: alerte.titre, detail: alerte.detail } },
    dedupKey: alerte.cle,
  });
  return Object.values(r.channels).includes("sent");
};
