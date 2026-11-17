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
// PROFONDEUR : sous Next 16.3.1 ceux du proxy l'emportent (`router-server.js` /
// `send-response.js`). Ce qui protège réellement le corps est la branche `lectureEmail`
// de `poserEnTetesDeSecurite` (`src/proxy.ts`).

import { prisma } from "@/lib/prisma";
import { buildCspHeader } from "@/lib/csp";
import { renderEmailTemplate } from "@/lib/email/templates";
import { masquerSecretsEmail } from "@/lib/email/masquer-secrets";
import { rendreLiensInertes } from "@/lib/email/apercu-lecteur";
import { peutConsulter } from "@/server/auth/habilitations";
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

/** Corps servi : masqué, liens inertes. Copie sans HTML : le texte échappé dans un `<pre>`, sinon `null`. */
export function corpsServi(copie: { subject: string; html: string; text: string }): string | null {
  const m = masquerSecretsEmail(copie);
  if (m.html.trim() !== "") return rendreLiensInertes(m.html);
  if (m.text.trim() !== "") {
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body><pre style="white-space:pre-wrap;font:14px/1.5 monospace;margin:16px">${echapperHtml(m.text)}</pre></body></html>`;
  }
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
      return { ok: true, html: rendreLiensInertes(masquerSecretsEmail(r).html) };
    } catch {
      return { ok: false, phrase: "Ce gabarit ne se rend pas avec le jeu d'exemple." };
    }
  },
};

export const SOURCES_LECTURE: Readonly<Record<string, SourceLecture>> = Object.freeze({
  envoye,
  gabarit,
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
