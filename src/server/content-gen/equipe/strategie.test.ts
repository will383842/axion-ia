import { describe, it, expect, vi } from "vitest";
import { construireCarte } from "../strategie/carte-requetes";
import { CONTENU_BRIEF, produireBrief, StrategieError, type GenererTexte } from "./strategie";

const ACTIF = { CONTENT_EQUIPE_EDITORIALE: "true" };
const carte = construireCarte([
  { requete: "service pilote IA", url: "https://axion-ia.com/fr/blog/pilote", source: "plan" },
]);
const brief = {
  motCle: "former une équipe à l'IA",
  intention: "information",
  requetesSecondaires: [],
  champSemantique: [],
  entites: [],
  questions: [{ question: "Combien de temps ?", origine: "autre-source", reference: "interne" }],
  urlCible: "https://axion-ia.com/fr/blog/former-equipe-ia",
  cluster: "/journee-ia",
  type: "neuf",
};
const modele = (sortie: unknown): GenererTexte =>
  vi.fn().mockResolvedValue({ output: JSON.stringify(sortie), costUsd: 0.01 });

describe("produireBrief", () => {
  it("interrupteur éteint : ni carte lue ni modèle appelé", async () => {
    const generer = modele(brief);
    for (const env of [
      {},
      { CONTENT_EQUIPE_EDITORIALE: "1" },
      { CONTENT_EQUIPE_EDITORIALE: "TRUE" },
    ]) {
      expect(await produireBrief({ jobId: "j", sujet: "x" }, { carte, generer, env })).toEqual({
        statut: "desactive",
      });
    }
    expect(generer).not.toHaveBeenCalled();
  });

  it("mot-clé déjà possédé : refus sans appeler le modèle", async () => {
    const generer = modele(brief);
    const r = await produireBrief(
      { jobId: "j", sujet: "pilote IA", motCleVise: "service pilote IA" },
      { carte, generer, env: ACTIF },
    );
    expect(r).toEqual({
      statut: "refus",
      motCle: "service pilote IA",
      proprietaire: "https://axion-ia.com/fr/blog/pilote",
    });
    expect(generer).not.toHaveBeenCalled();
  });

  it("mot-clé possédé : propose la mise à jour sur demande, sans modèle", async () => {
    const generer = modele(brief);
    const r = await produireBrief(
      { jobId: "j", sujet: "service pilote IA", siPossede: "mise-a-jour" },
      { carte, generer, env: ACTIF },
    );
    expect(r.statut).toBe("mise-a-jour");
    expect(generer).not.toHaveBeenCalled();
  });

  it("mot-clé libre : appelle le rôle court et rend le brief validé", async () => {
    const generer = modele(brief);
    const r = await produireBrief({ jobId: "j", sujet: "former" }, { carte, generer, env: ACTIF });
    expect(r.statut).toBe("brief");
    expect(generer).toHaveBeenCalledTimes(1);
    expect((generer as ReturnType<typeof vi.fn>).mock.calls[0]![1]).toBe("court");
  });

  it("refuse un brief du modèle dont une question n'a pas d'origine", async () => {
    const mauvais = { ...brief, questions: [{ question: "Q ?", reference: "x" }] };
    await expect(
      produireBrief(
        { jobId: "j", sujet: "former" },
        { carte, generer: modele(mauvais), env: ACTIF },
      ),
    ).rejects.toBeInstanceOf(StrategieError);
  });

  it("refuse si le modèle choisit un mot-clé déjà possédé ailleurs", async () => {
    const pris = { ...brief, motCle: "service pilote IA" };
    const r = await produireBrief(
      { jobId: "j", sujet: "former" },
      { carte, generer: modele(pris), env: ACTIF },
    );
    expect(r.statut).toBe("refus");
  });

  it("mot-clé possédé repris par le modèle sur la même URL en « neuf » : refus", async () => {
    const meme = {
      ...brief,
      motCle: "service pilote IA",
      urlCible: "https://axion-ia.com/fr/blog/pilote",
    };
    const r = await produireBrief(
      { jobId: "j", sujet: "former" },
      { carte, generer: modele(meme), env: ACTIF },
    );
    expect(r.statut).toBe("refus");
    const maj = await produireBrief(
      { jobId: "j", sujet: "former" },
      { carte, generer: modele({ ...meme, type: "mise-a-jour" }), env: ACTIF },
    );
    expect(maj.statut).toBe("brief");
  });

  it("refuse une URL cible hors du site", async () => {
    const hors = { ...brief, urlCible: "https://evil.example/x" };
    await expect(
      produireBrief({ jobId: "j", sujet: "former" }, { carte, generer: modele(hors), env: ACTIF }),
    ).rejects.toBeInstanceOf(StrategieError);
  });

  it("rétrograde en autre-source une origine non fournie", async () => {
    const faux = {
      ...brief,
      questions: [{ question: "Q ?", origine: "search-console", reference: "inventée" }],
    };
    const r = await produireBrief(
      { jobId: "j", sujet: "former" },
      { carte, generer: modele(faux), env: ACTIF },
    );
    expect(r.statut === "brief" && r.brief.questions[0]!.origine).toBe("autre-source");
  });

  it("refuse un sujet ou un mot-clé vide sans appeler le modèle", async () => {
    const generer = modele(brief);
    await expect(
      produireBrief({ jobId: "j", sujet: " " }, { carte, generer, env: ACTIF }),
    ).rejects.toBeInstanceOf(StrategieError);
    await expect(
      produireBrief(
        { jobId: "j", sujet: "x", motCleVise: "de la" },
        { carte, generer, env: ACTIF },
      ),
    ).rejects.toBeInstanceOf(StrategieError);
    expect(generer).not.toHaveBeenCalled();
  });

  it("le type de contenu passe la porte Claude par défaut", async () => {
    const { typeClaudeAutorise } = await import("../providers/types-claude");
    expect(typeClaudeAutorise(CONTENU_BRIEF)).toBe(true);
  });
});
