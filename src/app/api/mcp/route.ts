/**
 * `POST /api/mcp` — **LA PORTE DE L'ADAPTATEUR AXION-IA.**
 *
 * Le socle `axion-ops` ne consomme jamais une fonction distante : il consomme un
 * manifeste JSON épinglé par empreinte, et appelle cette route en **JSON-RPC
 * 2.0**. Axion-IA est en *mode fédéré* — l'adaptateur vit chez son produit, pas
 * dans le socle.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ⚠️ QUATRE PIÈGES MESURÉS. Chacun a coûté à quelqu'un ; aucun n'est théorique.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ① **LE CHEMIN EST `/api/mcp`, JAMAIS `/mcp`.** Un `POST /mcp` à la racine est
 *    redirigé en **301 vers `/fr/mcp`**, qui n'existe pas. Le socle recevrait une
 *    redirection là où il attend du JSON-RPC.
 *
 * ② **LA GARDE S'ÉCRIT DANS CE HANDLER, ET NULLE PART AILLEURS.** Le matcher du
 *    proxy (`src/proxy.ts`) exclut explicitement `api/`, donc le callback
 *    `authorized()` de `src/auth.config.ts` **ne s'exécute jamais** sur une route
 *    d'API. Écrire « cette route n'est pas publique » sans dire par quoi n'est
 *    pas un mécanisme — c'était le défaut de la v5 du cahier, relevé à l'audit.
 *
 * ③ **SANS SECRET EN CONFIGURATION, LA ROUTE REND `503` ET NE SERT RIEN.** Une
 *    route qui se dégraderait en « ouverte » quand sa variable manque serait un
 *    trou béant le jour d'un déploiement incomplet. Le motif est déjà en service
 *    dans le dépôt : `src/app/api/internal/revalidate/route.ts`.
 *
 * ④ **L'ÉCHAPPÉE `stub.invalid` EST EN TÊTE DE HANDLER.** Le build tourne sur
 *    GitHub Actions, sans accès à la base : `DATABASE_URL` y vaut
 *    `postgresql://stub:stub@stub.invalid:5432/stub`. Le singleton Prisma est
 *    stub-aware, mais on ne compte pas dessus ici — on sort **avant** toute
 *    lecture, pour qu'aucun appel ne parte au SSG. Contrat d'ADR 0026 : ne pas
 *    toucher à cette chaîne magique sans la propager.
 *
 * ═══ CE QUE CETTE ROUTE NE FAIT PAS ENCORE ═══
 *
 * Elle ne sert **aucun outil**. Les cinq outils de lecture sont le lot 4b ; ce
 * lot-ci pose la porte, sa serrure et ses gardes. `tools/list` rend donc une
 * liste **vide, et le dit** — un adaptateur qui prétendrait servir ce qu'il n'a
 * pas ferait échouer le socle plus loin, avec un symptôme qui ne le désignerait
 * pas.
 */

import crypto from "node:crypto";
import type { NextRequest } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Le nom de la variable qui porte le secret partagé. Un NOM, jamais la valeur. */
export const VARIABLE_DU_SECRET = "MCP_SHARED_SECRET";

/** L'en-tête que le socle présente à chaque appel. */
export const ENTETE_DU_SECRET = "x-mcp-secret";

/**
 * La chaîne magique du build hors-ligne (ADR 0026). ⚠️ Ne pas la changer sans la
 * propager dans `prisma.ts`, `redis.ts`, `knowledge-rss.ts`,
 * `knowledge-sitemap.ts`, le `Dockerfile` et le workflow de déploiement.
 */
const HOTE_DE_BUILD = "stub.invalid";

/** Le plafond d'appels par IP et par minute. Le socle en émet quelques-uns. */
export const PLAFOND_PAR_MINUTE = 120;

/**
 * Comparaison à temps constant. On hashe les deux côtés en SHA-256 (32 octets
 * fixes) avant de comparer : `timingSafeEqual` lève si les tailles diffèrent, et
 * comparer les longueurs brutes fuite déjà de l'information.
 *
 * Même posture que `verifyKbSignature` et que la route de revalidation.
 */
function egalesATempsConstant(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a, "utf8").digest();
  const hb = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Une réponse JSON-RPC 2.0 d'erreur. Un code, un message, jamais un booléen. */
function erreurJsonRpc(
  id: string | number | null,
  code: number,
  message: string,
  statut = 200,
): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: statut });
}

/** Une réponse JSON-RPC 2.0 de succès. */
function resultatJsonRpc(id: string | number | null, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, result });
}

/** La version du protocole que cet adaptateur parle. */
export const VERSION_DU_PROTOCOLE = "2025-06-18";

interface EnveloppeJsonRpc {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

export async function POST(req: NextRequest): Promise<Response> {
  // ── ④ L'ÉCHAPPÉE DU BUILD, EN TOUT PREMIER ────────────────────────────────
  //    Aucune lecture, aucune connexion, aucun secret consulté. Au SSG, cette
  //    route ne doit rien faire du tout.
  if (process.env.DATABASE_URL?.includes(HOTE_DE_BUILD)) {
    return new Response("build_stub", { status: 503 });
  }

  // ── ③ SANS SECRET EN CONFIGURATION, ON NE SERT RIEN ───────────────────────
  const secret = process.env[VARIABLE_DU_SECRET];
  if (!secret) {
    return new Response("mcp_secret_missing", { status: 503 });
  }

  // ── Limitation de débit par IP, AVANT la comparaison du secret ────────────
  //    La placer après ferait de cette route un oracle à force brute : chaque
  //    tentative coûterait un hash et rien d'autre.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const debit = await checkRateLimit(`mcp:${ip}`, {
    limit: PLAFOND_PAR_MINUTE,
    windowSec: 60,
  });
  if (!debit.allowed) {
    return new Response("rate_limited", { status: 429 });
  }

  // ── ② LA GARDE, DANS LE HANDLER ───────────────────────────────────────────
  const presente = req.headers.get(ENTETE_DU_SECRET);
  if (!presente || !egalesATempsConstant(presente, secret)) {
    return new Response("unauthorized", { status: 401 });
  }

  // ── À partir d'ici seulement, on lit le corps ─────────────────────────────
  let enveloppe: EnveloppeJsonRpc;
  try {
    enveloppe = (await req.json()) as EnveloppeJsonRpc;
  } catch {
    return erreurJsonRpc(null, -32700, "corps illisible : JSON invalide");
  }

  const id =
    typeof enveloppe.id === "string" || typeof enveloppe.id === "number" ? enveloppe.id : null;

  if (enveloppe.jsonrpc !== "2.0") {
    return erreurJsonRpc(id, -32600, "enveloppe invalide : `jsonrpc` doit valoir « 2.0 »");
  }
  if (typeof enveloppe.method !== "string") {
    return erreurJsonRpc(id, -32600, "enveloppe invalide : `method` manquante");
  }

  switch (enveloppe.method) {
    case "initialize":
      return resultatJsonRpc(id, {
        protocolVersion: VERSION_DU_PROTOCOLE,
        // Une seule primitive en v1. `resources` et `prompts` sont hors
        // périmètre : les annoncer sans les livrer est pire que se taire.
        capabilities: { tools: {} },
        serverInfo: { name: "axionia", version: "0.1.0" },
      });

    case "tools/list":
      // ⚠️ VIDE, ET CE N'EST PAS UNE PANNE. Les cinq outils de lecture sont le
      //    lot 4b. Un adaptateur qui annoncerait des outils qu'il n'a pas ferait
      //    échouer le socle à l'appel, avec un symptôme qui ne le désigne pas.
      return resultatJsonRpc(id, { tools: [] });

    case "ping":
      return resultatJsonRpc(id, {});

    default:
      return erreurJsonRpc(id, -32601, `méthode inconnue : « ${enveloppe.method} »`);
  }
}

/**
 * ⚠️ **TOUT AUTRE VERBE REND `405`, ET C'EST DÉLIBÉRÉ.** Sans cet export, Next
 *    rend `405` de lui-même — mais une route MCP qui répondrait à `GET` inviterait
 *    à croire qu'elle expose quelque chose à un navigateur. Le défaut a déjà
 *    coûté un webhook dans ce dépôt (PR 917) : c'est le verbe manquant qui rendait
 *    405, et personne ne le voyait.
 */
export function GET(): Response {
  return new Response("method_not_allowed", { status: 405, headers: { Allow: "POST" } });
}
