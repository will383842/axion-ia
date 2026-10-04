/**
 * Lot OPCO A8 — les pages HTML de la réponse en un clic (module PUR).
 *
 * HTML statique, SANS script : la page marche sur n'importe quel poste
 * d'entreprise, et sa CSP peut tout interdire sauf le style en ligne et le
 * formulaire vers elle-même. Charte du site : terracotta pour les boutons,
 * bleu pour les liens seulement, ivoire en fond. Vouvoiement.
 *
 * ⚠️ Le jeton est dans l'adresse : aucun lien vers un autre site ne figure sur
 * la page (pas même le portail de l'OPCO, qui est dans l'e-mail) — le
 * `Referer` ne peut donc pas l'emporter ailleurs.
 */

import type { IssueFichier } from "./reponse";
import type { QuestionMessage, ReponseEntreprise } from "./planning";

export const ENTETES_PAGE_SUIVI: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    "img-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
  ].join("; "),
};

const ADRESSE_CONTACT = "contact@axion-ia.com";

export function echapper(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STYLE = `
*{box-sizing:border-box}
body{margin:0;background:#faf8f3;color:#2a2520;font:17px/1.6 Manrope,system-ui,-apple-system,"Segoe UI",sans-serif}
header{border-bottom:1px solid #e7e1d6;padding:18px 20px;font-weight:700;font-size:20px}
header span{display:inline-block;width:10px;height:10px;border-radius:50%;background:#c24a1b;margin-right:10px}
main{max-width:640px;margin:0 auto;padding:28px 20px 56px}
.carte{background:#fff;border:1px solid #e7e1d6;border-radius:18px;padding:26px}
h1{font-family:Fraunces,Georgia,serif;font-weight:500;font-size:30px;line-height:1.2;margin:0 0 12px}
p{margin:0 0 14px}
.muted{color:#6b625a;font-size:15px}
.bouton{display:inline-block;border:0;border-radius:999px;padding:14px 26px;font:700 17px Manrope,system-ui,sans-serif;cursor:pointer;margin:0 10px 10px 0;text-decoration:none}
.principal{background:#c24a1b;color:#fff}
.secondaire{background:#fff;color:#c24a1b;border:2px solid #c24a1b}
a{color:#1a4dd9}
a.bouton{color:#fff}
a.bouton.secondaire{color:#c24a1b}
label{display:block;font-weight:600;margin:14px 0 6px}
input[type=date],input[type=file]{font:inherit;padding:10px;border:1px solid #cfc6b8;border-radius:10px;background:#fff;max-width:100%}
.erreur{color:#a12b0c;font-weight:600}
form{display:inline}
form.bloc{display:block}
`;

function page(titre: string, corps: string): string {
  return (
    '<!doctype html><html lang="fr"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta name="robots" content="noindex, nofollow">' +
    `<title>${echapper(titre)} — Axion-IA</title><style>${STYLE}</style></head>` +
    `<body><header><span aria-hidden="true"></span>Axion-IA</header><main><div class="carte">${corps}</div></main></body></html>`
  );
}

/** La page neutre : jeton inconnu, expiré, déjà utilisé, ou suivi coupé — rien ne dit lequel. */
export function pageNeutre(): string {
  return page(
    "Lien indisponible",
    "<h1>Ce lien n'est plus disponible</h1>" +
      "<p>Il a peut-être déjà servi, ou il a expiré.</p>" +
      `<p>Pour toute question, écrivez-nous : <a href="mailto:${ADRESSE_CONTACT}">${ADRESSE_CONTACT}</a>.</p>`,
  );
}

export const LIBELLE_REPONSE: Record<ReponseEntreprise, string> = {
  oui: "Oui, c'est déposé",
  pas_encore: "Pas encore",
  accord: "Accord reçu",
  refus: "Refus",
};

interface ContextePage {
  /** Chemin de la page (sans domaine), cible du formulaire. */
  chemin: string;
  question: QuestionMessage;
  intituleFormation: string;
  nomOpco: string;
  dossierTelechargeable: boolean;
}

function enTete(c: ContextePage): string {
  return (
    `<p class="muted">Formation : ${echapper(c.intituleFormation)} · ${echapper(c.nomOpco)}</p>` +
    (c.dossierTelechargeable
      ? `<p><a href="${echapper(c.chemin)}/dossier">Télécharger le dossier prêt à déposer</a></p>`
      : "")
  );
}

function formulaire(c: ContextePage, reponse: ReponseEntreprise, principal: boolean): string {
  return (
    `<form method="post" action="${echapper(c.chemin)}">` +
    `<input type="hidden" name="reponse" value="${reponse}">` +
    `<button type="submit" class="bouton ${principal ? "principal" : "secondaire"}">${echapper(LIBELLE_REPONSE[reponse])}</button>` +
    "</form>"
  );
}

function formulaireAccord(c: ContextePage, aujourdhui: string, erreur: string | null): string {
  return (
    `<form class="bloc" method="post" action="${echapper(c.chemin)}" enctype="multipart/form-data">` +
    '<input type="hidden" name="reponse" value="accord">' +
    (erreur ? `<p class="erreur" role="alert">${echapper(erreur)}</p>` : "") +
    '<label for="date">Date portée sur l\'accord</label>' +
    `<input id="date" name="date" type="date" required max="${aujourdhui}" value="${aujourdhui}">` +
    '<label for="fichier">Courrier d\'accord (PDF, facultatif, 10 Mo au plus)</label>' +
    '<input id="fichier" name="fichier" type="file" accept="application/pdf,.pdf">' +
    '<p class="muted">Le montant accordé n\'est pas à saisir ici.</p>' +
    '<button type="submit" class="bouton principal">Confirmer l\'accord</button>' +
    "</form>"
  );
}

/** GET sans réponse choisie : la question et ses boutons (formulaires POST). */
export function pageQuestion(c: ContextePage): string {
  const titre =
    c.question === "depot" ? "Avez-vous déposé la demande ?" : `${c.nomOpco} vous a-t-il répondu ?`;
  const boutons =
    c.question === "depot"
      ? formulaire(c, "oui", true) + formulaire(c, "pas_encore", false)
      : `<p><a class="bouton principal" href="${echapper(c.chemin)}?reponse=accord">Accord reçu</a></p>` +
        formulaire(c, "refus", false) +
        formulaire(c, "pas_encore", false);
  return page(titre, `<h1>${echapper(titre)}</h1>${enTete(c)}${boutons}`);
}

/** GET avec une réponse choisie dans l'e-mail : la confirmation, qui seule écrit (POST). */
export function pageConfirmation(
  c: ContextePage,
  reponse: ReponseEntreprise,
  aujourdhui: string,
  erreur: string | null = null,
): string {
  if (reponse === "accord") {
    return page(
      "Accord reçu",
      `<h1>Accord de ${echapper(c.nomOpco)} reçu</h1>${enTete(c)}${formulaireAccord(c, aujourdhui, erreur)}`,
    );
  }
  const phrases: Record<Exclude<ReponseEntreprise, "accord">, string> = {
    oui: "Vous confirmez avoir déposé la demande de prise en charge.",
    pas_encore:
      c.question === "depot"
        ? "Vous indiquez que la demande n'est pas encore déposée."
        : "Vous indiquez ne pas avoir encore reçu de réponse.",
    refus: `Vous indiquez que ${c.nomOpco} a refusé la prise en charge.`,
  };
  return page(
    "Confirmation",
    `<h1>Confirmez votre réponse</h1>${enTete(c)}<p>${echapper(phrases[reponse])}</p>` +
      formulaire(c, reponse, true),
  );
}

const MOT_FICHIER: Record<IssueFichier, string | null> = {
  aucun: null,
  conserve: "Le courrier d'accord est bien enregistré.",
  refuse_format: "Le fichier joint n'est pas un PDF : il n'a pas été conservé.",
  trop_lourd: "Le fichier joint dépasse 10 Mo : il n'a pas été conservé.",
  non_analyse:
    "Le fichier joint n'a pas pu être vérifié et n'a pas été conservé ; vous pouvez nous le transmettre en répondant à notre e-mail.",
  infecte: "Le fichier joint a été refusé par notre antivirus : il n'a pas été conservé.",
};

/** Après le POST. */
export function pageMerci(reponse: ReponseEntreprise, fichier: IssueFichier): string {
  const suite: Record<ReponseEntreprise, string> = {
    oui: "Votre réponse est enregistrée : merci d'avoir déposé la demande.",
    pas_encore: "Votre réponse est enregistrée.",
    accord: "Votre réponse est enregistrée : merci de nous avoir informés de l'accord.",
    refus: "Votre réponse est enregistrée.",
  };
  const mot = MOT_FICHIER[fichier];
  return page(
    "Merci",
    `<h1>Merci</h1><p>${echapper(suite[reponse])}</p>` +
      (mot ? `<p>${echapper(mot)}</p>` : "") +
      '<p class="muted">Vous pouvez fermer cette page.</p>',
  );
}
