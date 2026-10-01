/**
 * Ce qui se PARTAGE par lien public, et comment la page part (ADR 0063, D12).
 *
 * `estPartageable` est la SEULE définition (RM-01) : la console l'utilise pour
 * montrer « Copier le lien client », la route publique pour servir ou non.
 * Les deux ne peuvent donc pas diverger.
 *
 * Module pur.
 */

import type {
  AnalyseAntivirusDocument,
  CoteDocumentProjet,
  FormatFichierDocument,
  NatureDocumentProjet,
  OrigineOuvertureDocument,
} from "../../../../prisma/generated/client";

export interface DocumentPartageable {
  readonly archiveLe: Date | null;
  readonly cote: CoteDocumentProjet;
  readonly nature: NatureDocumentProjet;
  readonly fichierFormat: FormatFichierDocument | null;
  readonly analyseAntivirus: AnalyseAntivirusDocument | null;
}

/** Non archivé, envoyé au client, page en ligne, fichier HTML, déclaré sain. Rien d'autre. */
export function estPartageable(d: DocumentPartageable): boolean {
  return (
    d.archiveLe === null &&
    d.cote === "envoye_au_client" &&
    d.nature === "page_en_ligne" &&
    d.fichierFormat === "html" &&
    d.analyseAntivirus === "sain"
  );
}

/**
 * Les en-têtes de la page partagée (§6.2). Origine OPAQUE (jamais
 * `allow-same-origin`) : la page n'atteint ni cookies, ni stockage, ni routes
 * du site ; sans formulaire, fenêtre ni requête de données (`connect-src 'none'`).
 *
 * ⚠️ `Referrer-Policy`, `X-Robots-Tag` et la CSP sont AUSSI posés par la règle
 * `/document/:path*` de `next.config.ts` : la règle générale `/:path*` y pose
 * déjà `Referrer-Policy`, et Next n'ajoute pas l'en-tête d'une route quand la
 * configuration l'a posé (`next/dist/server/send-response.js`). Mêmes valeurs
 * des deux côtés — test `src/app/document/__tests__/la-page-partagee-n-atteint-jamais-le-site.spec.ts`.
 */
export const CSP_PAGE_PARTAGEE = [
  "sandbox allow-scripts",
  "default-src 'none'",
  "script-src 'unsafe-inline' https:",
  "style-src 'unsafe-inline' https:",
  "img-src data: blob: https:",
  "font-src data: https:",
  "media-src data: blob: https:",
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
].join("; ");

export const ENTETES_PAGE_PARTAGEE: Readonly<Record<string, string>> = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": CSP_PAGE_PARTAGEE,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cache-Control": "private, no-store",
  "X-Frame-Options": "DENY",
};

/**
 * Agents d'aperçu et de robots connus : Outlook (liens fiables, aperçus),
 * Teams, Slack, LinkedIn, Google, Microsoft Office, outils en ligne de
 * commande, navigateurs sans tête. Une heuristique, pas une preuve.
 */
export const ROBOTS_CONNUS: ReadonlyArray<RegExp> = [
  /bot\b|bot\/|crawler|spider|preview|scanner|linkexpanding/i,
  /outlook|ms-office|msoffice|microsoft office|safelinks|teams\//i,
  /slack|linkedin|whatsapp|telegram|discord|skype|facebookexternalhit|twitterbot/i,
  /google|bing|yandex|baidu|duckduck|applebot/i,
  /curl|wget|python|java\/|go-http|okhttp|node-fetch|axios|libwww|httpclient/i,
  /headless|phantomjs|puppeteer|playwright|selenium/i,
  /proofpoint|mimecast|barracuda|defender/i,
];

/**
 * `navigateur` si une PERSONNE a navigué (`Sec-Fetch-User: ?1`, document,
 * navigation) depuis un agent hors de la liste des robots ; sinon
 * `apercu_automatique`. Rien n'est retenu de l'agent lui-même.
 */
export function origineOuverture(entetes: Headers): OrigineOuvertureDocument {
  const agent = entetes.get("user-agent") ?? "";
  const personne =
    entetes.get("sec-fetch-user") === "?1" &&
    entetes.get("sec-fetch-dest") === "document" &&
    entetes.get("sec-fetch-mode") === "navigate";
  if (!personne || agent === "" || ROBOTS_CONNUS.some((r) => r.test(agent))) {
    return "apercu_automatique";
  }
  return "navigateur";
}
