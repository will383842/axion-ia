/**
 * Route C1 `POST /api/console/v1/commandes/{numeroDevis}/etat` — l'état d'activation qu'envoie
 * la console des automatisations pour une commande signée (CONTRAT-DEVIS-VERS-CONSOLE, section c).
 *
 * Le Hub s'en sert UNIQUEMENT pour l'affichage : ce module n'écrit que les colonnes d'état de
 * `console_commandes` (jamais le contenu du fait `commande.signee`, que la base refuse de
 * modifier), ne déclenche aucune facture, aucun e-mail, aucun changement de statut du devis.
 *
 * Authentification : HMAC-SHA256 sous un secret DÉDIÉ à ce sens (`CONSOLE_C1_SECRET`, ≥ 32
 * caractères), sur `<horodatage>.<METHODE>.<chemin>.<sha256 du corps>` — le corps et le chemin sont
 * donc couverts —, fenêtre de 5 minutes. `Idempotency-Key` obligatoire : rejouer la même clé avec
 * le même contenu rend « déjà reçu » sans effet ; avec un contenu différent, 409.
 *
 * Canal fermé (secret absent ou trop court) ou build (base stub) : 404, rien n'est lu.
 */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { prisma as prismaGlobal } from "@/lib/prisma";
import { canonicalJson, type CanonicalValue } from "@/server/qualiopi/emargement/canonical";

export const ENTETE_HORODATAGE_CONSOLE = "x-console-timestamp";
export const ENTETE_SIGNATURE_CONSOLE = "x-console-signature";
export const TOLERANCE_CONSOLE_S = 300;
const TAILLE_MAX_CORPS = 16_384;
const HORODATAGE = /^[0-9]{1,20}$/;
const SIGNATURE = /^[0-9a-f]{64}$/;
const CLE_IDEMPOTENCE = /^[A-Za-z0-9._:-]{8,120}$/;
const NUMERO_DEVIS = /^[A-Za-z0-9-]{3,40}$/;

export function secretConsole(): string | null {
  const brut = process.env["CONSOLE_C1_SECRET"]?.trim();
  return brut !== undefined && brut.length >= 32 ? brut : null;
}

function auBuild(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** La signature qu'un appelant légitime pose sur la requête. */
export function signerRequeteConsole(
  secret: string,
  horodatage: string,
  methode: string,
  chemin: string,
  corps: string,
): string {
  const empreinte = createHash("sha256").update(corps, "utf8").digest("hex");
  return createHmac("sha256", secret)
    .update(`${horodatage}.${methode.toUpperCase()}.${chemin}.${empreinte}`)
    .digest("hex");
}

function egaux(presente: string, attendue: string): boolean {
  const a = createHash("sha256").update(presente, "utf8").digest();
  const b = createHash("sha256").update(attendue, "utf8").digest();
  return timingSafeEqual(a, b) && presente !== "";
}

const corpsSchema = z
  .object({
    etat: z.enum([
      "recue",
      "a_trancher",
      "acompte_attendu",
      "outils_a_relier",
      "en_service",
      "suspendue",
    ]),
    detail: z
      .object({
        motif: z.string().max(300).optional(),
        codesActifs: z.array(z.string().min(1).max(120)).max(200).optional(),
        actifs: z.number().int().min(0).max(10_000).optional(),
        total: z.number().int().min(0).max(10_000).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export interface EcrivainEtat {
  consoleCommande: {
    findUnique(args: {
      where: { numeroDevis: string };
      select: Record<string, true>;
    }): PromiseLike<{
      id: string;
      etat: string | null;
      etatDetail: unknown;
      etatCleIdempotence: string | null;
    } | null>;
    updateMany(args: {
      where: { id: string; etatCleIdempotence: string | null };
      data: {
        etat: string;
        etatDetail: Record<string, unknown> | null;
        etatRecuAt: Date;
        etatCleIdempotence: string;
      };
    }): PromiseLike<{ count: number }>;
  };
}

export type DependancesEtat = { prisma?: EcrivainEtat; maintenantMs?: number };

function json(statut: number, corps: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function canon(valeur: unknown): string {
  return canonicalJson((valeur ?? null) as CanonicalValue);
}

export async function repondreEtatCommande(
  requete: Request,
  numeroDevis: string,
  dependances: DependancesEtat = {},
): Promise<Response> {
  const secret = secretConsole();
  if (secret === null || auBuild()) return json(404, { error: "not_found" });

  const maintenantMs = dependances.maintenantMs ?? Date.now();
  const client = dependances.prisma ?? (prismaGlobal as unknown as EcrivainEtat);

  // Corps lu UNE fois, borné, avant toute vérification qui en dépend.
  const brut = await requete.text();
  if (brut.length > TAILLE_MAX_CORPS) return json(413, { error: "payload_too_large" });

  // ── Authentification ──
  const horodatage = requete.headers.get(ENTETE_HORODATAGE_CONSOLE);
  const signature = requete.headers.get(ENTETE_SIGNATURE_CONSOLE) ?? "";
  if (horodatage === null || !HORODATAGE.test(horodatage))
    return json(401, { error: "unauthorized" });
  if (Math.abs(maintenantMs / 1000 - Number(horodatage)) > TOLERANCE_CONSOLE_S) {
    return json(401, { error: "unauthorized" });
  }
  const chemin = new URL(requete.url).pathname;
  const attendue = signerRequeteConsole(secret, horodatage, requete.method, chemin, brut);
  // La comparaison a lieu dans tous les cas ; la forme est jugée après.
  if (!(egaux(signature, attendue) && SIGNATURE.test(signature))) {
    return json(401, { error: "unauthorized" });
  }

  // ── Requête ──
  if (!NUMERO_DEVIS.test(numeroDevis)) return json(404, { error: "not_found" });
  const cle = requete.headers.get("idempotency-key");
  if (cle === null || !CLE_IDEMPOTENCE.test(cle))
    return json(400, { error: "idempotency_key_required" });

  let corps: unknown;
  try {
    corps = JSON.parse(brut);
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const parse = corpsSchema.safeParse(corps);
  if (!parse.success) return json(422, { error: "invalid_body" });
  const { etat } = parse.data;
  const detail = parse.data.detail === undefined ? null : { ...parse.data.detail };

  try {
    const ligne = await client.consoleCommande.findUnique({
      where: { numeroDevis },
      select: { id: true, etat: true, etatDetail: true, etatCleIdempotence: true },
    });
    if (ligne === null) return json(404, { error: "not_found" });

    if (ligne.etatCleIdempotence === cle) {
      // Même clé : même contenu = « déjà reçu » (succès sans effet) ; sinon conflit.
      const identique = ligne.etat === etat && canon(ligne.etatDetail) === canon(detail);
      return identique
        ? json(200, { ok: true, deja_recu: true })
        : json(409, { error: "conflict" });
    }

    // Écriture gardée sur la clé lue : deux requêtes simultanées, une seule gagne.
    const ecrit = await client.consoleCommande.updateMany({
      where: { id: ligne.id, etatCleIdempotence: ligne.etatCleIdempotence },
      data: {
        etat,
        etatDetail: detail,
        etatRecuAt: new Date(maintenantMs),
        etatCleIdempotence: cle,
      },
    });
    if (ecrit.count === 0) return json(409, { error: "conflict" });
    return json(200, { ok: true, deja_recu: false });
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "console.c1.etat" } });
    return json(500, { error: "internal_error" });
  }
}
