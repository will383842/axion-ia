import { describe, expect, it } from "vitest";
import { CompteurCout, type AppelModele } from "./commun";
import { critiquerArticle, type EntreeExpert } from "./expert-critique";

const mots = (n: number, b = "m") => Array.from({ length: n }, (_, i) => `${b}${i}`).join(" ");
const sec = (t: string, c = mots(100)) =>
  `<h2>${t}</h2><p data-aeo="answer">${mots(45, "r")}</p><p>${c}</p>`;

const entree = (o: Partial<EntreeExpert> = {}): EntreeExpert => ({
  titre: "Comment automatiser les notes de frais dans une PME ?",
  lecteur: { profil: "pme", metier: "dirigeant d'une PME de services" },
  secteur: "services",
  directAnswer: mots(48, "d"),
  bodyHtml: [
    sec("Quels frais automatiser ?"),
    sec("Quels justificatifs garder ?"),
    sec("Combien de temps ?"),
    sec("Comment former ?"),
  ].join(""),
  faq: [],
  types: ["informatif", "informatif", "informatif", "informatif"],
  gabarit: "analyse",
  ...o,
});

const notes = (o: Record<string, number> = {}) => ({
  q1: 4,
  q2: 4,
  q3: 4,
  q4: 4,
  q5: 4,
  q6: 4,
  ...o,
});
const appelant =
  (sortie: Record<string, unknown>): AppelModele =>
  async () => ({ texte: JSON.stringify(sortie), coutUsd: 0.2 });

describe("critiquerArticle (R5)", () => {
  it("ok quand toutes les notes sont bonnes et sans correction", async () => {
    const r = await critiquerArticle(
      entree(),
      appelant({ verdict: "ok", notes: notes(), corrections: [] }),
      new CompteurCout(),
    );
    expect(r).toMatchObject({ verdict: "ok", codeRefus: null, corrections: [] });
  });

  it("une note inférieure à 3 sur la question 1 (apprend-on quelque chose ?) refuse, même si le modèle dit ok", async () => {
    const r = await critiquerArticle(
      entree(),
      appelant({ verdict: "ok", notes: notes({ q1: 2 }), corrections: [] }),
      new CompteurCout(),
    );
    expect(r.verdict).toBe("reecrire");
    if (r.verdict !== "illisible") {
      expect(r.codeRefus).toBe("generique");
      expect(r.corrections.length).toBeGreaterThan(0);
    }
  });

  it("une note inférieure à 3 sur la question 3 (ordres de grandeur sourcés) refuse avec fait_non_source", async () => {
    const r = await critiquerArticle(
      entree(),
      appelant({ verdict: "ok", notes: notes({ q3: 1 }), corrections: [] }),
      new CompteurCout(),
    );
    expect(r).toMatchObject({ verdict: "reecrire", codeRefus: "fait_non_source" });
  });

  it("un « ok » accompagné de corrections n'est pas un ok", async () => {
    const r = await critiquerArticle(
      entree(),
      appelant({
        verdict: "ok",
        notes: notes(),
        corrections: [{ section: 1, probleme: "vague", attendu: "précis" }],
      }),
      new CompteurCout(),
    );
    expect(r.verdict).toBe("reecrire");
  });

  it("abandonner est conservé avec le code de la question la plus faible", async () => {
    const r = await critiquerArticle(
      entree(),
      appelant({ verdict: "abandonner", notes: notes({ q2: 1 }), corrections: [] }),
      new CompteurCout(),
    );
    expect(r).toMatchObject({ verdict: "abandonner", codeRefus: "non_actionnable" });
  });

  it("une correction vers une section inexistante devient globale", async () => {
    const r = await critiquerArticle(
      entree(),
      appelant({
        verdict: "reecrire",
        notes: notes({ q5: 2 }),
        corrections: [{ section: 9, probleme: "remplissage", attendu: "couper" }],
      }),
      new CompteurCout(),
    );
    if (r.verdict === "illisible") throw new Error();
    expect(r.corrections[0]!.section).toBe("global");
  });

  it("détecte par le code un conseil de faire seul (la mise en place revient à Axion-IA)", async () => {
    const e = entree({
      bodyHtml:
        entree().bodyHtml +
        "<p>Vous pouvez le faire vous-même sans prestataire, en un week-end.</p>",
    });
    const r = await critiquerArticle(
      e,
      appelant({ verdict: "ok", notes: notes(), corrections: [] }),
      new CompteurCout(),
    );
    expect(r.verdict).toBe("reecrire");
    if (r.verdict !== "illisible") {
      expect(r.corrections.map((c) => c.probleme)).toContain("conseil_faire_seul");
      expect(r.codeRefus).toBe("non_actionnable");
    }
  });

  it("rejette une sortie illisible ou aux notes hors 1 à 5", async () => {
    const bad: AppelModele = async () => ({ texte: "bof", coutUsd: 0.1 });
    expect((await critiquerArticle(entree(), bad, new CompteurCout())).verdict).toBe("illisible");
    const hors = await critiquerArticle(
      entree(),
      appelant({ verdict: "ok", notes: notes({ q1: 9 }), corrections: [] }),
      new CompteurCout(),
    );
    expect(hors.verdict).toBe("illisible");
  });

  it("indépendance : Opus, et seul le texte final et le brief sont transmis, jamais le raisonnement du rédacteur", async () => {
    let vu: { modele: string; user: string; system: string } | null = null;
    const appel: AppelModele = async (r) => {
      vu = r;
      return {
        texte: JSON.stringify({ verdict: "ok", notes: notes(), corrections: [] }),
        coutUsd: 0.2,
      };
    };
    await critiquerArticle(entree(), appel, new CompteurCout());
    expect(vu!.modele).toBe("claude-opus-5-5");
    expect(vu!.system).toMatch(/ne connais pas le raisonnement/);
    expect(vu!.system).toContain("dirigeant de PME");
    expect(vu!.user).toContain("<donnees_non_fiables");
  });

  it("fournit au modèle les mesures d'équilibre calculées par le code (remplissage, manque)", async () => {
    let user = "";
    const appel: AppelModele = async (r) => {
      user = r.user;
      return {
        texte: JSON.stringify({ verdict: "ok", notes: notes(), corrections: [] }),
        coutUsd: 0.2,
      };
    };
    const court = entree({
      bodyHtml: [
        sec("Quels frais automatiser ?", mots(5, "x")),
        sec("Quels justificatifs garder ?"),
      ].join(""),
      types: ["informatif", "informatif"],
    });
    await critiquerArticle(court, appel, new CompteurCout());
    expect(user).toContain("section_trop_courte");
  });

  it("détecte « le mettre en place sans faire appel à un prestataire » et localise la section", async () => {
    const e = entree({
      bodyHtml: entree().bodyHtml.replace(
        "Combien de temps ?</h2>",
        "Combien de temps ?</h2><p>Vous pouvez le mettre en place sans faire appel à un prestataire.</p>",
      ),
    });
    const r = await critiquerArticle(
      e,
      appelant({ verdict: "ok", notes: notes(), corrections: [] }),
      new CompteurCout(),
    );
    if (r.verdict === "illisible") throw new Error();
    expect(r.corrections.find((c) => c.probleme === "conseil_faire_seul")?.section).toBe(2);
  });
});
