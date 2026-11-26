/**
 * Porte d'entrée unique du texte du blog via Claude (écriture + relecture).
 *
 * Verrouillée deux fois, relue À CHAQUE appel :
 *  (a) variable d'environnement `CONTENT_GEN_BLOG_CLAUDE` valant exactement "true" ;
 *  (b) plafonds valides en base (jour ET mois propres au blog), réserve Qualiopi,
 *      drapeau de suspension, limite de relectures par jour.
 * Un refus lève `BlogClaudeRefusError` (UnrecoverableError BullMQ : aucun rejeu).
 * AUCUN secours automatique vers un autre fournisseur, dans aucun sens.
 *
 * Non branchée : tant que rien ne l'appelle, ce module est inerte. Le kill switch
 * global n'est jamais lu ni écrit ici.
 */

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { ProviderError, type GenerationRequest, type GenerationResponse } from "./IProvider";
import { anthropicProvider, computeCost } from "./anthropic";
import { alerterBlogClaude } from "./anthropic-credit-alert";
import { BLOG_TYPES, typeClaudeAutorise } from "./types-claude";
import {
  BORNE_DURE_JOUR_USD,
  BORNE_DURE_MOIS_USD,
  BlogClaudeRefusError,
  jourParis,
  reserverCout,
  type Reservation,
} from "./blog-claude-ledger";

export { BLOG_TYPES, BlogClaudeRefusError };

export type RoleBlogClaude = "ecriture" | "relecture" | "court";

/** Seuls modèles admis sur ce chemin (jamais Haiku 5.5, jamais de `temperature`). */
export const MODELES: Readonly<Record<RoleBlogClaude, string>> = {
  ecriture: "claude-sonnet-5-5",
  relecture: "claude-opus-5-5",
  court: "claude-sonnet-5-5",
};

/** Clé `ContentGenConfig` du drapeau de suspension (levée par le fondateur seulement). */
export const CLE_SUSPENSION = "blog_claude_suspendu";
/** Clés `extraConfig` de la ligne `anthropic` (lues ici, importées par le script de plafonds). */
export const CLE_PLAFOND_JOUR = "blog_claude_daily_cap_usd";
export const CLE_PLAFOND_MOIS = "blog_claude_monthly_cap_usd";
export const CLE_RESERVE_QUALIOPI = "blog_claude_reserve_qualiopi_usd";
export const CLE_JUGE_MAX_JOUR = "blog_claude_juge_max_jour";
/** Refus de crédit (compteur à fenêtre fixe de 24 h, pas « consécutifs ») avant suspension automatique. */
export const SEUIL_REFUS_CREDIT = 3;

const DEFAULT_MAX_TOKENS = 4096;

/** Interrupteur : exactement "true", relu à chaque appel. */
export function interrupteurBlogClaude(): boolean {
  return process.env["CONTENT_GEN_BLOG_CLAUDE"] === "true";
}

function nombrePositif(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function nombreNonNegatif(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function enNombre(v: unknown): number {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number.NaN;
}

function refuser(message: string, code: ConstructorParameters<typeof BlogClaudeRefusError>[1]) {
  return new BlogClaudeRefusError(message, code);
}

interface PlafondsValides {
  readonly jourUsd: number;
  readonly moisBlogUsd: number;
  readonly moisGlobalUsd: number;
  readonly reserveQualiopiUsd: number;
  readonly jugeMaxJour: number | null;
}

/** Lit et VALIDE la ligne `anthropic`. Tout doute = refus, avant toute dépense. */
async function lirePlafonds(role: RoleBlogClaude): Promise<PlafondsValides> {
  let ligne: { enabled: boolean; monthlyCapUsd: unknown; extraConfig: unknown } | null;
  try {
    ligne = await prisma.providerConfig.findUnique({
      where: { provider: "anthropic" },
      select: { enabled: true, monthlyCapUsd: true, extraConfig: true },
    });
  } catch {
    throw refuser("Configuration Anthropic illisible (base en erreur)", "base_indisponible");
  }
  if (!ligne) throw refuser("Ligne de configuration Anthropic absente", "config_invalide");
  if (!ligne.enabled) throw refuser("Fournisseur Anthropic désactivé", "config_invalide");

  const extra =
    ligne.extraConfig && typeof ligne.extraConfig === "object"
      ? (ligne.extraConfig as Record<string, unknown>)
      : {};
  const moisGlobalUsd = enNombre(ligne.monthlyCapUsd);
  const jourUsd = extra[CLE_PLAFOND_JOUR];
  const moisBlogUsd = extra[CLE_PLAFOND_MOIS];
  const reserve = extra[CLE_RESERVE_QUALIOPI];
  const jugeMax = extra[CLE_JUGE_MAX_JOUR];

  if (!nombrePositif(moisGlobalUsd)) {
    throw refuser("Plafond mensuel global invalide", "config_invalide");
  }
  if (!nombrePositif(jourUsd) || jourUsd > BORNE_DURE_JOUR_USD) {
    throw refuser("Plafond du jour du contenu via Claude absent ou invalide", "config_invalide");
  }
  if (!nombrePositif(moisBlogUsd) || moisBlogUsd > BORNE_DURE_MOIS_USD) {
    throw refuser("Plafond du mois du contenu via Claude absent ou invalide", "config_invalide");
  }
  if (!nombreNonNegatif(reserve)) {
    throw refuser("Réserve Qualiopi absente ou invalide", "config_invalide");
  }
  let jugeMaxJour: number | null = null;
  if (role === "relecture") {
    if (!nombrePositif(jugeMax) || !Number.isInteger(jugeMax)) {
      throw refuser("Limite de relectures par jour absente ou invalide", "config_invalide");
    }
    jugeMaxJour = jugeMax;
  }
  return { jourUsd, moisBlogUsd, moisGlobalUsd, reserveQualiopiUsd: reserve, jugeMaxJour };
}

async function estSuspendu(): Promise<boolean> {
  try {
    const row = await prisma.contentGenConfig.findUnique({
      where: { key: CLE_SUSPENSION },
      select: { value: true },
    });
    if (!row) return false;
    const v = row.value as unknown;
    // Ligne présente : seul `false` ou `{ active: false }` explicite lève la suspension.
    // Toute autre valeur (true, null, texte, objet sans `active: false`) = suspendu.
    const leve =
      v === false ||
      (typeof v === "object" &&
        v !== null &&
        !Array.isArray(v) &&
        (v as { active?: unknown }).active === false);
    return !leve;
  } catch {
    // Doute = refus : on ne dépense pas sans pouvoir lire le drapeau.
    throw refuser("Drapeau de suspension illisible (base en erreur)", "base_indisponible");
  }
}

/** Compteur de relectures du jour (Paris) ; refus au-delà de la limite. */
async function compterRelecture(max: number, maintenant: Date): Promise<string> {
  const cle = `blog-claude:juge:${jourParis(maintenant)}`;
  try {
    const n = await redis.incr(cle);
    if (n === 1) await redis.expire(cle, 48 * 3600);
    if (n > max) {
      await redis.decr(cle).catch(() => undefined);
      throw refuser("Limite de relectures du jour atteinte", "juge_limite");
    }
    return cle;
  } catch (err) {
    if (err instanceof BlogClaudeRefusError) throw err;
    throw refuser("Compteur de relectures indisponible", "base_indisponible");
  }
}

export interface AccordBlogClaude {
  readonly model: string;
  readonly reservation: Reservation;
}

/**
 * Vérifie tout AVANT dépense puis réserve le coût maximal de l'appel (une ligne
 * `cost_ledger`, transaction sous verrou). Lève `BlogClaudeRefusError` au moindre
 * doute : base en erreur, plafond invalide/atteint, suspension, réserve Qualiopi.
 */
export async function assertPlafondsClaude(
  req: GenerationRequest,
  role: RoleBlogClaude,
  maintenant: Date = new Date(),
  /** Frais fixes ajoutés au coût maximal réservé (ex. recherches web payées à l'usage). */
  fraisFixesUsd = 0,
): Promise<AccordBlogClaude> {
  if (!(
    typeof fraisFixesUsd === "number" &&
    Number.isFinite(fraisFixesUsd) &&
    fraisFixesUsd >= 0
  )) {
    throw refuser("Frais fixes invalides", "config_invalide");
  }
  if (!interrupteurBlogClaude()) {
    throw refuser("Texte via Claude : interrupteur éteint", "eteint");
  }
  const model = MODELES[role];
  if (
    req.maxTokens !== undefined &&
    !(typeof req.maxTokens === "number" && Number.isInteger(req.maxTokens) && req.maxTokens > 0)
  ) {
    throw refuser("maxTokens doit être un entier strictement positif", "config_invalide");
  }
  if (req.model !== undefined && req.model !== model) {
    throw refuser(`Modèle « ${req.model} » refusé sur ce chemin`, "modele_interdit");
  }
  if (req.role !== "text") {
    throw refuser("Seul le rôle texte est admis sur ce chemin", "config_invalide");
  }
  if (!typeClaudeAutorise(req.contentType)) {
    throw refuser(
      `Type de contenu « ${req.contentType} » non autorisé via Claude (CONTENT_GEN_CLAUDE_TYPES)`,
      "config_invalide",
    );
  }

  const plafonds = await lirePlafonds(role);
  if (await estSuspendu()) {
    throw refuser("Générateur suspendu par le drapeau de suspension", "suspendu");
  }

  let cleJuge: string | null = null;
  if (role === "relecture" && plafonds.jugeMaxJour !== null) {
    cleJuge = await compterRelecture(plafonds.jugeMaxJour, maintenant);
  }

  // Coût maximal : entrée estimée × 1,5 au prix d'écriture du cache + max_tokens en sortie.
  const caracteres = req.systemPrompt.length + req.userPrompt.length;
  const entreeEstimee = Math.ceil(caracteres / 3);
  const coutMaxUsd =
    computeCost(model, 0, req.maxTokens ?? DEFAULT_MAX_TOKENS, 0, Math.ceil(entreeEstimee * 1.5)) +
    fraisFixesUsd;

  try {
    const reservation = await reserverCout({
      jobId: req.jobId,
      model,
      tokensInputEstimes: entreeEstimee,
      coutMaxUsd,
      plafondJourUsd: plafonds.jourUsd,
      plafondMoisBlogUsd: plafonds.moisBlogUsd,
      plafondMoisGlobalUsd: plafonds.moisGlobalUsd,
      reserveQualiopiUsd: plafonds.reserveQualiopiUsd,
      maintenant,
    });
    if (
      reservation.cumulJourUsd >= 0.8 * plafonds.jourUsd ||
      reservation.cumulMoisBlogUsd >= 0.8 * plafonds.moisBlogUsd
    ) {
      void alerterBlogClaude(
        "seuil_80",
        `Jour : ${reservation.cumulJourUsd.toFixed(2)} $ / ${plafonds.jourUsd} $ · ` +
          `mois : ${reservation.cumulMoisBlogUsd.toFixed(2)} $ / ${plafonds.moisBlogUsd} $.`,
      );
    }
    return { model, reservation };
  } catch (err) {
    if (cleJuge) await redis.decr(cleJuge).catch(() => undefined);
    if (err instanceof BlogClaudeRefusError) {
      if (err.code === "plafond_jour") await alerterBlogClaude("plafond_jour");
      if (err.code === "plafond_mois") await alerterBlogClaude("plafond_mois");
    }
    throw err;
  }
}

/** Compte un refus de crédit (Redis, 24 h) ; au seuil, pose le drapeau de suspension. */
async function enregistrerRefusCredit(
  alerteCredit = true,
  raison: "refus_credit_repetes" | "auth_refusee_repetee" = "refus_credit_repetes",
): Promise<void> {
  if (alerteCredit) await alerterBlogClaude("credit_refuse");
  try {
    // Compteurs distincts : crédit et authentification ne se cumulent jamais.
    const cle =
      raison === "auth_refusee_repetee" ? "blog-claude:refus-auth" : "blog-claude:refus-credit";
    const n = await redis.incr(cle);
    if (n === 1) await redis.expire(cle, 24 * 3600);
    if (n >= SEUIL_REFUS_CREDIT) {
      const valeur = {
        active: true,
        raison,
        pose_le: new Date().toISOString(),
      } as never;
      await prisma.contentGenConfig.upsert({
        where: { key: CLE_SUSPENSION },
        create: { key: CLE_SUSPENSION, value: valeur, updatedBy: "system:blog-claude" },
        update: { value: valeur, updatedBy: "system:blog-claude" },
      });
      await alerterBlogClaude("suspendu");
    }
  } catch (err) {
    console.warn(
      "[blog-claude] comptage des refus de crédit impossible :",
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Génère le texte via Claude : écriture = Sonnet 5.5, relecture = Opus 5.5.
 * Lève si l'interrupteur est éteint (le SDK n'est alors JAMAIS atteint).
 */
export async function genererTexteBlogClaude(
  req: GenerationRequest,
  role: RoleBlogClaude,
): Promise<GenerationResponse> {
  if (!interrupteurBlogClaude()) {
    throw refuser("Texte via Claude : interrupteur éteint", "eteint");
  }
  const { model, reservation } = await assertPlafondsClaude(req, role);

  // Jamais de `temperature`, jamais de secours : on retire aussi `preferredProvider`.
  const { temperature: _temperature, preferredProvider: _preferred, ...reste } = req;
  void _temperature;
  void _preferred;
  const requete: GenerationRequest = {
    ...reste,
    model,
    blogClaudeRole: role,
    reservationId: reservation.id,
  };

  try {
    // Le fournisseur SOLDE la réservation dans son `finally` (coût réel, zéro avant flux,
    // ou maximum conservé si l'usage final est inconnu) : aucun second solde ici, il
    // pourrait ramener la ligne SOUS le maximum quand le flux finit sans `message_delta`.
    const reponse = await anthropicProvider.generate(requete);
    return reponse;
  } catch (err) {
    // Échec : la réservation reste au maximum (ou soldée par le fournisseur).
    if (err instanceof ProviderError && err.provider === "anthropic") {
      // Rotation des clés : `toutesEpuisees` est posé par le fournisseur. Un refus de
      // crédit ou d'authentification d'UNE clé sur plusieurs (la rotation a pris la
      // suivante, ou l'erreur est arrivée en cours de flux) ne compte JAMAIS : il ne doit
      // ni alerter « crédit refusé » ni approcher la suspension du générateur. Avec une
      // seule clé configurée le fournisseur pose `true` : comportement d'avant.
      const toutesEpuisees = (err as { toutesEpuisees?: unknown }).toutesEpuisees === true;
      if (err.code === "quota_exhausted") {
        if (toutesEpuisees) await enregistrerRefusCredit();
        throw refuser(err.message, "credit_refuse");
      }
      // 401/403 répétés (clé révoquée, mauvaise organisation) : même compteur, même
      // suspension — sinon les jobs échoueraient sans fin tant que la clé est mauvaise.
      // Seuls les VRAIS refus HTTP comptent (statut 401/403 copié par mapAnthropicError) :
      // « fournisseur désactivé » ou « clé absente » sont aussi `auth_failed` sans statut,
      // et ne doivent pas suspendre le blog. Et seulement si TOUTES les clés sont refusées.
      const statut = (err as { status?: unknown }).status;
      if (err.code === "auth_failed" && (statut === 401 || statut === 403) && toutesEpuisees) {
        await enregistrerRefusCredit(false, "auth_refusee_repetee");
      }
    }
    throw err;
  }
}
