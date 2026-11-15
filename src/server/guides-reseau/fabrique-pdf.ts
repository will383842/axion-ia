/**
 * FABRIQUER UN GUIDE PDF (G3, 2026-11-15) — logique de `POST /api/interne/guides-reseau/contenu`
 * et de `GET /api/interne/guides-reseau/versions`.
 *
 * 🔴 INERTE : `GUIDES_RESEAU_FABRIQUE_ENABLED` éteint = 404, rien n'est lu ni écrit.
 * Ce module est APPELÉ PAR LES ROUTES SEULEMENT : aucun module de `src/server/queue` ne l'importe
 * (le worker n'interroge JAMAIS la table `guides_reseau_versions`).
 *
 * Imports lourds (prisma, polices, @react-pdf, SDK R2) chargés À L'APPEL : l'import ne touche rien.
 *
 * Empreinte du texte — JSON CANONIQUE du Studio : objet compact `{titre, sections:[{titre, paragraphes, puces}]}`
 * dans cet ordre fixe, chaînes en NFC, SHA-256 hexadécimal de l'UTF-8. Ni `code` ni `version` n'y figurent,
 * aucun tri de clés. Même vecteur de test que le Studio (`fixtures/empreinte-guide.json`).
 *
 * Écrit `guides_reseau_versions` et un objet PDF — JAMAIS `cibles_reseau` (« Rattacher » est fait par le Studio
 * via la route existante). Jamais de chemin, de clé d'objet ni de lien dans une réponse. Jamais de 500.
 */
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { controlerEntree, type ResultatEntree } from "@/server/videos/entree";
import { refus, reponseJson } from "@/server/videos/reponse";
import { RE_CODE_GUIDE_CATALOGUE } from "./format-code-guide";
import { cleObjet, fabriqueActive, secretsFabrique } from "./fabrique-config";
import { motInterditDans } from "./mots-interdits-guide";
import { ouvrirStockage, type StockageGuides } from "./stockage-guides";

export const CHEMIN_CONTENU = "/api/interne/guides-reseau/contenu";
export const CHEMIN_VERSIONS = "/api/interne/guides-reseau/versions";
export const PREFIXE_DEBIT_FABRIQUE = "internal:guides-reseau-contenu";
export const CORPS_MAX_FABRIQUE = 64 * 1024;
export const TOTAL_CARACTERES_MAX = 40_000;
export const PAGES_MAX = 30;
export const PDF_OCTETS_MAX = 5 * 1024 * 1024;
export const DELAI_EN_COURS_MS = 5 * 60 * 1000;
export const DELAI_RENDU_MS = 60 * 1000;

/**
 * Caractères refusés partout : COPIE MOT POUR MOT de `INTERDITS_CARACTERES` du Studio (guide-contenu.ts, référence).
 * Écrits en \uXXXX : jamais le caractère lui-même dans le code. Un test garde l'égalité avec la source du Studio.
 */
export const INTERDITS_CARACTERES =
  /[\u0000-\u001F\u007F-\u009F\u00AD\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u2028-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\u{E0000}-\u{E0FFF}]|\p{Default_Ignorable_Code_Point}/u;

export function contientCaractereInterdit(s: string): boolean {
  return INTERDITS_CARACTERES.test(s);
}

/** Texte du schéma du Studio : 1 à `max` caractères, SANS trim, sans caractère interdit, sans demi-caractère isolé. */
const texte = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((s) => !contientCaractereInterdit(s), "caractère interdit")
    .refine((s) => s.isWellFormed(), "demi-caractère Unicode isolé");

/** Titre du guide fabriqué : schéma du Studio (1 à 120, sans trim). `null` si refusé. Propre à la fabrique. */
export function titreGuideFabrique(brut: unknown): string | null {
  const lu = texte(120).safeParse(brut);
  return lu.success ? lu.data : null;
}

const Section = z
  .object({
    titre: texte(120),
    paragraphes: z.array(texte(1500)).min(1).max(15),
    puces: z.array(texte(300)).max(10),
  })
  .strict();

const Corps = z
  .object({
    code: z.string(),
    version: z.number().int().min(1).max(1000),
    sha256Texte: z.string().regex(/^[0-9a-f]{64}$/),
    titre: z.unknown(),
    sections: z.array(Section).min(1).max(20),
  })
  .strict();

export interface SectionGuide {
  titre: string;
  paragraphes: string[];
  puces: string[];
}
export interface ContenuGuide {
  code: string;
  version: number;
  titre: string;
  sections: SectionGuide[];
}

/**
 * JSON canonique, IDENTIQUE à celui du Studio (référence : `jsonCanoniqueGuide`, guide-contenu.ts) : NFC, compact,
 * clés dans l'ordre fixe {titre, sections:[{titre, paragraphes, puces}]}. Ni `code` ni `version` : ils ne sont pas
 * dans l'empreinte du Studio. Ordre des tableaux conservé, aucun tri de clés.
 */
export function jsonCanoniqueGuide(c: Pick<ContenuGuide, "titre" | "sections">): string {
  const nfc = (s: string) => s.normalize("NFC");
  return JSON.stringify({
    titre: nfc(c.titre),
    sections: c.sections.map((s) => ({
      titre: nfc(s.titre),
      paragraphes: s.paragraphes.map(nfc),
      puces: s.puces.map(nfc),
    })),
  });
}

/** Empreinte SHA-256 (hex minuscule, 64 caractères) du JSON canonique, encodé en UTF-8 (identique au Studio). */
export function empreinteTexte(c: Pick<ContenuGuide, "titre" | "sections">): string {
  return createHash("sha256").update(jsonCanoniqueGuide(c), "utf8").digest("hex");
}

export type Verdict =
  | { ok: true; contenu: ContenuGuide; sha256Texte: string }
  | { ok: false; statut: number; erreur: string; plus?: Record<string, unknown> };

const non = (statut: number, erreur: string, plus?: Record<string, unknown>): Verdict => ({
  ok: false,
  statut,
  erreur,
  ...(plus ? { plus } : {}),
});

/** Valide le corps (forme, bornes, caractères, empreinte, mots interdits). Pur : ni base, ni réseau. */
export function validerContenu(json: unknown): Verdict {
  const code = (json as { code?: unknown } | null)?.code;
  if (typeof code === "string" && !RE_CODE_GUIDE_CATALOGUE.test(code))
    return non(422, "code_invalide");
  const lu = Corps.safeParse(json);
  if (!lu.success) return non(422, "corps_invalide");
  const titre = titreGuideFabrique(lu.data.titre);
  if (titre === null) return non(422, "titre_invalide");
  const sections: SectionGuide[] = lu.data.sections.map((s) => ({
    titre: s.titre,
    paragraphes: s.paragraphes,
    puces: s.puces,
  }));
  const textes = [titre, ...sections.flatMap((s) => [s.titre, ...s.paragraphes, ...s.puces])];
  if (textes.reduce((n, t) => n + t.length, 0) > TOTAL_CARACTERES_MAX)
    return non(422, "corps_invalide");
  const contenu: ContenuGuide = { code: lu.data.code, version: lu.data.version, titre, sections };
  if (empreinteTexte(contenu) !== lu.data.sha256Texte) return non(422, "empreinte_differente");
  const regle = motInterditDans(textes);
  if (regle !== null) return non(422, "texte_refuse", { regle });
  return { ok: true, contenu, sha256Texte: lu.data.sha256Texte };
}

/** Nombre de pages d'un PDF (objets `/Type /Page`, hors `/Pages`). */
export function pagesDuPdf(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length;
}

let rendu: object | null = null;
/**
 * Un rendu à la fois dans le processus ; sinon `null` (→ 429 rendu_occupe). Au-delà de `delaiMs` le rendu est
 * abandonné : verrou libéré, `"delai"` rendu (→ 503 echec), rien n'est livré (`abandonne()` vaut vrai).
 */
async function seulRendu<T>(
  travail: (abandonne: () => boolean) => Promise<T>,
  delaiMs: number,
): Promise<T | null | "delai"> {
  if (rendu !== null) return null;
  const jeton = {};
  rendu = jeton;
  let abandon = false;
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      travail(() => abandon),
      new Promise<"delai">((resolve) => {
        minuteur = setTimeout(() => {
          abandon = true;
          resolve("delai");
        }, delaiMs);
      }),
    ]);
  } finally {
    clearTimeout(minuteur);
    if (rendu === jeton) rendu = null;
  }
}

async function entreeSignee(
  req: NextRequest,
  methode: "GET" | "POST",
  chemin: string,
  corpsMax: number,
): Promise<ResultatEntree> {
  if (!fabriqueActive()) return { ok: false, reponse: refus(404, "introuvable") };
  const entree = await controlerEntree(req, {
    methode,
    chemin,
    drapeau: fabriqueActive,
    secrets: () => secretsFabrique(),
    prefixeDebit: PREFIXE_DEBIT_FABRIQUE,
    corpsMaxOctets: corpsMax,
  });
  if (!entree.ok && entree.reponse.status === 400) {
    return { ok: false, reponse: refus(401, "signature_invalide") };
  }
  return entree;
}

interface LigneVersion {
  id: string;
  sha256Texte: string;
  statut: string;
  modifieLe: Date;
  pages?: number | null;
  tailleOctets?: number | null;
  sha256Pdf?: string | null;
}

function estP2002(e: unknown): boolean {
  return (e as { code?: string } | null)?.code === "P2002";
}

export interface DepsFabrique {
  stockage?: StockageGuides | null;
  rendre?: (c: ContenuGuide) => Promise<{ pdf: Buffer; pages?: number }>;
  maintenant?: () => Date;
  /** Délai maximum du rendu (défaut `DELAI_RENDU_MS`). */
  delaiRenduMs?: number;
}

async function rendreParDefaut(c: ContenuGuide): Promise<{ pdf: Buffer; pages?: number }> {
  const { rendreGuidePdf } = await import("./guide-pdf");
  return { pdf: await rendreGuidePdf(c) };
}

export async function deposerContenu(req: NextRequest, deps: DepsFabrique = {}): Promise<Response> {
  try {
    return await deposerContenuInterne(req, deps);
  } catch {
    return refus(503, "base_indisponible");
  }
}

async function deposerContenuInterne(req: NextRequest, deps: DepsFabrique): Promise<Response> {
  const entree = await entreeSignee(req, "POST", CHEMIN_CONTENU, CORPS_MAX_FABRIQUE);
  if (!entree.ok) return entree.reponse;
  let json: unknown;
  try {
    json = JSON.parse(entree.corps.toString("utf8"));
  } catch {
    return refus(400, "corps_illisible");
  }
  const verdict = validerContenu(json);
  if (!verdict.ok) return refus(verdict.statut, verdict.erreur, verdict.plus);
  const { contenu, sha256Texte } = verdict;
  const { code, version, titre } = contenu;

  const stockage = deps.stockage !== undefined ? deps.stockage : ouvrirStockage();
  if (stockage === null) return refus(503, "stockage_indisponible");
  const maintenant = deps.maintenant ?? (() => new Date());
  const cle = cleObjet(code, version);

  const { prisma } = await import("@/lib/prisma");
  const table = prisma.guideReseauVersion;

  // Version en retard sur celle déjà prête : refusée, l'ancienne reste en service.
  const max = await table.findFirst({
    where: { code, statut: "pret" },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  if (max !== null && version < max.version) {
    return refus(409, "version_perimee", { versionMax: max.version });
  }

  // Réservation : INSERT « en_cours ». Concurrence et rejeu se règlent sur l'unicité (code, version).
  let id: string;
  try {
    const cree = await table.create({
      data: {
        code,
        version,
        sha256Texte,
        titre,
        stockage: stockage.mode,
        cleObjet: cle,
        statut: "en_cours",
      },
      select: { id: true },
    });
    id = cree.id;
  } catch (e) {
    if (!estP2002(e)) throw e;
    const ligne = (await table.findUnique({
      where: { code_version: { code, version } },
      select: {
        id: true,
        sha256Texte: true,
        statut: true,
        modifieLe: true,
        pages: true,
        tailleOctets: true,
        sha256Pdf: true,
      },
    })) as LigneVersion | null;
    if (ligne === null) return refus(503, "base_indisponible");
    if (ligne.statut === "pret") {
      if (ligne.sha256Texte !== sha256Texte) return refus(409, "version_existante");
      return reponseJson(200, {
        ok: true,
        deja: true,
        code,
        version,
        pages: ligne.pages ?? null,
        tailleOctets: ligne.tailleOctets ?? null,
        sha256Pdf: ligne.sha256Pdf ?? null,
      });
    }
    const seuil = new Date(maintenant().getTime() - DELAI_EN_COURS_MS);
    if (ligne.statut === "en_cours" && ligne.modifieLe >= seuil) return refus(409, "en_cours");
    const reprise = await table.updateMany({
      where: {
        id: ligne.id,
        OR: [{ statut: "echec" }, { statut: "en_cours", modifieLe: { lt: seuil } }],
      },
      data: { statut: "en_cours", sha256Texte, titre, stockage: stockage.mode, cleObjet: cle },
    });
    if (reprise.count !== 1) return refus(409, "en_cours");
    id = ligne.id;
  }

  const echec = async (): Promise<void> => {
    await table
      .updateMany({ where: { id, statut: "en_cours" }, data: { statut: "echec" } })
      .catch(() => undefined);
  };

  const fait = await seulRendu(async (abandonne) => {
    const { pdf, pages: pagesDonnees } = await (deps.rendre ?? rendreParDefaut)(contenu);
    if (abandonne()) return { refus: refus(503, "echec") };
    const pages = pagesDonnees ?? pagesDuPdf(pdf);
    if (pages > PAGES_MAX || pdf.length > PDF_OCTETS_MAX)
      return { refus: refus(422, "trop_de_pages") };
    try {
      await stockage.deposer(cle, pdf);
      if ((await stockage.taille(cle)) !== pdf.length) throw new Error("taille_differente");
    } catch {
      return { refus: refus(503, "stockage_echec") };
    }
    return { pdf, pages };
  }, deps.delaiRenduMs ?? DELAI_RENDU_MS).catch(() => ({ refus: refus(503, "stockage_echec") }));

  if (fait === null) {
    await echec();
    return refus(429, "rendu_occupe");
  }
  if (fait === "delai") {
    await echec();
    return refus(503, "echec");
  }
  if ("refus" in fait) {
    await echec();
    return fait.refus;
  }
  const sha256Pdf = createHash("sha256").update(fait.pdf).digest("hex");
  try {
    await table.updateMany({
      where: { id, statut: "en_cours" },
      data: { statut: "pret", sha256Pdf, pages: fait.pages, tailleOctets: fait.pdf.length },
    });
  } catch {
    await echec();
    return refus(503, "base_indisponible");
  }
  return reponseJson(201, {
    ok: true,
    deja: false,
    code,
    version,
    pages: fait.pages,
    tailleOctets: fait.pdf.length,
    sha256Pdf,
  });
}

/** `GET /api/interne/guides-reseau/versions?code=gde-…` — signée (chemin ET requête signés). Ni chemin ni lien. */
export async function listerVersions(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") ?? "";
    const entree = await entreeSignee(req, "GET", `${url.pathname}${url.search}`, 0);
    if (!entree.ok) return entree.reponse;
    if (url.pathname !== CHEMIN_VERSIONS || !RE_CODE_GUIDE_CATALOGUE.test(code)) {
      return refus(422, "code_invalide");
    }
    const { prisma } = await import("@/lib/prisma");
    const lignes = await prisma.guideReseauVersion.findMany({
      where: { code },
      orderBy: { version: "desc" },
      take: 200,
      select: {
        version: true,
        sha256Texte: true,
        sha256Pdf: true,
        pages: true,
        tailleOctets: true,
        statut: true,
      },
    });
    return reponseJson(200, lignes);
  } catch {
    return refus(503, "base_indisponible");
  }
}
