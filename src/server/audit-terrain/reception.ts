/**
 * Réception des événements d'audit présentiel (PR2) : cœur partagé par
 * `POST /api/audit-terrain/v1/evenements` et `GET /api/audit-terrain/v1/etat`.
 *
 * Contrat côté PC : `_PLAN-AUDIT-PRESENTIEL-2026-11-02/outil-local/serveur.mjs`.
 * Format des réponses 200 (décidé ici, l'outil attend des LISTES d'eventId) :
 *   { acceptes: string[], dejaRecus: string[], conflits: string[], dernierSeqRecu: number, trous: number[] }
 *   - acceptes  : écrits par cet appel ;
 *   - dejaRecus : même eventId, même contenu (rejeu) ; rien n'est réécrit ;
 *   - conflits  : même eventId, autre contenu ; rien n'est écrit, un journal d'accès le consigne.
 *
 * Règles de fer :
 *   - sessionId et clientId viennent UNIQUEMENT de la ligne trouvée par l'empreinte du jeton ;
 *   - toute cause de refus d'authentification (inconnu, faux, autre session, expiré, révoqué,
 *     statut) donne la MÊME réponse 401, sans dire laquelle ;
 *   - événements écrits par `create` seulement (jamais upsert/update sur le contenu) ;
 *   - ni corps, ni Authorization, ni message de zod dans un journal ou dans Sentry ;
 *   - limitation de débit : si Redis tombe, on REFUSE (503), le PC réessaie.
 */
import { createHash, createHmac } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/security/ip-hash";
import { ipDepuisEntetes } from "@/lib/client-ip-core";
import { chiffrerParole } from "@/lib/chiffrer-parole";
import { ecrireJournalActivite } from "@/server/content-gen/shared/activity-log-writer";
import { lireJeton, memeEmpreinte, type JetonLu } from "./jeton";
import {
  MAX_CORPS_OCTETS,
  corpsLotSchema,
  donneesRapportSchema,
  type EvenementRecu,
} from "./schema";

const LIMITE = { limit: 60, windowSec: 60, surPanne: "refuser" } as const;
const MAX_TROUS = 200;

const json = (corps: unknown, status: number, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(corps), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...h },
  });

const non401 = () => json({ erreur: "non_autorise" }, 401);
const non422 = () => json({ erreur: "schema" }, 422);

/* ---------- empreintes ---------- */

const sha256 = (t: string) => createHash("sha256").update(t, "utf8").digest("hex");

/** HMAC du SHA-256 du contenu, clé dérivée de PII_ENCRYPTION_KEY (déjà exigée pour chiffrer). */
export function empreinteServeur(shaHex: string): string {
  const hex = process.env["PII_ENCRYPTION_KEY"];
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("cle_absente");
  const sousCle = createHmac("sha256", Buffer.from(hex, "hex")).update("audit-terrain/empreinte/v1").digest();
  return createHmac("sha256", sousCle).update(shaHex.toLowerCase()).digest("hex");
}

/* ---------- erreurs sans fuite ---------- */

function signaler(err: unknown, etape: string): void {
  const code = typeof (err as { code?: unknown })?.code === "string" ? (err as { code: string }).code : "";
  const nom = err instanceof Error ? err.name : "inconnue";
  // On n'envoie JAMAIS le message d'origine (il peut citer une valeur, un corps ou un jeton).
  Sentry.captureException(new Error(`audit-terrain ${etape}: ${nom} ${code}`.trim()), {
    tags: { service: "audit-terrain", etape },
  });
}

const estP2002 = (err: unknown) => (err as { code?: unknown } | null)?.code === "P2002";

/* ---------- entrée : débit, plafond, authentification ---------- */

async function limiter(cle: string): Promise<Response | null> {
  const r = await checkRateLimit(cle, LIMITE);
  if (r.allowed) return null;
  const attente = Math.max(1, Math.ceil((r.resetAt - Date.now()) / 1000));
  if (r.panne) return json({ erreur: "indisponible" }, 503, { "Retry-After": String(Math.min(attente, 60)) });
  return json({ erreur: "limite" }, 429, { "Retry-After": String(attente) });
}

interface SessionAuth {
  readonly id: string;
  readonly clientId: string;
}

type Auth = { ok: true; session: SessionAuth; ipHachee: string | null } | { ok: false; reponse: Response };

async function authentifier(req: Request, controleurs?: { avant?: () => Response | null }): Promise<Auth> {
  const ipHachee = hashIp(ipDepuisEntetes(req.headers));
  const refusIp = await limiter(`audit-terrain:ip:${ipHachee ?? "inconnue"}`);
  if (refusIp) return { ok: false, reponse: refusIp };

  const jeton: JetonLu | null = lireJeton(req.headers.get("authorization"));
  if (!jeton) {
    await journaliser(null, ipHachee, { statut: 401 });
    return { ok: false, reponse: non401() };
  }
  const refusJeton = await limiter(`audit-terrain:jeton:${sha256("rl:" + jeton.empreinte).slice(0, 32)}`);
  if (refusJeton) return { ok: false, reponse: refusJeton };

  const trop = controleurs?.avant?.();
  if (trop) return { ok: false, reponse: trop };

  const ligne = await prisma.auditTerrainSession.findUnique({
    where: { jetonEmpreinte: jeton.empreinte },
    select: { id: true, clientId: true, statut: true, jetonEmpreinte: true, jetonExpireLe: true, jetonRevoqueLe: true },
  });
  const valide =
    ligne !== null &&
    memeEmpreinte(ligne.jetonEmpreinte, jeton.empreinte) &&
    ligne.id.toLowerCase() === jeton.sessionId &&
    ligne.statut === "ouverte" &&
    ligne.jetonRevoqueLe === null &&
    ligne.jetonExpireLe.getTime() > Date.now();
  if (!valide || !ligne) {
    await journaliser(null, ipHachee, { statut: 401 });
    return { ok: false, reponse: non401() };
  }
  return { ok: true, session: { id: ligne.id, clientId: ligne.clientId }, ipHachee };
}

async function journaliser(sessionId: string | null, ipHachee: string | null, changes: Record<string, number>): Promise<void> {
  await ecrireJournalActivite(
    { adminUserId: null, ipAddress: ipHachee, userAgent: null },
    { action: "audit-terrain.reception", targetType: "audit_terrain_session", targetId: sessionId, changes },
  );
}

async function lireCorpsPlafonne(req: Request): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array();
  const lecteur = req.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CORPS_OCTETS) {
      await lecteur.cancel().catch(() => undefined);
      return null;
    }
    morceaux.push(value);
  }
  return Buffer.concat(morceaux);
}

/* ---------- écriture d'un événement ---------- */

type Issue = "accepte" | "dejaRecu" | "conflit";

async function ecrireEvenement(sessionId: string, ev: EvenementRecu): Promise<Issue> {
  const empreinte = empreinteServeur(ev.empreinte);
  const contenu = JSON.stringify(ev.donnees);
  const donneesChiffrees = chiffrerParole(contenu);
  const donneesEvt = {
    sessionId,
    eventId: ev.eventId,
    seq: ev.seq,
    type: ev.type,
    etape: ev.etape,
    etapeIndex: ev.etapeIndex,
    heurePc: new Date(ev.heurePC),
    empreinte,
    donneesChiffrees,
  };

  for (let essai = 0; essai < 3; essai++) {
    try {
      if (ev.type === "rapport_brouillon") {
        const source = donneesRapportSchema.parse(ev.donnees).source;
        await prisma.$transaction(async (tx) => {
          await tx.auditTerrainEvenement.create({ data: donneesEvt });
          const max = await tx.auditTerrainRapport.aggregate({ where: { sessionId }, _max: { version: true } });
          await tx.auditTerrainRapport.create({
            data: {
              sessionId,
              version: (max._max.version ?? 0) + 1,
              source,
              eventId: ev.eventId,
              contenuChiffre: donneesChiffrees,
              statut: "a_relire",
            },
          });
        });
      } else {
        await prisma.auditTerrainEvenement.create({ data: donneesEvt });
      }
      return "accepte";
    } catch (err) {
      if (!estP2002(err)) throw err;
      const existant = await prisma.auditTerrainEvenement.findUnique({
        where: { sessionId_eventId: { sessionId, eventId: ev.eventId } },
        select: { empreinte: true },
      });
      if (existant) return memeEmpreinte(existant.empreinte, empreinte) ? "dejaRecu" : "conflit";
      // Autre contrainte (version de rapport prise en même temps, eventId de rapport déjà pris) : on réessaie.
    }
  }
  return "conflit"; // sans détail : l'événement n'est pas écrit, le PC le voit en conflit
}

async function etatSession(sessionId: string): Promise<{ dernierSeqRecu: number; nombre: number; trous: number[] }> {
  const lignes = await prisma.auditTerrainEvenement.findMany({
    where: { sessionId },
    select: { seq: true },
    orderBy: { seq: "asc" },
  });
  const vus = new Set(lignes.map((l) => l.seq));
  const dernier = lignes.reduce((m, l) => Math.max(m, l.seq), 0);
  const trous: number[] = [];
  for (let s = 1; s < dernier && trous.length < MAX_TROUS; s++) if (!vus.has(s)) trous.push(s);
  return { dernierSeqRecu: dernier, nombre: lignes.length, trous };
}

/* ---------- POST /evenements ---------- */

export async function recevoirEvenements(req: Request): Promise<Response> {
  try {
    const auth = await authentifier(req, {
      avant: () => {
        const declare = Number(req.headers.get("content-length"));
        return Number.isFinite(declare) && declare > MAX_CORPS_OCTETS ? json({ erreur: "trop_gros" }, 413) : null;
      },
    });
    if (!auth.ok) return auth.reponse;
    const { session, ipHachee } = auth;

    const brut = await lireCorpsPlafonne(req);
    if (brut === null) return json({ erreur: "trop_gros" }, 413);

    let parse: unknown;
    try {
      parse = JSON.parse(Buffer.from(brut).toString("utf8"));
    } catch {
      return non422();
    }
    if (typeof parse === "object" && parse !== null && (parse as { mode?: unknown }).mode === "test") {
      await journaliser(session.id, ipHachee, { statut: 403 });
      return json({ erreur: "mode_test_refuse" }, 403);
    }

    const verdict = corpsLotSchema.safeParse(parse);
    if (!verdict.success) return non422();
    const corps = verdict.data;
    // Le sessionId du corps doit être celui de la ligne trouvée par le jeton.
    if (corps.sessionId.toLowerCase() !== session.id.toLowerCase()) {
      await journaliser(null, ipHachee, { statut: 401 });
      return non401();
    }
    // Le serveur recalcule le SHA-256 du contenu ; tout le lot est refusé avant la moindre écriture.
    for (const ev of corps.lot) {
      if (sha256(JSON.stringify(ev.donnees)) !== ev.empreinte.toLowerCase()) return non422();
      if (ev.type === "rapport_brouillon" && !donneesRapportSchema.safeParse(ev.donnees).success) return non422();
    }

    const acceptes: string[] = [];
    const dejaRecus: string[] = [];
    const conflits: string[] = [];
    let maxSeq = 0;
    let maxEtape = 0;
    for (const ev of [...corps.lot].sort((a, b) => a.seq - b.seq)) {
      const issue = await ecrireEvenement(session.id, ev);
      if (issue === "accepte") {
        acceptes.push(ev.eventId);
        maxSeq = Math.max(maxSeq, ev.seq);
        maxEtape = Math.max(maxEtape, ev.etapeIndex);
      } else if (issue === "dejaRecu") {
        dejaRecus.push(ev.eventId);
      } else {
        conflits.push(ev.eventId);
        // Journal du conflit : identifiants seulement, jamais de contenu.
        await ecrireJournalActivite(
          { adminUserId: null, ipAddress: ipHachee, userAgent: null },
          {
            action: "audit-terrain.conflit",
            targetType: "audit_terrain_session",
            targetId: session.id,
            changes: { eventId: ev.eventId, seq: ev.seq },
          },
        );
      }
    }

    if (acceptes.length > 0) {
      // Un seul UPDATE atomique : jamais de recul si deux lots se croisent.
      await prisma.$queryRaw`UPDATE audit_terrain_sessions
        SET dernier_seq = GREATEST(dernier_seq, ${maxSeq}::int),
            derniere_etape_index = GREATEST(derniere_etape_index, ${maxEtape}::int),
            dernier_envoi_le = now()
        WHERE id = ${session.id}::uuid
        RETURNING dernier_seq`;
    }

    const etat = await etatSession(session.id);
    await journaliser(session.id, ipHachee, {
      statut: 200,
      lot: corps.lot.length,
      acceptes: acceptes.length,
      dejaRecus: dejaRecus.length,
      conflits: conflits.length,
    });
    return json({ acceptes, dejaRecus, conflits, dernierSeqRecu: etat.dernierSeqRecu, trous: etat.trous }, 200);
  } catch (err) {
    signaler(err, "evenements");
    return json({ erreur: "interne" }, 500);
  }
}

/* ---------- GET /etat ---------- */

export async function lireEtat(req: Request): Promise<Response> {
  try {
    const auth = await authentifier(req);
    if (!auth.ok) return auth.reponse;
    const demande = new URL(req.url).searchParams.get("sessionId");
    if (demande !== null && demande.toLowerCase() !== auth.session.id.toLowerCase()) return non401();
    return json(await etatSession(auth.session.id), 200);
  } catch (err) {
    signaler(err, "etat");
    return json({ erreur: "interne" }, 500);
  }
}
