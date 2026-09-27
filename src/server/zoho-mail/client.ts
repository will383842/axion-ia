// CLIENT ZOHO MAIL — LECTURE SEULE (2026-09-27).
//
// Sert à UNE chose : relever, dans la boîte de réception contact@axion-ia.com,
// les réponses des candidats apporteurs à leur invitation
// (`features/commercial-application/reponses-entrantes-apporteur.ts`).
//
// ── Ce qu'il lit, et rien de plus ─────────────────────────────────────────
//   · la liste des messages de la boîte de réception : expéditeur, date, objet,
//     et le RÉSUMÉ que Zoho calcule du corps (`summary`, quelques phrases) ;
//   · les en-têtes d'un message, seulement pour un expéditeur reconnu : ils
//     disent si c'est une réponse automatique, et portent le `Message-ID`.
// Jamais le corps complet, jamais une pièce jointe : aucune route de ce client
// n'y mène.
//
// ── Accès : OAuth2 par jeton de rafraîchissement (client « Self Client ») ──
// Portées minimales : `ZohoMail.accounts.READ` (découvrir le compte si
// `ZOHO_MAIL_ACCOUNT_ID` est absent), `ZohoMail.folders.READ` (trouver la
// boîte de réception), `ZohoMail.messages.READ` (liste et en-têtes).
//
// ── Sans configuration : INERTE ───────────────────────────────────────────
// `lireConfigZohoMail` rend `null` si une des trois variables obligatoires
// manque : l'appelant ne fait rien (et le dit une fois). Aucune variable n'est
// exigée au build ni au démarrage.
//
// ⚠️ Tourne dans le WORKER (tsx, hors Next) : ni `server-only`, ni Sentry Next,
// ni `@/env` — `process.env` est lu directement, comme le fait
// `relances-invitation-apporteur.ts` pour `CALENDLY_APPORTEUR_URL`.

import { normaliserEntetes, type Entetes } from "@/lib/commercial-application/reponse-entrante";

/** Centres de données Zoho acceptés — `accounts.zoho.<dc>` / `mail.zoho.<dc>`. */
const DC_ACCEPTES = new Set(["eu", "com", "in", "com.au", "jp", "ca", "sa", "uk", "com.cn"]);

export interface ConfigZohoMail {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
  /** Compte à lire ; `null` = découvert par l'API (premier compte du jeton). */
  readonly accountId: string | null;
  /** Centre de données : `eu` par défaut. */
  readonly dc: string;
}

/** La configuration, ou `null` si une variable obligatoire manque (module inerte). */
export function lireConfigZohoMail(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ConfigZohoMail | null {
  const lire = (k: string) => {
    const v = env[k]?.trim();
    return v ? v : null;
  };
  const clientId = lire("ZOHO_MAIL_CLIENT_ID");
  const clientSecret = lire("ZOHO_MAIL_CLIENT_SECRET");
  const refreshToken = lire("ZOHO_MAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;
  const dc = (lire("ZOHO_MAIL_DC") ?? "eu").toLowerCase();
  if (!DC_ACCEPTES.has(dc)) {
    console.warn(`[zoho-mail] ZOHO_MAIL_DC « ${dc} » inconnu : le relevé reste inerte.`);
    return null;
  }
  return { clientId, clientSecret, refreshToken, accountId: lire("ZOHO_MAIL_ACCOUNT_ID"), dc };
}

/** Un message de la boîte de réception, réduit à ce que le relevé utilise. */
export interface MessageZoho {
  readonly messageId: string;
  readonly folderId: string;
  /** Adresse de l'expéditeur telle que Zoho la donne (`fromAddress`). */
  readonly fromAddress: string;
  readonly subject: string;
  /** Résumé du corps calculé par Zoho — quelques phrases, jamais le corps entier. */
  readonly summary: string;
  readonly receivedAt: Date;
}

export interface ResultatListe {
  readonly messages: readonly MessageZoho[];
  /** `false` : le plafond de pages a été atteint avant de remonter jusqu'à `depuis`. */
  readonly complet: boolean;
}

export interface ClientZohoMail {
  /** Messages de la boîte de réception reçus à partir de `depuis`, du plus récent au plus ancien. */
  listerMessagesRecus(depuis: Date): Promise<ResultatListe>;
  /** En-têtes d'un message, noms en minuscules. */
  lireEntetes(folderId: string, messageId: string): Promise<Entetes>;
}

export class ErreurZohoMail extends Error {
  constructor(
    message: string,
    readonly statut: number | null,
  ) {
    super(message);
    this.name = "ErreurZohoMail";
  }
}

type Fetch = typeof fetch;

const TAILLE_PAGE = 200; // maximum accepté par l'API
const PAGES_MAX = 10;
const DELAI_MS = 15_000;

/**
 * Les identifiants Zoho dépassent 2^53 : lus comme NOMBRES par `JSON.parse`,
 * ils perdraient leurs derniers chiffres (1709887058769100001 → …100000) et
 * désigneraient un autre message. La liste les rend en chaînes, mais d'autres
 * routes en nombres : on les met entre guillemets AVANT d'analyser.
 */
function analyserJson(texte: string): unknown {
  return JSON.parse(
    texte.replace(/"(messageId|folderId|threadId|accountId)"\s*:\s*(\d{15,})/g, '"$1":"$2"'),
  );
}

function chaine(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

export function creerClientZohoMail(
  config: ConfigZohoMail,
  fetchImpl: Fetch = fetch,
): ClientZohoMail {
  const baseComptes = `https://accounts.zoho.${config.dc}`;
  const baseMail = `https://mail.zoho.${config.dc}`;
  let jeton: { valeur: string; expireA: number } | null = null;
  let compte: string | null = config.accountId;
  let boite: string | null = null;

  async function jetonAcces(): Promise<string> {
    if (jeton && jeton.expireA > Date.now() + 60_000) return jeton.valeur;
    const corps = new URLSearchParams({
      refresh_token: config.refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    });
    const rep = await fetchImpl(`${baseComptes}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: corps.toString(),
      signal: AbortSignal.timeout(DELAI_MS),
    });
    const json = (await rep.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    // 🔑 Zoho répond 200 avec `{ "error": "invalid_code" }` à un jeton révoqué :
    // le statut HTTP seul ne suffit pas.
    if (!rep.ok || !json.access_token) {
      throw new ErreurZohoMail(
        `jeton d'accès refusé (${rep.status}${json.error ? `, ${json.error}` : ""})`,
        rep.status,
      );
    }
    jeton = {
      valeur: json.access_token,
      expireA: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
    return jeton.valeur;
  }

  async function appeler(chemin: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`${baseMail}${chemin}`);
    for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);
    const rep = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Zoho-oauthtoken ${await jetonAcces()}`,
      },
      signal: AbortSignal.timeout(DELAI_MS),
    });
    const texte = await rep.text();
    if (!rep.ok) {
      throw new ErreurZohoMail(`GET ${chemin} → ${rep.status}`, rep.status);
    }
    const json = analyserJson(texte) as { data?: unknown };
    return json.data;
  }

  async function idCompte(): Promise<string> {
    if (compte) return compte;
    const data = await appeler("/api/accounts");
    const premier = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : null;
    const id = premier ? chaine(premier["accountId"]) : "";
    if (!id) throw new ErreurZohoMail("aucun compte Zoho Mail visible avec ce jeton", null);
    compte = id;
    return id;
  }

  async function idBoiteDeReception(): Promise<string> {
    if (boite) return boite;
    const data = await appeler(`/api/accounts/${await idCompte()}/folders`);
    const dossiers = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    const inbox = dossiers.find((d) => chaine(d["folderType"]).toLowerCase() === "inbox");
    const id = inbox ? chaine(inbox["folderId"]) : "";
    if (!id) throw new ErreurZohoMail("boîte de réception introuvable", null);
    boite = id;
    return id;
  }

  return {
    async listerMessagesRecus(depuis: Date): Promise<ResultatListe> {
      const acc = await idCompte();
      const folderId = await idBoiteDeReception();
      const messages: MessageZoho[] = [];
      for (let page = 0; page < PAGES_MAX; page++) {
        const data = await appeler(`/api/accounts/${acc}/messages/view`, {
          folderId,
          start: String(page * TAILLE_PAGE + 1),
          limit: String(TAILLE_PAGE),
          sortBy: "date",
          sortorder: "false", // du plus récent au plus ancien
        });
        const lignes = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
        for (const l of lignes) {
          const recu = Number(chaine(l["receivedTime"]) || chaine(l["receivedtime"]));
          if (!Number.isFinite(recu) || recu <= 0) continue;
          if (recu < depuis.getTime()) return { messages, complet: true };
          const messageId = chaine(l["messageId"]);
          if (!messageId) continue;
          messages.push({
            messageId,
            folderId: chaine(l["folderId"]) || folderId,
            fromAddress: chaine(l["fromAddress"]),
            subject: chaine(l["subject"]),
            summary: chaine(l["summary"]),
            receivedAt: new Date(recu),
          });
        }
        if (lignes.length < TAILLE_PAGE) return { messages, complet: true };
      }
      return { messages, complet: false };
    },

    async lireEntetes(folderId: string, messageId: string): Promise<Entetes> {
      const acc = await idCompte();
      const data = (await appeler(
        `/api/accounts/${acc}/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/header`,
        { raw: "false" },
      )) as { headerContent?: unknown } | undefined;
      return normaliserEntetes(data?.headerContent);
    },
  };
}
