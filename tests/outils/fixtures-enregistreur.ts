/**
 * Jeux de données FICTIFS des tests de l'enregistreur (PR 5). Aucune donnée
 * réelle : le dépôt est public.
 */

import { createHash, randomUUID } from "node:crypto";

import type { PrismaClient } from "../../prisma/generated/client";
import { ENTETE_CONTRAT, ENTETES_MORCEAU } from "../../src/lib/schemas/enregistreur";
import type { DependancesRoutes } from "../../src/server/visio/routes-enregistreur";
import { hacherJeton, JETON_SANS_EXPIRATION } from "../../src/server/visio/jeton";
import { fausseBase, fauxStockage, type FausseBase } from "./fausse-base-enregistreur";

/** Un mardi d'octobre 2026, 10 h à Paris. */
export const T0 = new Date("2026-10-06T08:00:00.000Z");
export const JOUR = 86_400_000;
export const MINUTE = 60_000;

/** Clé de chiffrement de test (jamais une vraie clé). */
export const CLE_DE_TEST = "0123456789abcdef".repeat(4);

export function commePrisma(db: FausseBase): PrismaClient {
  return db as unknown as PrismaClient;
}

export function semerAppareil(
  db: FausseBase,
  o: {
    role?: string;
    status?: string;
    expireLe?: Date;
    revoqueLe?: Date | null;
    dernierBattementLe?: Date | null;
  } = {},
): { readonly jeton: string; readonly appareilId: string; readonly adminUserId: string } {
  const jeton = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const admin = db.semer("adminUser", {
    role: o.role ?? "super_admin",
    status: o.status ?? "active",
  });
  const appareil = db.semer("appareilEnregistrement", {
    nom: "Poste de test",
    jetonHash: hacherJeton(jeton),
    adminUserId: admin["id"],
    // Le jeton n'expire plus (révision du 02/10) : la date sentinelle par défaut.
    expireLe: o.expireLe ?? JETON_SANS_EXPIRATION,
    revoqueLe: o.revoqueLe ?? null,
    dernierBattementLe: o.dernierBattementLe ?? null,
  });
  return { jeton, appareilId: String(appareil["id"]), adminUserId: String(admin["id"]) };
}

/** La rencontre du client fictif (pilote). */
export function semerRencontreTest(
  db: FausseBase,
  o: { debutPrevu?: Date; clientId?: string; estTestInterne?: boolean; type?: string } = {},
): { readonly rencontreId: string; readonly clientId: string } {
  const clientId =
    o.clientId ?? String(db.semer("client", { raisonSociale: "Atelier Test Fictif" })["id"]);
  const r = db.semer("rencontre", {
    source: "saisie_manuelle",
    type: o.type ?? "visio",
    estTestInterne: o.estTestInterne ?? true,
    titre: "Rendez-vous de test",
    debutPrevu: o.debutPrevu ?? new Date(T0.getTime() + 5 * MINUTE),
    finPrevue: new Date((o.debutPrevu ?? T0).getTime() + 50 * MINUTE),
    clientId,
    rattachementStatut: "valide",
  });
  return { rencontreId: String(r["id"]), clientId };
}

/** Un rendez-vous Calendly et sa rencontre. */
export function semerRencontreCalendly(
  db: FausseBase,
  o: {
    eventTypeName?: string;
    startTime?: Date;
    inviteeEmail?: string;
    inviteeName?: string;
    reponses?: ReadonlyArray<{ question: string; answer: string }>;
    linkedJobApplicationId?: string | null;
    avecRencontre?: boolean;
    /** Réservé par une adresse de test (ADR 0061). */
    estTestInterne?: boolean;
  } = {},
): { readonly calendlyEventId: string; readonly rencontreId: string | null } {
  const startTime = o.startTime ?? new Date(T0.getTime() + 5 * MINUTE);
  const ev = db.semer("calendlyEvent", {
    eventTypeName: o.eventTypeName ?? "Discutons de votre projet IA",
    startTime,
    endTime: new Date(startTime.getTime() + 30 * MINUTE),
    inviteeEmail: o.inviteeEmail ?? "prospect@exemple.test",
    inviteeName: o.inviteeName ?? "Camille Exemple",
    location: "https://meet.google.com/abc-defg-hij",
    rawPayload: { invitee: { questions_and_answers: o.reponses ?? [] } },
    linkedJobApplicationId: o.linkedJobApplicationId ?? null,
  });
  if (o.avecRencontre === false) return { calendlyEventId: String(ev["id"]), rencontreId: null };
  const r = db.semer("rencontre", {
    source: "calendly",
    type: "visio",
    calendlyEventId: ev["id"],
    titre: String(ev["eventTypeName"]),
    debutPrevu: startTime,
    finPrevue: ev["endTime"],
    ...(o.estTestInterne ? { estTestInterne: true } : {}),
  });
  return { calendlyEventId: String(ev["id"]), rencontreId: String(r["id"]) };
}

/** Un enregistrement dans un état donné. */
export function semerEnregistrement(
  db: FausseBase,
  o: {
    rencontreId: string;
    appareilId: string;
    statut: string;
    debut?: Date;
    updatedAt?: Date;
    fin?: Date | null;
    motifArret?: string | null;
    accordConfirmeLe?: Date | null;
    nature?: "visio" | "dictee";
  },
): string {
  const e = db.semer("enregistrement", {
    rencontreId: o.rencontreId,
    appareilId: o.appareilId,
    nature: o.nature ?? "visio",
    cleClient: randomUUID(),
    statut: o.statut,
    debut: o.debut ?? T0,
    fin: o.fin ?? null,
    motifArret: o.motifArret ?? null,
    accordConfirmeLe: o.accordConfirmeLe ?? null,
    evenements: "[]",
    versionExtension: "1.1.0",
    versionContrat: 1,
    updatedAt: o.updatedAt ?? T0,
  });
  return String(e["id"]);
}

export function depsDeTest(
  db: FausseBase,
  o: {
    env?: Record<string, string | undefined>;
    maintenant?: Date;
    stockage?: ReturnType<typeof fauxStockage>;
    limiteOk?: boolean;
    temoinOk?: boolean;
  } = {},
): DependancesRoutes & { readonly stockage: ReturnType<typeof fauxStockage> } {
  const stockage = o.stockage ?? fauxStockage();
  return {
    db: async () => commePrisma(db),
    limiter: async () => o.limiteOk ?? true,
    temoin: async () =>
      o.temoinOk === false ? { ok: false, raison: "cle_absente" } : { ok: true },
    cloturer: async () => undefined,
    env: () =>
      o.env ?? { ENREGISTREMENT_VISIO_PILOTE: "true", DATABASE_URL: "postgresql://t@localhost/t" },
    maintenant: () => o.maintenant ?? T0,
    stockage,
  };
}

/** Une requête de l'extension (en-tête du contrat compris). */
export function requete(
  chemin: string,
  o: {
    methode?: string;
    jeton?: string | null;
    corps?: unknown;
    octets?: Buffer;
    type?: string;
    entetes?: Record<string, string>;
  } = {},
): Request {
  const entetes: Record<string, string> = { [ENTETE_CONTRAT]: "1", ...(o.entetes ?? {}) };
  if (o.jeton) entetes["authorization"] = `Bearer ${o.jeton}`;
  let body: BodyInit | undefined;
  if (o.octets) {
    body = new Uint8Array(o.octets);
    entetes["content-type"] = o.type ?? "application/octet-stream";
    entetes["content-length"] = String(o.octets.byteLength);
  } else if (o.corps !== undefined) {
    body = JSON.stringify(o.corps);
    entetes["content-type"] = o.type ?? "application/json";
  } else if (o.type) {
    entetes["content-type"] = o.type;
  }
  return new Request(`https://axion-ia.com/api/enregistreur/${chemin}`, {
    method: o.methode ?? (body ? "POST" : "GET"),
    headers: entetes,
    ...(body !== undefined ? { body } : {}),
  });
}

/** Les en-têtes d'un morceau, empreinte calculée. */
export function entetesMorceau(
  octets: Buffer,
  o: { piste?: string; tranche?: number; seq?: number; debutCaptureMs?: number | null } = {},
): Record<string, string> {
  const h: Record<string, string> = {
    [ENTETES_MORCEAU.piste]: o.piste ?? "client",
    [ENTETES_MORCEAU.tranche]: String(o.tranche ?? 0),
    [ENTETES_MORCEAU.seq]: String(o.seq ?? 0),
    [ENTETES_MORCEAU.empreinte]: createHash("sha256").update(octets).digest("hex"),
  };
  if (o.debutCaptureMs !== null)
    h[ENTETES_MORCEAU.debutCaptureMs] = String(o.debutCaptureMs ?? T0.getTime());
  return h;
}

export { fausseBase, fauxStockage };

/** Le corps de `POST sessions`. */
export function corpsSession(
  rencontreId: string,
  o: {
    nature?: "visio" | "dictee";
    accordLocalLe?: Date | null;
    debutLe?: Date;
    cleClient?: string;
  } = {},
) {
  return {
    cleClient: o.cleClient ?? randomUUID(),
    rencontreId,
    nature: o.nature ?? ("visio" as const),
    versionExtension: "1.1.0",
    debutLe: (o.debutLe ?? T0).toISOString(),
    accordLocalLe: o.accordLocalLe ? o.accordLocalLe.toISOString() : null,
    nbParticipants: 2,
  };
}
