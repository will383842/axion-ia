import type { ContenuPorte, ContextePorte } from "../types";
import { REGLAGES_PAR_DEFAUT } from "../reglages";

const PHRASE =
  "Une petite équipe gagne du temps quand elle range ses tâches répétitives et choisit un outil adapté à son métier.";

/** Génère `n` mots environ, sans aucun terme sensible pour la doctrine. */
export function mots(n: number): string {
  const base = PHRASE.split(" ");
  const out: string[] = [];
  while (out.length < n) out.push(base[out.length % base.length]!);
  return out.join(" ");
}

export const REPONSE_DIRECTE = mots(48);

export function corpsValide(options: { h2?: number; motsParSection?: number } = {}): string {
  const h2 = options.h2 ?? 4;
  const m = options.motsParSection ?? 230;
  const sections = Array.from(
    { length: h2 },
    (_, i) => `<h2>Question ${i + 1} du dirigeant ?</h2><p>${mots(m)}</p>`,
  ).join("\n");
  return [
    "<h1>Comment démarrer avec l'IA dans une PME</h1>",
    `<p>${REPONSE_DIRECTE}</p>`,
    sections,
    "<!--apport:A--><p>Exemple type : une PME de 40 salariés gagne 6 heures par semaine en rangeant ses tâches.</p><!--/apport-->",
    "<!--apport:C--><p>En France, l'AI Act demande à l'employeur de former les équipes qui utilisent l'IA.</p><!--/apport-->",
    `<p>Pour aller plus loin, voyez <a href="/fr/contact">le Diagnostic IA</a>, <a href="/fr/blog/a">un guide</a>, <a href="/fr/blog/b">un autre guide</a> et <a href="https://www.insee.fr/fr/statistiques/1">l'Insee</a> ainsi que <a href="https://www.economie.gouv.fr/dge">la DGE</a>.</p>`,
  ].join("\n");
}

export function contenuValide(surcharge: Partial<ContenuPorte> = {}): ContenuPorte {
  return {
    contentType: "blog_article",
    titre: "Comment démarrer avec l'IA dans une PME",
    metaDescription:
      "Les premières étapes concrètes pour un dirigeant de PME qui veut démarrer avec l'IA.",
    corpsHtml: corpsValide(),
    directAnswer: REPONSE_DIRECTE,
    keyTakeaway: "Commencez par une seule tâche répétitive, mesurez le gain, puis étendez.",
    champsSupplementaires: {},
    auteur: { nom: "Plume IA d'Axion-IA", type: "Organization", reel: true },
    datePublished: "2026-11-01",
    dateModified: null,
    ...surcharge,
  };
}

export const LIENS_SAINS = {
  etat: "ok",
  valeur: { "/fr/contact": "sain", "/fr/blog/a": "sain", "/fr/blog/b": "sain" },
} as const;

export function contexteValide(surcharge: Partial<ContextePorte> = {}): ContextePorte {
  return {
    reglages: REGLAGES_PAR_DEFAUT,
    maintenant: new Date("2026-11-27T10:00:00Z"),
    financementPublicAutorise: false,
    hotesInternes: ["axion-ia.com", "www.axion-ia.com"],
    etatLiens: LIENS_SAINS,
    pageProprietaire: { etat: "ok", valeur: null },
    corpsDejaPublie: { etat: "ok", valeur: null },
    voisinsSemantiques: { etat: "ok", valeur: [] },
    intention: {
      etat: "ok",
      valeur: {
        requeteNormalisee: "demarrer ia pme",
        etat: "libre",
        pageProprietaire: null,
        reserveePourCeContenu: false,
      },
    },
    penalites: {},
    ...surcharge,
  };
}
