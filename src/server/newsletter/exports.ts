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
 * rebond dur connu (`email_logs`) ET moins de `SEUIL_REBONDS_MOUS` rebonds
 * temporaires. JAMAIS un `pending`, un désabonné, un rejeté, ni un demandeur
 * du guide qui n'est pas abonné. Les filtres de l'écran (langue, provenance,
 * dates, recherche) s'appliquent : le fichier est ce que l'écran montre,
 * restreint aux éligibles. L'adresse (colonne EMAIL) sort telle quelle : elle
 * a été validée à l'inscription ; la neutralisation anti-formule vaut pour
 * les autres colonnes.
 *
 * ── 2. La liste de suppression (empreintes) ─────────────────────────────────
 * Ce qui ne doit JAMAIS être importé, ni rester dans l'outil : désabonnés,
 * rejetés, rebonds durs, effacés (depuis la console — `newsletter.erased` —
 * ET par l'effacement public — `gdpr.erase.completed`, champ `emailSha256`).
 * AUCUNE adresse : seulement le SHA-256 de l'adresse normalisée (minuscules,
 * sans espaces) — le format que les outils d'envoi savent comparer, et celui
 * du CRM (`email_hash`). Jamais l'empreinte HMAC du site
 * (`hashEmailForLookup`), qui n'a de sens qu'ici.
 *
 * Chaque source est lue de la plus récente à la plus ancienne, sous un
 * plafond ; si une source l'atteint, le résultat le dit (`tronque`) et le
 * fichier téléchargé aussi (nom et en-tête) — jamais une troncature muette.
 *
 * ⚠️ Angles morts DÉCLARÉS de la liste de suppression :
 *   · les oppositions (`email_oppositions`) ne portent que l'empreinte HMAC,
 *     par doctrine ; on ne peut ni les lister ni les convertir en SHA-256 ;
 *   · les effacements venus du CRM ne laissent sur le site aucune trace
 *     d'effacement propre : l'abonné trouvé y est seulement désabonné, et ne
 *     sort ici que comme `desabonne` tant que sa ligne subsiste.
 * Les deux sont écartés de l'export des abonnés (fichier 1, qui teste chaque
 * adresse : l'opposition par HMAC, l'effacé parce qu'il n'a plus de ligne),
 * mais absents du fichier 2. Un import ne passe que par le fichier 1 : c'est
 * suffisant tant que l'outil ne reçoit rien d'autre.
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

/**
 * Rebonds temporaires à partir desquels un inscrit n'est plus exporté. Même
 * seuil que `ListeSuppression::SEUIL_REBONDS_TEMPORAIRES` du CRM (ADR 0052
 * §b) : une boîte pleine trois fois de suite ne se relit plus.
 */
export const SEUIL_REBONDS_MOUS = 3;

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
 *
 * `neutraliser: false` — pour l'ADRESSE seulement : validée à l'inscription,
 * elle doit arriver dans l'outil telle quelle ; une apostrophe devant la
 * rendrait inutilisable à l'import. Les guillemets restent échappés.
 */
export function celluleCsv(
  v: string | null | undefined,
  options: { readonly neutraliser?: boolean } = {},
): string {
  if (v === null || v === undefined) return "";
  let s = v;
  if (options.neutraliser !== false && /^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ligneCsv(cellules: ReadonlyArray<string | null>): string {
  return cellules.map((c) => celluleCsv(c)).join(",");
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
  /** Inscrits écartés (opposés, rebond dur, rebonds temporaires, sans jeton) — dit, jamais tu. */
  readonly ecartes: number;
  /** Une source a atteint `PLAFOND_EXPORT` : le fichier est INCOMPLET. */
  readonly tronque: boolean;
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
      softBounceCount: true,
    },
  });
  const tronque = abonnes.length >= PLAFOND_EXPORT;
  if (abonnes.length === 0) {
    return { csv: COLONNES_MAILWIZZ.join(",") + "\r\n", lignes: 0, ecartes: 0, tronque };
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
    if (
      !cle ||
      opposees.has(cle) ||
      mortes.has(bas) ||
      a.softBounceCount >= SEUIL_REBONDS_MOUS ||
      !a.unsubscribeToken
    ) {
      ecartes++;
      continue;
    }
    lignes.push(
      [
        celluleCsv(a.email, { neutraliser: false }),
        ligneCsv([
          a.locale,
          a.source ?? "",
          a.confirmedAt ? a.confirmedAt.toISOString() : "",
          a.consentVersion ?? VERSION_LETTRE_HISTORIQUE,
          urlDesabonnement(siteUrl, a.unsubscribeToken),
          avecGuide.has(cle) ? "oui" : "non",
        ]),
      ].join(","),
    );
  }

  return {
    csv: [COLONNES_MAILWIZZ.join(","), ...lignes].join("\r\n") + "\r\n",
    lignes: lignes.length,
    ecartes,
    tronque,
  };
}

export type MotifSuppression = "desabonne" | "rejete" | "rebond_dur" | "efface";

export async function exporterListeSuppression(): Promise<ResultatExport> {
  // Chaque source, la plus RÉCENTE d'abord : sous le plafond, ce qu'on perd
  // est le plus ancien — et on le dit (`tronque`).
  const [abonnes, rebonds, effacesConsole, effacesPublics] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where: { status: { in: ["unsubscribed", "bounced"] } },
      select: { email: true, status: true, unsubscribedAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: PLAFOND_EXPORT,
    }),
    prisma.emailLog.findMany({
      where: { bounceType: "hard" },
      select: { recipient: true, bouncedAt: true },
      orderBy: { bouncedAt: "desc" },
      take: PLAFOND_EXPORT,
    }),
    // L'effacement console trace le SHA-256 de l'adresse (jamais l'adresse) :
    // c'est la seule mémoire qui reste d'une personne effacée, et elle suffit
    // à ne jamais la réimporter.
    prisma.activityLog.findMany({
      where: { action: "newsletter.erased" },
      select: { changes: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: PLAFOND_EXPORT,
    }),
    // L'effacement PUBLIC (`/api/gdpr-erase`) trace, à côté de l'empreinte
    // HMAC du site, le même SHA-256 (`emailSha256`).
    prisma.activityLog.findMany({
      where: { action: "gdpr.erase.completed" },
      select: { changes: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: PLAFOND_EXPORT,
    }),
  ]);
  const tronque = [abonnes, rebonds, effacesConsole, effacesPublics].some(
    (source) => source.length >= PLAFOND_EXPORT,
  );

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
  for (const e of effacesConsole) {
    const c = e.changes as { emailHash?: unknown } | null;
    if (c && typeof c.emailHash === "string") ajouter(c.emailHash, "efface", e.createdAt);
  }
  for (const e of effacesPublics) {
    // ⚠️ `emailSha256`, PAS `emailHash` : sur ce journal, `emailHash` est
    // l'empreinte HMAC du site, qui ne correspondrait à rien dans l'outil.
    const c = e.changes as { emailSha256?: unknown } | null;
    if (c && typeof c.emailSha256 === "string") ajouter(c.emailSha256, "efface", e.createdAt);
  }

  const lignes = [...vues.entries()].map(([hash, v]) =>
    ligneCsv([hash, v.motif, v.depuis ? v.depuis.toISOString() : ""]),
  );
  return {
    csv: [COLONNES_SUPPRESSION.join(","), ...lignes].join("\r\n") + "\r\n",
    lignes: lignes.length,
    ecartes: 0,
    tronque,
  };
}
