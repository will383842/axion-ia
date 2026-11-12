/**
 * CATALOGUE UNIQUE DE CIBLES (F1a, 2026-11-12) — logique des deux routes signées
 * `GET /api/interne/catalogue-reseau` et `POST /api/interne/cibles-adresses`.
 *
 * Même signature que `/api/interne/demandes-guide-reseau` (HMAC + horodatage, `controlerEntree`),
 * même secret `GUIDES_RESEAU_HMAC_SECRET` — SANS repli sur le secret des vidéos (une route qui
 * écrit ne s'ouvre pas avec la clé d'une autre). Même interrupteur `GUIDES_RESEAU_ENABLED`, mais
 * éteint = 404 (la route fait comme si elle n'existait pas).
 *
 * Anti-rejeu : l'écriture est un « créer ou mettre à jour » IDEMPOTENT ; rejouer une requête
 * dans la fenêtre de 300 s reproduit le même état, sans nouvel effet (même décision que
 * `oppositions-reseau`). Le nonce est contrôlé en forme, pas mémorisé.
 *
 * Le catalogue ne rend JAMAIS l'adresse elle-même ni aucune donnée de personne.
 */
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { CATALOGUE_GUIDES_RESEAU } from "@/content/guides-reseau";
import { prisma } from "@/lib/prisma";
import { controlerEntree, type ResultatEntree } from "@/server/videos/entree";
import { refus, reponseJson } from "@/server/videos/reponse";
import { guidesReseauActifs, secretsOppositionsReseau } from "./config";
import { RE_CODE_ADRESSE, validerAdresse, validerTitre } from "./cibles-adresses";

export const PREFIXE_DEBIT_CIBLES = "internal:cibles-reseau";
export const CORPS_MAX_CIBLES = 4 * 1024;

export interface ElementCatalogue {
  code: string;
  type: "guide" | "adresse";
  titre: string;
  actif: boolean;
}

/** 404 si éteint ; 401 si la signature manque, est fausse ou expirée ; sinon l'entrée signée. */
async function entreeSignee(
  req: NextRequest,
  methode: "GET" | "POST",
  chemin: string,
): Promise<ResultatEntree> {
  if (!guidesReseauActifs()) return { ok: false, reponse: refus(404, "introuvable") };
  const entree = await controlerEntree(req, {
    methode,
    chemin,
    drapeau: guidesReseauActifs,
    secrets: () => secretsOppositionsReseau(),
    prefixeDebit: PREFIXE_DEBIT_CIBLES,
    corpsMaxOctets: CORPS_MAX_CIBLES,
  });
  // En-têtes de signature absents ou malformés : même réponse qu'une signature fausse.
  if (!entree.ok && entree.reponse.status === 400) {
    return { ok: false, reponse: refus(401, "signature_invalide") };
  }
  return entree;
}

export async function listerCatalogue(req: NextRequest): Promise<Response> {
  const entree = await entreeSignee(req, "GET", "/api/interne/catalogue-reseau");
  if (!entree.ok) return entree.reponse;
  const adresses = await prisma.cibleAdresse.findMany({
    where: { actif: true },
    select: { code: true, titre: true, actif: true },
    orderBy: { code: "asc" },
  });
  const elements: ElementCatalogue[] = [
    ...CATALOGUE_GUIDES_RESEAU.map((g) => ({
      code: g.code,
      type: "guide" as const,
      titre: g.titre,
      actif: g.actif,
    })),
    ...adresses.map((a) => ({
      code: a.code,
      type: "adresse" as const,
      titre: a.titre,
      actif: a.actif,
    })),
  ];
  return reponseJson(200, elements);
}

const CorpsAdresse = z
  .object({
    code: z.string().optional(),
    titre: z.unknown(),
    url: z.unknown(),
    actif: z.boolean().optional(),
  })
  .strict();

function nouveauCode(): string {
  return `adr-${crypto.randomBytes(6).toString("hex")}`;
}

export async function enregistrerAdresse(req: NextRequest): Promise<Response> {
  const entree = await entreeSignee(req, "POST", "/api/interne/cibles-adresses");
  if (!entree.ok) return entree.reponse;
  let json: unknown;
  try {
    json = JSON.parse(entree.corps.toString("utf8"));
  } catch {
    return refus(400, "corps_illisible");
  }
  const lu = CorpsAdresse.safeParse(json);
  if (!lu.success) return refus(422, "corps_invalide");
  const { code: codeFourni, actif } = lu.data;
  if (codeFourni !== undefined && !RE_CODE_ADRESSE.test(codeFourni)) {
    return refus(422, "code_invalide");
  }
  const titre = validerTitre(lu.data.titre);
  if (titre === null) return refus(422, "titre_invalide");
  const verdict = validerAdresse(lu.data.url);
  if (!verdict.ok) return refus(422, verdict.raison);

  const code = codeFourni ?? nouveauCode();
  await prisma.cibleAdresse.upsert({
    where: { code },
    create: { code, titre, url: verdict.url, actif: actif ?? true },
    update: { titre, url: verdict.url, ...(actif !== undefined ? { actif } : {}) },
  });
  return reponseJson(200, { ok: true, code });
}
