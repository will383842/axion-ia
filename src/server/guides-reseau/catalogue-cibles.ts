/**
 * CATALOGUE UNIQUE DE CIBLES (F1a-bis, 2026-11-12) — logique des routes signées
 * `GET /api/interne/catalogue-reseau`, `POST /api/interne/cibles-reseau`,
 * `GET|POST /api/interne/mots-cibles`. Tout vient de la base : aucun guide ni mot en code.
 *
 * Même signature que `/api/interne/demandes-guide-reseau` (HMAC + horodatage, `controlerEntree`),
 * même secret `GUIDES_RESEAU_HMAC_SECRET` — SANS repli sur le secret des vidéos (une route qui
 * écrit ne s'ouvre pas avec la clé d'une autre). Même interrupteur `GUIDES_RESEAU_ENABLED`, mais
 * éteint = 404 (la route fait comme si elle n'existait pas).
 *
 * Anti-rejeu : l'écriture est un « créer ou mettre à jour » PAR CODE, et le code est OBLIGATOIRE
 * (le Studio l'envoie toujours) : rejouer le même corps dans la fenêtre de 300 s reproduit le même
 * état, sans nouvelle fiche (même décision que `oppositions-reseau`). Le nonce est contrôlé en forme, pas mémorisé.
 *
 * Le catalogue ne rend JAMAIS l'adresse, le chemin du PDF ni aucune donnée de personne.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { controlerEntree, type ResultatEntree } from "@/server/videos/entree";
import { refus, reponseJson } from "@/server/videos/reponse";
import { guidesReseauActifs, secretsOppositionsReseau } from "./config";
import {
  RESEAUX_MOT,
  TYPES_CIBLE,
  codeAccordeAuType,
  normaliserMot,
  validerAdresse,
  validerCheminPdf,
  validerTitre,
  type TypeCible,
} from "./cibles-reseau";

export const PREFIXE_DEBIT_CIBLES = "internal:cibles-reseau";
export const CORPS_MAX_CIBLES = 4 * 1024;

export interface ElementCatalogue {
  code: string;
  type: TypeCible;
  titre: string;
  actif: boolean;
  test: boolean;
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
  const lignes = await prisma.cibleReseau.findMany({
    select: { code: true, type: true, titre: true, actif: true, test: true },
    orderBy: { code: "asc" },
  });
  const elements: ElementCatalogue[] = lignes.map((l) => ({
    code: l.code,
    type: l.type as TypeCible,
    titre: l.titre,
    actif: l.actif,
    test: l.test,
  }));
  return reponseJson(200, elements);
}

function lireCorps(corps: Buffer): unknown {
  try {
    return JSON.parse(corps.toString("utf8"));
  } catch {
    return undefined;
  }
}

const CorpsCible = z
  .object({
    code: z.string(),
    type: z.enum(TYPES_CIBLE),
    titre: z.unknown(),
    cheminPdf: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    version: z.number().int().min(1).max(100000).optional(),
    actif: z.boolean().optional(),
    test: z.boolean().optional(),
  })
  .strict();

/** Crée ou met à jour une cible. Un guide a un chemin de PDF et pas d'adresse ; une adresse l'inverse. */
export async function enregistrerCible(req: NextRequest): Promise<Response> {
  const entree = await entreeSignee(req, "POST", "/api/interne/cibles-reseau");
  if (!entree.ok) return entree.reponse;
  const json = lireCorps(entree.corps);
  if (json === undefined) return refus(400, "corps_illisible");
  const lu = CorpsCible.safeParse(json);
  if (!lu.success) return refus(422, "corps_invalide");
  const { type, code, actif, test, version } = lu.data;
  if (!codeAccordeAuType(code, type)) return refus(422, "code_invalide");
  const titre = validerTitre(lu.data.titre);
  if (titre === null) return refus(422, "titre_invalide");

  let cheminPdf: string | null = null;
  let url: string | null = null;
  if (type === "guide") {
    if (lu.data.url != null) return refus(422, "guide_sans_adresse");
    cheminPdf = validerCheminPdf(lu.data.cheminPdf);
    if (cheminPdf === null) return refus(422, "chemin_pdf_invalide");
  } else {
    if (lu.data.cheminPdf != null) return refus(422, "adresse_sans_pdf");
    const verdict = validerAdresse(lu.data.url);
    if (!verdict.ok) return refus(422, verdict.raison);
    url = verdict.url;
  }

  const champs = {
    titre,
    cheminPdf,
    url,
    ...(version !== undefined ? { version } : {}),
    ...(actif !== undefined ? { actif } : {}),
    ...(test !== undefined ? { test } : {}),
  };
  // Fiche de test : créée INACTIVE si `actif` n'est pas transmis (jamais proposée par défaut).
  // Une mise à jour ne touche `actif` que s'il est transmis.
  const actifCreation = actif ?? (test === true ? false : undefined);
  await prisma.cibleReseau.upsert({
    where: { code },
    create: {
      code,
      type,
      ...champs,
      ...(actifCreation !== undefined ? { actif: actifCreation } : {}),
    },
    update: champs,
  });
  return reponseJson(200, { ok: true, code });
}

export async function listerMots(req: NextRequest): Promise<Response> {
  const entree = await entreeSignee(req, "GET", "/api/interne/mots-cibles");
  if (!entree.ok) return entree.reponse;
  const lignes = await prisma.motCible.findMany({
    select: { mot: true, reseau: true, codeCible: true, actif: true },
    orderBy: [{ mot: "asc" }, { reseau: "asc" }],
  });
  return reponseJson(
    200,
    lignes.map((l) => ({ mot: l.mot, reseau: l.reseau, codeCible: l.codeCible, actif: l.actif })),
  );
}

const CorpsMot = z
  .object({
    mot: z.unknown(),
    reseau: z.enum(RESEAUX_MOT),
    codeCible: z.string().min(1).max(40),
    actif: z.boolean().optional(),
  })
  .strict();

/** Crée ou modifie la liaison (mot, réseau) : un mot, UNE cible par réseau. Cible inconnue ou inactive refusée. */
export async function enregistrerMot(req: NextRequest): Promise<Response> {
  const entree = await entreeSignee(req, "POST", "/api/interne/mots-cibles");
  if (!entree.ok) return entree.reponse;
  const json = lireCorps(entree.corps);
  if (json === undefined) return refus(400, "corps_illisible");
  const lu = CorpsMot.safeParse(json);
  if (!lu.success) return refus(422, "corps_invalide");
  const mot = normaliserMot(lu.data.mot);
  if (mot === null) return refus(422, "mot_invalide");
  const { reseau, codeCible, actif } = lu.data;
  const cible = await prisma.cibleReseau.findUnique({
    where: { code: codeCible },
    select: { actif: true },
  });
  if (!cible) return refus(422, "cible_inconnue");
  if (!cible.actif) return refus(422, "cible_inactive");
  await prisma.motCible.upsert({
    where: { mot_reseau: { mot, reseau } },
    create: { mot, reseau, codeCible, ...(actif !== undefined ? { actif } : {}) },
    update: { codeCible, ...(actif !== undefined ? { actif } : {}) },
  });
  return reponseJson(200, { ok: true, mot, reseau, codeCible });
}
