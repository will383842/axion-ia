// Lecture plein écran d'un e-mail ENREGISTRÉ (lot I0b-3) : registre des sources.
//
// Une source = qui peut la lire, à quoi ressemble un identifiant valide, comment
// on la charge. Les sources suivantes (réponses écrites à la main, e-mails
// manuels) s'ajoutent ICI, au registre : jamais par un `if` dans la route.
//
// ⛔ Le plein écran ne sert que des e-mails enregistrés (copies, gabarits, réponses),
// jamais un aperçu avant envoi : un aperçu n'est pas adressable par un lien.
//
// Le corps sort TOUJOURS masqué (`masquerSecretsEmail`), à liens inertes
// (`rendreLiensInertes`) et sous une CSP `sandbox` sans aucun `allow-` : ni script,
// ni formulaire. (`sandbox` n'empêche pas un clic de naviguer l'onglet : d'où les liens inertes.)
//
// ⛔ Les en-têtes de `enTetesLecturePleinEcran` sont posés par la route EN DÉFENSE EN
// PROFONDEUR : dans Next 16.3.1 les en-têtes du proxy et de `next.config` l'emportent sur ceux de la
// route (`router-server.js` / `send-response.js`). Ce qui protège réellement le corps est la branche `lectureEmail`
// de `poserEnTetesDeSecurite` (`src/proxy.ts`).

import { prisma } from "@/lib/prisma";
import { buildCspHeader } from "@/lib/csp";
import { renderEmailTemplate } from "@/lib/email/templates";
import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";
import { rendreLiensInertes } from "@/lib/email/apercu-lecteur";
import { peutConsulter, peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { CATALOGUE } from "@/server/email/apercu/catalogue";
import { PAYLOAD_EXEMPLE, VARIANTES_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import type { EmailJobName } from "@/server/queue/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function echapperHtml(t: string): string {
  return t
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Attributs qui peuvent encore faire naviguer ou envoyer : s'il en reste un APRÈS
// `rendreLiensInertes`, le HTML n'est pas servi (échec fermé, audit I0b-3 constats B et C).
const ATTRIBUT_ACTIF = /[\s"'/](href|xlink:href|action|formaction|ping|srcdoc|http-equiv)\s*=/i;

// Animation déclarative (SVG/MathML) qui POSE un `href` sans que le texte `href=` apparaisse
// (`<set attributeName="href" …>`) : ni `sandbox` ni la feuille d'inertie ne l'arrêtent
// (audit I0b-3, constat C1). Toute balise `svg`, `math`, `set`, `animate…` ou tout `attributeName` : échec fermé.
const ANIMATION_ACTIVE = /<(?:svg|math|set|animate\w*)\b|\battributename\s*=/i;

const FEUILLE_INERTE =
  "<style>a,area{pointer-events:none!important;cursor:default!important}</style>";

// react-email pose `<meta http-equiv="Content-Type">` dans CHAQUE gabarit : inoffensif (le
// charset vient de l'en-tête de la réponse), retiré avant le contrôle pour ne pas faire
// tomber tout le catalogue en `<pre>`. Tout autre `http-equiv` (refresh…) reste refusé.
const META_CONTENT_TYPE =
  /<meta\b[^>"']*(?:"[^"]*"|'[^']*'|[^>"'])*?\bhttp-equiv\s*=\s*(?:"content-type"|'content-type'|content-type)(?:"[^"]*"|'[^']*'|[^>"'])*>/gi;

function pageTexte(texte: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body><pre style="white-space:pre-wrap;font:14px/1.5 monospace;margin:16px">${echapperHtml(texte)}</pre></body></html>`;
}

/**
 * Corps servi : masqué, liens inertes. Si un attribut actif survit, ou sans HTML : le texte
 * (sinon le HTML source) échappé dans un `<pre>`. `null` si la copie est vide.
 */
export function corpsServi(copie: { subject: string; html: string; text: string }): string | null {
  const m = masquerSecretsEmail(copie);
  if (m.html.trim() !== "") {
    const inerte = rendreLiensInertes(m.html).replace(META_CONTENT_TYPE, "");
    if (!ATTRIBUT_ACTIF.test(inerte) && !ANIMATION_ACTIVE.test(inerte)) {
      return inerte.includes("</head>")
        ? inerte.replace("</head>", `${FEUILLE_INERTE}</head>`)
        : `${FEUILLE_INERTE}${inerte}`;
    }
    return pageTexte(m.text.trim() !== "" ? m.text : m.html);
  }
  if (m.text.trim() !== "") return pageTexte(m.text);
  return null;
}

export type ResultatLecture = { ok: true; html: string } | { ok: false; phrase: string };

export interface SourceLecture {
  /** Le rôle peut-il lire cette source ? Contrôlé AVANT toute lecture en base. */
  habilite(role: string | null | undefined): boolean;
  /** Forme de l'identifiant, vérifiée sans toucher à la base. */
  idValide(id: string): boolean;
  charger(id: string, options: { variante?: string | undefined }): Promise<ResultatLecture>;
}

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

const aucuneCopie: ResultatLecture = {
  ok: false,
  phrase: "Aucune copie de cet e-mail n'est conservée : il est introuvable.",
};

/** Copie conservée par le worker à l'envoi (`email_log_contents`). Droit : `peutConsulter`, comme le détail. */
const envoye: SourceLecture = {
  habilite: peutConsulter,
  idValide: (id) => UUID.test(id),
  async charger(id) {
    if (estStub()) return aucuneCopie;
    const copie = await prisma.emailLogContent.findUnique({
      where: { emailLogId: id },
      select: { subject: true, html: true, text: true },
    });
    if (!copie) return aucuneCopie;
    // Sans effet sur une copie déjà masquée ; utile pour une ancienne copie.
    const html = corpsServi(copie);
    return html === null ? aucuneCopie : { ok: true, html };
  },
};

function estGabarit(nom: string): nom is EmailJobName {
  return Object.prototype.hasOwnProperty.call(CATALOGUE, nom);
}

/** Exemple du catalogue. Même garde que la page des gabarits (console : `peutConsulter`). */
const gabarit: SourceLecture = {
  habilite: peutConsulter,
  idValide: (id) => /^[a-z0-9-]{1,100}$/.test(id) && estGabarit(id),
  async charger(id, { variante }) {
    if (!estGabarit(id)) return { ok: false, phrase: "Gabarit inconnu." };
    const variantes = VARIANTES_EXEMPLE[id] ?? {};
    const choisie =
      variante !== undefined && Object.prototype.hasOwnProperty.call(variantes, variante)
        ? variantes[variante]
        : {};
    try {
      const r = await renderEmailTemplate(id, "fr", { ...PAYLOAD_EXEMPLE, ...choisie });
      const html = corpsServi(r);
      return html === null
        ? { ok: false, phrase: "Ce gabarit ne se rend pas avec le jeu d'exemple." }
        : { ok: true, html };
    } catch {
      return { ok: false, phrase: "Ce gabarit ne se rend pas avec le jeu d'exemple." };
    }
  },
};

// Identifiant d'une réponse écrite à la main : un cuid (colonne texte, pas un UUID).
const ID_REPONSE = /^[A-Za-z0-9]{20,40}$/;

const reponseIntrouvable: ResultatLecture = {
  ok: false,
  phrase: "Cette réponse est introuvable.",
};

/**
 * Réponse écrite à la main à une DEMANDE. Droit : `peutConsulter`, comme la page d'une demande.
 * ⛔ Le HTML stocké porte le vrai lien d'opposition : il sort masqué (`corpsServi`).
 */
const reponseDemande: SourceLecture = {
  habilite: peutConsulter,
  idValide: (id) => ID_REPONSE.test(id),
  async charger(id) {
    if (estStub()) return reponseIntrouvable;
    const l = await prisma.submissionReply.findUnique({
      where: { id },
      select: { subject: true, bodyHtml: true, bodyText: true },
    });
    if (!l) return reponseIntrouvable;
    const html = corpsServi({ subject: l.subject, html: l.bodyHtml, text: l.bodyText });
    return html === null ? reponseIntrouvable : { ok: true, html };
  },
};

/** Réponse écrite à la main à un CANDIDAT. Droit : `peutOuvrirDossierCandidat` (pas `reader`). */
const reponseCandidature: SourceLecture = {
  habilite: peutOuvrirDossierCandidat,
  idValide: (id) => ID_REPONSE.test(id),
  async charger(id) {
    if (estStub()) return reponseIntrouvable;
    const l = await prisma.jobApplicationReply.findUnique({
      where: { id },
      select: { subject: true, bodyHtml: true, bodyText: true },
    });
    if (!l) return reponseIntrouvable;
    const html = corpsServi({ subject: l.subject, html: l.bodyHtml, text: l.bodyText });
    return html === null ? reponseIntrouvable : { ok: true, html };
  },
};

export const SOURCES_LECTURE: Readonly<Record<string, SourceLecture>> = Object.freeze({
  envoye,
  gabarit,
  "reponse-demande": reponseDemande,
  "reponse-candidature": reponseCandidature,
});

/** Source du registre, ou `null` : une clé héritée de `Object.prototype` n'en est pas une. */
export function sourceLecture(nom: string): SourceLecture | null {
  return Object.prototype.hasOwnProperty.call(SOURCES_LECTURE, nom)
    ? (SOURCES_LECTURE[nom] ?? null)
    : null;
}

/** Les six en-têtes de la réponse. La CSP vient de `buildCspHeader`, comme au proxy. */
export function enTetesLecturePleinEcran(): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": buildCspHeader({ nonce: "", strict: true, lectureEmail: true }),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex",
  };
}
