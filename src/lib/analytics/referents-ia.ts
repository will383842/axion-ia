// Liste UNIQUE des référents « assistants IA » (fiche GEO V1-10).
//
// SERVEUR uniquement : utilisée par la console (`src/server/analytics/visites-ia.ts`).
// `tracking-referer.ts` (bundle public) ne l'importe PAS — sa liste d'expressions régulières
// est inchangée ; `referents-ia.spec.ts` vérifie que les deux restent alignées.

export type IdIA =
  | "chatgpt"
  | "perplexity"
  | "copilot"
  | "gemini"
  | "mistral"
  | "claude"
  | "deepseek"
  | "you"
  | "phind";

export interface ReferentIA {
  readonly id: IdIA;
  /** Domaines ; un sous-domaine (`www.`, `fr.`…) d'un domaine listé correspond aussi. */
  readonly domaines: readonly string[];
  /** Préfixes de chemin qui rattachent un domaine ambigu à cette IA (ex. bing.com/chat). */
  readonly chemins?: ReadonlyArray<{ readonly domaine: string; readonly prefixe: string }>;
}

export const REFERENTS_IA: readonly ReferentIA[] = [
  { id: "chatgpt", domaines: ["chatgpt.com", "chat.openai.com"] },
  { id: "perplexity", domaines: ["perplexity.ai"] },
  {
    id: "copilot",
    domaines: ["copilot.microsoft.com"],
    chemins: [{ domaine: "bing.com", prefixe: "/chat" }],
  },
  { id: "gemini", domaines: ["gemini.google.com", "bard.google.com"] },
  { id: "mistral", domaines: ["chat.mistral.ai", "mistral.ai"] },
  { id: "claude", domaines: ["claude.ai"] },
  { id: "deepseek", domaines: ["chat.deepseek.com"] },
  { id: "you", domaines: ["you.com"] },
  { id: "phind", domaines: ["phind.com"] },
];

/** Extrait `{ hote, chemin }` d'une URL complète ou d'un référent nu (`chatgpt.com/c/x`). */
function decouper(brut: string): { hote: string; chemin: string } | null {
  const s = brut
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  if (s.length === 0) return null;
  const i = s.search(/[/?#]/);
  const hote = (i === -1 ? s : s.slice(0, i)).replace(/:\d+$/, "");
  const reste = i === -1 ? "" : s.slice(i);
  const chemin = reste.startsWith("/") ? reste.split(/[?#]/)[0]! : "/";
  return hote.length > 0 ? { hote, chemin } : null;
}

function sousDomaineDe(hote: string, domaine: string): boolean {
  return hote === domaine || hote.endsWith(`.${domaine}`);
}

/** Rend l'IA correspondant à un référent (URL ou domaine), ou `null`. Insensible à la casse. */
export function classerReferentIA(referent: string | null | undefined): ReferentIA | null {
  if (!referent) return null;
  const d = decouper(referent);
  if (!d) return null;
  for (const ia of REFERENTS_IA) {
    if (ia.domaines.some((dom) => sousDomaineDe(d.hote, dom))) return ia;
    if (
      ia.chemins?.some(
        (c) =>
          sousDomaineDe(d.hote, c.domaine) &&
          (d.chemin === c.prefixe || d.chemin.startsWith(`${c.prefixe}/`)),
      )
    ) {
      return ia;
    }
  }
  return null;
}
