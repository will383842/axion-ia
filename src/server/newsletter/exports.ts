/**
 * LES DEUX FICHIERS QUI PRÉPARENT L'OUTIL DE LETTRES (lot L3, 2026-09-24).
 *
 * Décision n° 2 de Will : aucun outil tiers ; le site et le CRM se préparent
 * pour MailWizz + PowerMTA, sans rien envoyer. Le site reste la source de
 * vérité du consentement : il calcule qui est ÉLIGIBLE, et l'outil ne reçoit
 * que ceux-là (`revue-mailwizz-powermta.md` §3.2-3.3).
 *
 * ── 1. Les abonnés à importer (format MailWizz) ─────────────────────────────
 * Colonnes = étiquettes des champs de la liste MailWizz, en majuscules :
 *   EMAIL, LOCALE, SOURCE, OPTIN_AT, OPTIN_VERSION, UNSUB_URL, GUIDE
 * Éligible = `confirmed` ET aucune opposition (`email_oppositions`) ET aucun
 * rebond dur connu (`email_logs`). JAMAIS un `pending`, un désabonné, un
 * rejeté, ni un demandeur du guide qui n'est pas abonné. Les filtres de
 * l'écran (langue, provenance, dates, recherche) s'appliquent : le fichier est
 * ce que l'écran montre, restreint aux éligibles.
 *
 * ── 2. La liste de suppression (empreintes) ─────────────────────────────────
 * Ce qui ne doit JAMAIS être importé, ni rester dans l'outil : désabonnés,
 * rejetés, rebonds durs, effacés. AUCUNE adresse : seulement le SHA-256 de
 * l'adresse normalisée (minuscules, sans espaces) — le format que les outils
 * d'envoi savent comparer, et celui du CRM (`email_hash`). Jamais l'empreinte
 * HMAC du site (`hashEmailForLookup`), qui n'a de sens qu'ici.
 *
 * ⚠️ Angle mort DÉCLARÉ : les oppositions (`email_oppositions`) ne portent que
 * l'empreinte HMAC, par doctrine ; on ne peut ni les lister ni les convertir.
 * Elles sont écartées de l'export des abonnés (on teste chaque adresse), mais
 * absentes de la liste de suppression. Un import ne passe que par le fichier 1,
 * qui les filtre : c'est suffisant tant que l'outil ne reçoit rien d'autre.
 *
 * ⚠️ Module serveur ordinaire, PAS `"use server"`.
 */

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { AIMANT_GUIDE_IA } from "@/server/guide-ia/config";
import { VERSION_LETTRE_HISTORIQUE } from "./versions";

export const COLONNES_MAILWIZZ = [
  "EMAIL",
  "LOCALE",
  "SOURCE",
  "OPTIN_AT",
  "OPTIN_VERSION",
  "UNSUB_URL",
  "GUIDE",
] as const;

export const COLONNES_SUPPRESSION = ["EMAIL_SHA256", "MOTIF", "DEPUIS"] as const;

/** Plafond d'un export — au-delà, passer par l'API de l'outil, pas par un fichier. */
export const PLAFOND_EXPORT = 10_000;

export interface FiltresExport {
  readonly locale?: "fr" | "en" | "all";
  readonly source?: string;
  readonly search?: string;
  readonly dateFrom?: string;
  readonly dateTo?: string;
}

/** SHA-256 de l'adresse normalisée — le même calcul que le CRM et le journal d'effacement. */
export function empreinteSha256(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/**
 * Cellule CSV (RFC 4180, séparateur virgule — celui qu'attend l'import MailWizz).
 * Une cellule qui commencerait par `=`, `+`, `-` ou `@` est préfixée d'une
 * apostrophe : ouvert dans un tableur, le fichier n'exécuterait pas de formule.
 */
export function celluleCsv(v: string | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = v;
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ligneCsv(cellules: ReadonlyArray<string | null>): string {
  return cellules.map(celluleCsv).join(",");
}

export function urlDesabonnement(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

function whereFiltres(f: FiltresExport): Record<string, unknown> {
  const where: Record<string, unknown> = { status: "confirmed" };
  if (f.locale === "fr" || f.locale === "en") where["locale"] = f.locale;
  if (f.source) where["source"] = f.source;
  if (f.search && f.search.trim().length >= 2) {
    where["email"] = { contains: f.search.trim(), mode: "insensitive" };
  }
  if (f.dateFrom || f.dateTo) {
    const range: { gte?: Date; lte?: Date } = {};
    if (f.dateFrom) range.gte = new Date(f.dateFrom);
    if (f.dateTo) {
      const to = new Date(f.dateTo);
      to.setUTCHours(23, 59, 59, 999);
      range.lte = to;
    }
    where["createdAt"] = range;
  }
  return where;
}

export interface ResultatExport {
  readonly csv: string;
  readonly lignes: number;
  /** Confirmés écartés parce qu'opposés ou en rebond dur — dit, jamais tu. */
  readonly ecartes: number;
}

export async function exporterAbonnesMailwizz(
  filtres: FiltresExport,
  siteUrl: string,
): Promise<ResultatExport> {
  const abonnes = await prisma.newsletterSubscriber.findMany({
    // `status: confirmed` est posé en DUR par `whereFiltres` : aucun filtre de
    // l'appelant ne peut faire sortir un `pending` ou un désabonné.
    where: whereFiltres(filtres),
    orderBy: { createdAt: "asc" },
    take: PLAFOND_EXPORT,
    select: {
      email: true,
      locale: true,
      source: true,
      confirmedAt: true,
      consentVersion: true,
      unsubscribeToken: true,
    },
  });
  if (abonnes.length === 0) {
    return { csv: COLONNES_MAILWIZZ.join(",") + "\r\n", lignes: 0, ecartes: 0 };
  }

  const cles = new Map<string, string>();
  for (const a of abonnes) {
    const k = hashEmailForLookup(a.email);
    if (k) cles.set(a.email.toLowerCase(), k);
  }
  const emails = abonnes.map((a) => a.email);
  const [oppositions, rebondsDurs, demandes] = await Promise.all([
    prisma.emailOpposition.findMany({
      where: { emailHash: { in: [...cles.values()] } },
      select: { emailHash: true },
    }),
    prisma.emailLog.findMany({
      where: { recipient: { in: emails }, bounceType: "hard" },
      select: { recipient: true },
    }),
    prisma.guideRequest.findMany({
      where: { aimant: AIMANT_GUIDE_IA, emailKey: { in: [...cles.values()] } },
      select: { emailKey: true },
    }),
  ]);
  const opposees = new Set(oppositions.map((o) => o.emailHash));
  const mortes = new Set(rebondsDurs.map((r) => r.recipient.toLowerCase()));
  const avecGuide = new Set(demandes.map((d) => d.emailKey));

  const lignes: string[] = [];
  let ecartes = 0;
  for (const a of abonnes) {
    const bas = a.email.toLowerCase();
    const cle = cles.get(bas);
    // Sans jeton de désabonnement, aucune lettre ne peut porter de lien de
    // retrait : l'abonné n'est pas exportable (il ne l'est pas davantage sans
    // empreinte, qui ne permet pas de vérifier l'opposition).
    if (!cle || opposees.has(cle) || mortes.has(bas) || !a.unsubscribeToken) {
      ecartes++;
      continue;
    }
    lignes.push(
      ligneCsv([
        a.email,
        a.locale,
        a.source ?? "",
        a.confirmedAt ? a.confirmedAt.toISOString() : "",
        a.consentVersion ?? VERSION_LETTRE_HISTORIQUE,
        urlDesabonnement(siteUrl, a.unsubscribeToken),
        avecGuide.has(cle) ? "oui" : "non",
      ]),
    );
  }

  return {
    csv: [COLONNES_MAILWIZZ.join(","), ...lignes].join("\r\n") + "\r\n",
    lignes: lignes.length,
    ecartes,
  };
}

export type MotifSuppression = "desabonne" | "rejete" | "rebond_dur" | "efface";

export async function exporterListeSuppression(): Promise<ResultatExport> {
  const [abonnes, rebonds, effaces] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where: { status: { in: ["unsubscribed", "bounced"] } },
      select: { email: true, status: true, unsubscribedAt: true, updatedAt: true },
      take: PLAFOND_EXPORT,
    }),
    prisma.emailLog.findMany({
      where: { bounceType: "hard" },
      select: { recipient: true, bouncedAt: true },
      orderBy: { bouncedAt: "asc" },
      take: PLAFOND_EXPORT,
    }),
    // L'effacement console trace le SHA-256 de l'adresse (jamais l'adresse) :
    // c'est la seule mémoire qui reste d'une personne effacée, et elle suffit
    // à ne jamais la réimporter.
    prisma.activityLog.findMany({
      where: { action: "newsletter.erased" },
      select: { changes: true, createdAt: true },
      take: PLAFOND_EXPORT,
    }),
  ]);

  const vues = new Map<string, { motif: MotifSuppression; depuis: Date | null }>();
  const ajouter = (hash: string, motif: MotifSuppression, depuis: Date | null): void => {
    if (/^[0-9a-f]{64}$/.test(hash) && !vues.has(hash)) vues.set(hash, { motif, depuis });
  };

  for (const a of abonnes) {
    ajouter(
      empreinteSha256(a.email),
      a.status === "bounced" ? "rejete" : "desabonne",
      a.status === "bounced" ? a.updatedAt : a.unsubscribedAt,
    );
  }
  for (const r of rebonds) {
    // Une adresse déjà pseudonymisée par un effacement (`erased:…`) n'est plus
    // une adresse : son empreinte ne correspondrait à personne.
    if (r.recipient.startsWith("erased:")) continue;
    ajouter(empreinteSha256(r.recipient), "rebond_dur", r.bouncedAt);
  }
  for (const e of effaces) {
    const c = e.changes as { emailHash?: unknown } | null;
    if (c && typeof c.emailHash === "string") ajouter(c.emailHash, "efface", e.createdAt);
  }

  const lignes = [...vues.entries()].map(([hash, v]) =>
    ligneCsv([hash, v.motif, v.depuis ? v.depuis.toISOString() : ""]),
  );
  return {
    csv: [COLONNES_SUPPRESSION.join(","), ...lignes].join("\r\n") + "\r\n",
    lignes: lignes.length,
    ecartes: 0,
  };
}
