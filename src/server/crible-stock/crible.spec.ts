import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SIGNATURE_NOM,
  SIGNATURE_TITRE,
  chiffresSansSource,
  citationsNonAttribuees,
  cribler,
  definitionAbsente,
  glossaireAbsent,
  type ArticleACribler,
} from "./analyse";
import { SLUGS_EXCLUS_TEMOIGNAGE, raisonExclusion } from "./exclusions";
import { champsARestaurer, empreintePlan, propositions, rapport } from "./plan";

const base: ArticleACribler = {
  id: "a1",
  slug: "agents-ia-pme",
  titre: "Agents IA en PME",
  corpsHtml:
    '<p>Un agent IA est un programme qui agit seul. <a href="/fr/glossaire/agent-ia">Voir le glossaire</a></p>',
  directAnswer: "Un agent IA est un programme autonome.",
  keyTakeaway: null,
  expertNom: null,
  expertTitre: null,
  expertTexte: null,
  isNews: false,
};
const avec = (o: Partial<ArticleACribler>): ArticleACribler => ({ ...base, ...o });

describe("exclusions : les 43 articles restent tels quels", () => {
  it("la liste compte exactement 43 slugs distincts", () => {
    expect(SLUGS_EXCLUS_TEMOIGNAGE.size).toBe(43);
    expect(SLUGS_EXCLUS_TEMOIGNAGE.has("accelerer-time-to-market-eti-ia-montfermeil")).toBe(true);
    expect(SLUGS_EXCLUS_TEMOIGNAGE.has("roi-ia-cabinet-comptable-clichy")).toBe(true);
  });
  it("un article de la liste n'a AUCUNE correction, même avec un avis signé d'une personne", () => {
    const r = cribler(
      avec({
        slug: "accelerer-time-to-market-eti-ia-montfermeil",
        expertNom: "Jean Dupont",
        expertTitre: "Directeur",
        expertTexte: "Une prise de position.",
      }),
    );
    expect(r.exclusion).toBe("liste-43");
    expect(r.correction).toBeNull();
    expect(propositions([r])).toHaveLength(0);
  });
  it("un témoignage détecté dans le corps exclut l'article, même hors liste", () => {
    const r = cribler(
      avec({
        slug: "article-inconnu",
        corpsHtml: "<p>Grâce à Axion-IA, nous avons réduit nos coûts de 30 %.</p>",
        expertNom: "Jean Dupont",
        expertTexte: "Une prise de position.",
      }),
    );
    expect(r.exclusion).toBe("detecte-temoignage");
    expect(r.correction).toBeNull();
  });
  it("une adresse de cas client exclut l'article", () => {
    expect(raisonExclusion("formation-ia-lille-cas-concret-pme", [])).toBe("adresse-cas");
    expect(raisonExclusion("etude-cas-audit-ia-x", [])).toBe("adresse-cas");
    expect(raisonExclusion("agents-ia-pme", [])).toBeNull();
  });
});

describe("corrections : avis d'expert seulement", () => {
  it("un avis signé d'une personne est réattribué, le texte reste", () => {
    const r = cribler(
      avec({
        expertNom: "Manon",
        expertTitre: "Experte IA",
        expertTexte: "Mon avis sur les agents.",
      }),
    );
    expect(r.constats.some((c) => c.code === "citation-expert-nommee")).toBe(true);
    expect(r.correction?.type).toBe("reattribuer-avis");
    expect(r.correction?.apres).toEqual({
      expertQuoteName: SIGNATURE_NOM,
      expertQuoteTitle: SIGNATURE_TITRE,
      expertQuoteText: "Mon avis sur les agents.",
    });
  });
  it("un avis déjà signé Axion-IA n'est pas touché", () => {
    const r = cribler(
      avec({ expertNom: "Axion-IA", expertTitre: SIGNATURE_TITRE, expertTexte: "Avis." }),
    );
    expect(r.correction).toBeNull();
  });
  it("un avis qui porte un interdit est retiré (le rendu le masque déjà)", () => {
    const r = cribler(
      avec({ expertNom: "Axion-IA", expertTexte: "Notre organisme est certifié Qualiopi." }),
    );
    expect(r.correction?.type).toBe("retirer-avis");
    expect(r.correction?.apres).toEqual({
      expertQuoteName: null,
      expertQuoteTitle: null,
      expertQuoteText: null,
    });
  });
  it("un article sans avis n'a aucune correction, quels que soient ses autres constats", () => {
    const r = cribler(avec({ corpsHtml: "<p>Une hausse de 40 % des ventes.</p>" }));
    expect(r.constats.length).toBeGreaterThan(0);
    expect(r.correction).toBeNull();
  });
});

describe("constats listés", () => {
  it("chiffre sans source signalé, chiffre sourcé ignoré", () => {
    expect(chiffresSansSource("<p>Les ventes ont augmenté de 40 % en un an.</p>")).toHaveLength(1);
    expect(chiffresSansSource("<p>Selon l'INSEE, 40 % des PME utilisent l'IA.</p>")).toHaveLength(
      0,
    );
    expect(
      chiffresSansSource('<p>40 % des PME (<a href="https://exemple.fr/etude">étude</a>).</p>'),
    ).toHaveLength(0);
  });
  it("citation sans auteur signalée, citation attribuée ignorée", () => {
    const sans =
      "<p>« Nous avons complètement transformé notre façon de travailler grâce à ces outils. »</p>";
    const avecAuteur =
      "<p>Selon la CNIL : « Les données personnelles doivent être traitées de façon licite et loyale. »</p>";
    expect(citationsNonAttribuees(sans)).toHaveLength(1);
    expect(citationsNonAttribuees(avecAuteur)).toHaveLength(0);
    expect(citationsNonAttribuees("<blockquote>Un texte sans auteur.</blockquote>")).toHaveLength(
      1,
    );
  });
  it("définition et lien glossaire", () => {
    expect(definitionAbsente(base)).toBeNull();
    expect(
      definitionAbsente(
        avec({ directAnswer: null, corpsHtml: "<p>Bienvenue. Nous parlons de choses.</p>" }),
      ),
    ).not.toBeNull();
    expect(
      definitionAbsente(avec({ directAnswer: null, corpsHtml: "<p>Le <dfn>RAG</dfn> aide.</p>" })),
    ).toBeNull();
    expect(glossaireAbsent(base.corpsHtml)).toBeNull();
    expect(glossaireAbsent("<p>rien</p>")).not.toBeNull();
  });
  it("phrase interdite remontée avec son motif", () => {
    const r = cribler(avec({ corpsHtml: `${base.corpsHtml}<p>Formation certifiée Qualiopi.</p>` }));
    expect(r.constats.some((c) => c.code === "phrase-interdite" && c.motif === "qualiopi")).toBe(
      true,
    );
  });
});

describe("plan", () => {
  const rs = [
    cribler(avec({ id: "b", slug: "b", expertNom: "Manon", expertTexte: "Avis." })),
    cribler(avec({ id: "a", slug: "a", expertNom: "Williams", expertTexte: "Autre avis." })),
  ];
  it("empreinte stable, indépendante de l'ordre, sensible au contenu", () => {
    const p = propositions(rs);
    expect(p.map((x) => x.id)).toEqual(["a", "b"]);
    expect(empreintePlan(p)).toBe(empreintePlan([...p].reverse()));
    expect(empreintePlan(p)).not.toBe(empreintePlan(p.slice(1)));
  });
  it("restauration : remet les valeurs d'origine des champs écrits", () => {
    const [x] = propositions(rs);
    expect(champsARestaurer(x.avant, x.apres)).toEqual(x.avant);
  });
  it("le rapport nomme les exclus sans leur proposer de correction", () => {
    const ex = cribler(
      avec({ id: "z", slug: "roi-ia-cabinet-comptable-clichy", expertNom: "X", expertTexte: "T." }),
    );
    const md = rapport("dry-run", "sha", [ex], propositions([ex]));
    expect(md).toContain("roi-ia-cabinet-comptable-clichy (liste-43)");
    expect(md).toContain("à corriger : 0");
    expect(md).not.toContain("### roi-ia-cabinet-comptable-clichy");
  });
});

describe("garde : workflow et script", () => {
  const racine = process.cwd();
  const yml = fs.readFileSync(
    path.join(racine, ".github/workflows/crible-stock-articles.yml"),
    "utf8",
  );
  const script = fs.readFileSync(path.join(racine, "scripts/crible-stock-articles.ts"), "utf8");
  const modules = ["analyse.ts", "plan.ts", "exclusions.ts"]
    .map((f) => fs.readFileSync(path.join(racine, "src/server/crible-stock", f), "utf8"))
    .join("\n");

  it("workflow_dispatch seul, mode « copie » par défaut", () => {
    const on = yml.slice(yml.indexOf("\non:"), yml.indexOf("\npermissions:"));
    expect(on).toContain("workflow_dispatch:");
    for (const t of ["push:", "pull_request", "schedule:", "workflow_run", "repository_dispatch"])
      expect(on).not.toContain(t);
    expect(yml).toMatch(/mode:[\s\S]*?default: "copie"/);
  });
  it("apply exige plan_sha et une sauvegarde de moins de 24 h ; aucune entrée interpolée dans un shell", () => {
    expect(yml).toContain("apply exige plan_sha");
    expect(yml).toContain("24*3600*1000");
    const runs = yml
      .split("run: |")
      .slice(1)
      .map((x) => x.split(/\n\s+- (?:name|uses):/)[0])
      .join("\n");
    expect(runs).not.toMatch(/\$\{\{\s*inputs\./);
  });
  it("essai à blanc par défaut ; apply refusé sans empreinte identique", () => {
    expect(script).toContain('"dry-run"');
    expect(script).toContain("--apply exige --plan-sha");
    expect(script).toContain("Empreinte du plan différente");
  });
  it("sauvegarde avant écriture dans la même transaction ; aucune suppression, aucun SQL brut", () => {
    expect(script).toContain("contentGenAuditLog.create");
    expect(script).toContain("$transaction");
    expect(script).not.toMatch(/\.delete(Many)?\(/);
    expect(script).not.toMatch(/\$executeRaw|\$queryRaw/);
  });
  it("la seule écriture touche l'avis d'expert : jamais le corps, le statut ni l'indexation", () => {
    const maj = [...script.matchAll(/article\.update\(\{[^}]*\}/g)].map((m) => m[0]).join("\n");
    expect(maj).not.toMatch(/\b(body|status|indexationTier|slug|title)\b/);
    expect(script).not.toMatch(/articleTranslation\.(update|create|upsert)/);
    expect(modules).not.toMatch(/indexationTier|status:/);
  });
  it("aucune mention interdite du chantier dans les messages ni de numéro de PR dans le code", () => {
    expect(`${script}${modules}`).not.toMatch(/#\d{3,5}\b/);
  });
});
