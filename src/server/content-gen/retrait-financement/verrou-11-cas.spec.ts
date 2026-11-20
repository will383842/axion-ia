/**
 * Passe 7 (`AUDIT-PR-2170-passe7.md`) : les 11 phrases qui perdaient encore des mots non financiers.
 * Sur tous les points d'entrée (texte, `<p>` seul et avec voisines, `<li>`, `<li><strong>`, JSON
 * paragraphe et puce, réponse de FAQ, avantage d'offre), la valeur d'origine est gardée (cas
 * ambigu). Seule exception : la parenthèse « (OPCO) » seule, retirée proprement (cas 6).
 */
import { describe, expect, it } from "vitest";
import { reecrirePerks } from "./plan";
import { reecrireFaq, reecrireHtml, reecrireJson, reecrireTexte } from "./regles";

const PHRASES_PASSE_7: readonly string[] = [
  // A : sigle employé comme qualificatif, ou placé après un vrai service
  "Formation OPCO de deux jours sur ChatGPT.",
  "Atelier ChatGPT financé par l'OPCO.",
  "Audit puis financement OPCO.",
  "Diagnostic et financement OPCO.",
  "Formation éligible CPF.",
  "Ateliers (OPCO) sur ChatGPT.",
  // A4 : parenthèse qui contient un vrai service
  "Nous proposons un accompagnement complet (audit, formation et financement OPCO).",
  "Nos ateliers (formation certifiée Qualiopi) durent deux jours.",
  // B : deuxième proposition après « : » ou « — »
  "OPCO, CPF : nous détaillons ici les trois piliers de notre méthode.",
  "Prise en charge OPCO : comptez 3 jours de formation intra-entreprise.",
  "Les financements OPCO couvrent notre audit — un diagnostic de 2 jours de vos processus.",
];

const PARENTHESE_SEULE = "Ateliers (OPCO) sur ChatGPT.";
const MOTS_A_CONSERVER = [
  "audit",
  "atelier",
  "formation",
  "chatgpt",
  "diagnostic",
  "processus",
  "methode",
  "piliers",
  "jours",
  "accompagnement",
];

const doc = (texte: string) => ({
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Atelier pratique." }] },
    { type: "paragraph", content: [{ type: "text", text: texte }] },
    { type: "paragraph", content: [{ type: "text", text: "Suivi inclus." }] },
  ],
});
const docPuce = (texte: string) => ({
  type: "doc",
  content: [
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Audit." }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: texte }] }],
        },
        {
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Suivi." }] }],
        },
      ],
    },
  ],
});

describe("verrou — les 11 cas de la passe 7 sur tous les points d'entrée", () => {
  it.each(PHRASES_PASSE_7)("%s", (phrase) => {
    const seul = phrase === PARENTHESE_SEULE ? null : phrase;
    const html = {
      p: `<p>${phrase}</p>`,
      voisines: `<p>Atelier pratique. ${phrase} Suivi inclus.</p>`,
      li: `<ul><li>Audit.</li><li>${phrase}</li><li>Suivi.</li></ul>`,
      liBalise: `<ul><li>Audit.</li><li><strong>${phrase.split(" ")[0]}</strong> ${phrase.split(" ").slice(1).join(" ")}</li><li>Suivi.</li></ul>`,
    };
    for (const [nom, entree] of Object.entries(html)) {
      const r = reecrireHtml(entree, "fr");
      if (seul !== null) {
        expect([nom, r.modifie, r.valeur]).toEqual([nom, false, entree]);
      } else if (r.modifie) {
        // Cas 6 : la parenthèse « (OPCO) » part, tout le reste reste.
        expect(r.valeur.replace(/<[^>]+>/g, "")).toContain("Ateliers sur ChatGPT.");
        expect(r.valeur).not.toMatch(/OPCO/);
      }
    }
    // Aucun mot non financier de la phrase ne disparaît, quel que soit le chemin.
    const sorties: string[] = [];
    sorties.push(reecrireTexte(phrase, "fr").valeur);
    sorties.push(reecrireHtml(html.voisines, "fr").valeur);
    sorties.push(reecrireHtml(html.li, "fr").valeur);
    sorties.push(JSON.stringify(reecrireJson(doc(phrase), "fr").valeur));
    sorties.push(JSON.stringify(reecrireJson(docPuce(phrase), "fr").valeur));
    sorties.push(
      JSON.stringify(
        reecrireFaq({ question: "Que comprend l'offre ?", reponse: `<p>${phrase}</p>` }, "fr")
          .valeur,
      ),
    );
    sorties.push(JSON.stringify(reecrirePerks([{ labelFr: phrase }]).valeur));
    const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const attendus = MOTS_A_CONSERVER.filter((m) => sansAccent(phrase).includes(m));
    for (const s of sorties)
      for (const m of attendus) expect([m, sansAccent(s)]).toEqual([m, expect.stringContaining(m)]);
  });

  it("le texte seul est ambigu (valeur d'origine) pour les 10 autres cas", () => {
    for (const p of PHRASES_PASSE_7) {
      if (p === PARENTHESE_SEULE) continue;
      const r = reecrireTexte(p, "fr");
      expect([p, r.valeur, r.modifie]).toEqual([p, p, false]);
    }
  });
});
