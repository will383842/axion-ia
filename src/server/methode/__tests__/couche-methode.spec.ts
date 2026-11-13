import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { injecterMethodeDansPromptSysteme } from "@/server/content-gen/methode-commerciale";

import {
  AVERTISSEMENT_CHIFFRES,
  COLLECTION_SANTE,
  COLLECTION_VENTE,
  contientChiffresExercice,
  decouperFichier,
  estFichierImportable,
  SLUG_NOYAU,
  type FicheMethode,
} from "../decoupage";
import { executerImport, type DepotMethode } from "../import";
import {
  CONTEXTE_NEUTRE,
  estMethodeActive,
  obtenirContexteMethode,
  type LecteurMethode,
  type LigneMethode,
} from "../index";

/** Extrait PDF minimal, à la forme des fiches du Drive (en-tête répété, tableau numéroté). */
const FICHE_00 = [
  "# 00-AXION-IA-Methode-de-vente",
  "",
  "Source : Google Drive « Livres savoir par cœur », extrait automatiquement.",
  "",
  "<!-- page 1 -->",
  "",
  "1 / 3",
  "AXION IA · Plus de performance, moins de charges",
  "La méthode de vente AXION IA",
  "1. Dire non doit coûter plus cher que dire oui",
  "Le client ne doit jamais voir ton offre comme une charge en plus.",
  "Ce que coûte AXION IA : 290 € par mois (exemple)",
  "L'ESSENTIEL EN 30 SECONDES",
  "Toujours trois chiffres : ce que le client perd, ce que coûte AXION IA, ce qu'il garde.",
  "Conclure le jour même : récap chiffré, 3 options, silence, acompte de 30 %.",
  "LE CHEMIN",
  "Diagnostic gratuit de 45 min en visio.",
  "Les idées clés",
  "<!-- page 2 -->",
  "2 / 3",
  "AXION IA · Plus de performance, moins de charges",
  "2. Le parcours en étapes",
  "Chaque étape s'appuie sur un livre, sans en sauter aucune.",
  "1. Se positionner",
  "Un seul interlocuteur de A à Z.",
  "2. Comprendre les douleurs",
  "Tâches, douleurs et gains de chaque métier.",
  "3. Construire l'offre",
  "Une offre construite à partir des obstacles du client.",
  "<!-- page 3 -->",
  "3 / 3",
  "AXION IA · Plus de performance, moins de charges",
  "3. Les objections et la bonne réponse",
  "« C'est trop cher » : reposer la perte chiffrée à côté du prix, puis silence.",
  "MISE EN SITUATION",
  "Le gérant dit « je dois en parler à mon associé ».",
  "Tu repars avec un rendez-vous daté avec le décideur, jamais les mains vides.",
].join("\n");

const DOSSIER_SANTE = [
  "# AXION IA — LA SANTÉ PRIVÉE EN FRANCE",
  "",
  "# 1. VERSION SIMPLE — À LIRE EN PREMIER",
  "Imaginez trois prestations dans un cabinet dentaire, du vert au rouge.",
  "1. Une liste interne qui ne doit pas ouvrir de section.",
  "# 2. LE DICTIONNAIRE SANS JARGON",
  "HDS, RGPD, dispositif médical : les mots expliqués simplement.",
].join("\n");

const CHEMIN_00 = "livres/00-AXION-IA-Methode-de-vente.md";
const CHEMIN_SANTE = "secteurs/sante/Dossier_Axion_IA_Sante_Privee_2026_CODE_SOURCE.md";

describe("découpage et slugs stables", () => {
  const fiches = decouperFichier(CHEMIN_00, FICHE_00);
  const slugs = fiches.map((f) => f.slug);

  it("produit le noyau à son slug canonique, et des slugs methode/<fichier>/<section>", () => {
    expect(slugs).toContain(SLUG_NOYAU);
    for (const s of slugs) expect(s).toMatch(/^methode\/[a-z0-9-]+\/[a-z0-9-]+$/);
    expect(slugs).toEqual([
      SLUG_NOYAU,
      "methode/00-axion-ia-methode-de-vente/1-dire-non-doit-couter-plus-cher-que-dire-oui",
      "methode/00-axion-ia-methode-de-vente/2-le-parcours-en-etapes",
      "methode/00-axion-ia-methode-de-vente/3-les-objections-et-la-bonne-reponse",
      "methode/00-axion-ia-methode-de-vente/mise-en-situation-1",
    ]);
  });

  it("est idempotent : deux découpages du même texte rendent les mêmes fiches", () => {
    expect(decouperFichier(CHEMIN_00, FICHE_00)).toEqual(fiches);
  });

  it("une liste numérotée imbriquée (1. 2. 3. dans la section 2) n'ouvre pas de section", () => {
    const s2 = fiches.find((f) => f.section.startsWith("2-"));
    expect(s2?.corps).toContain("1. Se positionner");
    expect(s2?.corps).toContain("3. Construire l'offre");
    expect(fiches.find((f) => f.section.startsWith("3-"))?.titre).toContain("objections");
  });

  it("retire les marqueurs de page et l'en-tête répété", () => {
    for (const f of fiches) {
      expect(f.corps).not.toMatch(/<!-- page/);
      expect(f.corps).not.toContain("AXION IA · Plus de performance, moins de charges");
    }
  });

  it("le noyau contient « L'essentiel » et « Le chemin », et n'est plus dans la section 1", () => {
    const noyau = fiches.find((f) => f.slug === SLUG_NOYAU);
    expect(noyau?.corps).toContain("L'ESSENTIEL EN 30 SECONDES");
    expect(noyau?.corps).toContain("LE CHEMIN");
    expect(noyau?.kbType).toBe("doctrine");
    const s1 = fiches.find((f) => f.section.startsWith("1-"));
    expect(s1?.corps).not.toContain("L'ESSENTIEL EN 30 SECONDES");
  });

  it("étiquette livre, type et collection", () => {
    for (const f of fiches) {
      expect(f.collection).toBe(COLLECTION_VENTE);
      expect(f.etiquettes).toContain("methode");
      expect(f.etiquettes).toContain("livre:axion-ia");
      expect(f.etiquettes.filter((e) => e.startsWith("type:"))).toHaveLength(1);
    }
    expect(fiches.find((f) => f.section.startsWith("3-"))?.typeFiche).toBe("objection");
  });

  it("le dossier santé va dans sa collection, étiqueté secteur:sante, titres « # n. » seulement", () => {
    const sante = decouperFichier(CHEMIN_SANTE, DOSSIER_SANTE);
    expect(sante.map((f) => f.section)).toEqual([
      "1-version-simple-a-lire-en-premier",
      "2-le-dictionnaire-sans-jargon",
    ]);
    for (const f of sante) {
      expect(f.collection).toBe(COLLECTION_SANTE);
      expect(f.etiquettes).toContain("secteur:sante");
    }
  });

  it("n'importe ni LISEZ-MOI, ni l'évaluation, ni les livres purs, ni l'extrait PDF santé", () => {
    expect(estFichierImportable("livres/LISEZ-MOI.md")).toBe(false);
    expect(estFichierImportable("EVALUATION-FICHES-2026-11-11.md")).toBe(false);
    expect(estFichierImportable("livres-purs/01-dunford-obviously-awesome.md")).toBe(false);
    expect(estFichierImportable("secteurs/sante/Dossier-extrait-pdf.md")).toBe(false);
    expect(estFichierImportable(CHEMIN_00)).toBe(true);
    expect(estFichierImportable(CHEMIN_SANTE)).toBe(true);
  });
});

describe("chiffres-exercice : les montants sont des EXEMPLES, jamais des prix", () => {
  const fiches = decouperFichier(CHEMIN_00, FICHE_00);

  it("détecte euros, acompte, abonnement et suivi à 30 jours", () => {
    expect(contientChiffresExercice("290 € par mois")).toBe(true);
    expect(contientChiffresExercice("1 900 EUR d'installation")).toBe(true);
    expect(contientChiffresExercice("un acompte de 30 %")).toBe(true);
    expect(contientChiffresExercice("passer à l'abonnement")).toBe(true);
    expect(contientChiffresExercice("je reviens pour le suivi à 30 jours")).toBe(true);
    expect(contientChiffresExercice("Une seule offre, un seul message.")).toBe(false);
  });

  it("toute section chiffrée porte l'étiquette ET l'avertissement en tête", () => {
    const s1 = fiches.find((f) => f.section.startsWith("1-"));
    const noyau = fiches.find((f) => f.slug === SLUG_NOYAU);
    for (const f of [s1, noyau]) {
      expect(f?.chiffresExercice).toBe(true);
      expect(f?.etiquettes).toContain("chiffres-exercice");
      expect(f?.corps.startsWith(AVERTISSEMENT_CHIFFRES)).toBe(true);
    }
    const s3 = fiches.find((f) => f.section.startsWith("3-"));
    expect(s3?.chiffresExercice).toBe(false);
    expect(s3?.etiquettes).not.toContain("chiffres-exercice");
  });

  it("l'avertissement ne cite aucun prix autre que la Journée IA à 1 490 € HT", () => {
    const montants = [...AVERTISSEMENT_CHIFFRES.matchAll(/(\d[\d\s]*)\s*€/g)].map((m) =>
      (m[1] ?? "").replace(/\s/g, ""),
    );
    expect(montants).toEqual(["1490"]);
  });
});

function depotEspion(): DepotMethode & { appels: string[] } {
  const appels: string[] = [];
  const entrees = new Map<string, { id: string; status: string; sourceFactoryId: string | null }>();
  let n = 0;
  return {
    appels,
    trouverEntree: vi.fn((slug: string) => {
      appels.push(`trouver:${slug}`);
      return Promise.resolve(entrees.get(slug) ?? null);
    }),
    creerEntree: vi.fn((f: FicheMethode) => {
      appels.push(`creer:${f.slug}`);
      n += 1;
      const id = `id-${String(n)}`;
      entrees.set(f.slug, { id, status: "approved", sourceFactoryId: "methode-import" });
      return Promise.resolve(id);
    }),
    mettreAJourEntree: vi.fn((id: string) => {
      appels.push(`maj:${id}`);
      return Promise.resolve();
    }),
    assurerCollection: vi.fn((slug: string) => {
      appels.push(`collection:${slug}`);
      return Promise.resolve(`c-${slug}`);
    }),
    rattacherACollection: vi.fn(() => Promise.resolve()),
    assurerEtiquette: vi.fn((slug: string) => Promise.resolve(`t-${slug}`)),
    etiqueter: vi.fn(() => Promise.resolve()),
  };
}

describe("import : essai à blanc, idempotence, aucune suppression", () => {
  const fiches = decouperFichier(CHEMIN_00, FICHE_00);

  it("l'essai à blanc n'appelle AUCUNE méthode du dépôt", async () => {
    const depot = depotEspion();
    const res = await executerImport(fiches, { ecrire: false, depot });
    expect(res.ecrit).toBe(false);
    expect(res.plan).toHaveLength(fiches.length);
    expect(depot.appels).toEqual([]);
    expect(depot.creerEntree).not.toHaveBeenCalled();
    expect(depot.etiqueter).not.toHaveBeenCalled();
  });

  it("deux écritures successives : création puis mise à jour, jamais de doublon", async () => {
    const depot = depotEspion();
    const premier = await executerImport(fiches, { ecrire: true, depot });
    expect(premier.plan.every((l) => l.action === "creer")).toBe(true);
    const second = await executerImport(fiches, { ecrire: true, depot });
    expect(second.plan.every((l) => l.action === "mettre-a-jour")).toBe(true);
    expect(depot.creerEntree).toHaveBeenCalledTimes(fiches.length);
  });

  it("une entrée déjà publiée est laissée intacte", async () => {
    const depot = depotEspion();
    depot.trouverEntree = vi.fn(() =>
      Promise.resolve({ id: "x", status: "published", sourceFactoryId: "methode-import" }),
    );
    const res = await executerImport(fiches, { ecrire: true, depot });
    expect(res.plan.every((l) => l.action === "ignorer-publiee")).toBe(true);
    expect(depot.mettreAJourEntree).not.toHaveBeenCalled();
  });

  it("une entrée de même slug venue d'une autre source n'est jamais touchée", async () => {
    const depot = depotEspion();
    depot.trouverEntree = vi.fn(() =>
      Promise.resolve({ id: "y", status: "approved", sourceFactoryId: null }),
    );
    const res = await executerImport(fiches, { ecrire: true, depot });
    expect(res.plan.every((l) => l.action === "ignorer-autre-source")).toBe(true);
    expect(depot.mettreAJourEntree).not.toHaveBeenCalled();
    expect(depot.rattacherACollection).not.toHaveBeenCalled();
    expect(depot.etiqueter).not.toHaveBeenCalled();
  });

  it("le dépôt n'a aucune méthode de suppression", () => {
    const cles = Object.keys(depotEspion()).filter((k) => k !== "appels");
    for (const k of cles) expect(k).not.toMatch(/suppr|delete|retir|effac/i);
  });

  it("refuse un lot qui porte deux fois le même slug", async () => {
    const [premiere] = fiches;
    if (!premiere) throw new Error("fixture vide");
    await expect(
      executerImport([premiere, premiere], { ecrire: false, depot: depotEspion() }),
    ).rejects.toThrow(/double/);
  });
});

const NOYAU: LigneMethode = {
  slug: SLUG_NOYAU,
  titre: "Méthode de vente — L'essentiel",
  texte: "Conclure le jour même : acompte de 30 %.",
  collection: COLLECTION_VENTE,
  etiquettes: ["methode", "chiffres-exercice"],
};
const VENTE: LigneMethode = {
  slug: "methode/09-voss/8-le-prix",
  titre: "Le prix",
  texte: "Ce que coûte AXION IA : 290 € par mois.",
  collection: COLLECTION_VENTE,
  // Étiquette perdue en base : l'avertissement doit quand même être posé.
  etiquettes: ["methode"],
};
const SANTE: LigneMethode = {
  slug: "methode/dossier-sante/1-version-simple",
  titre: "Santé — version simple",
  texte: "Feu tricolore : vert, orange, rouge.",
  collection: COLLECTION_SANTE,
  etiquettes: ["methode", "secteur:sante"],
};

function lecteurEspion(lignes: LigneMethode[]): LecteurMethode & {
  collectionsDemandees: (readonly string[])[];
} {
  const collectionsDemandees: (readonly string[])[] = [];
  return {
    collectionsDemandees,
    lireNoyau: vi.fn(() => Promise.resolve(NOYAU)),
    rechercher: vi.fn((_s: string, collections: readonly string[]) => {
      collectionsDemandees.push(collections);
      return Promise.resolve(lignes);
    }),
  };
}

const ALLUME = { METHODE_ACTIVE: "true" };

describe("interrupteur METHODE_ACTIVE", () => {
  it("n'est allumé que par la valeur exacte « true »", () => {
    expect(estMethodeActive({})).toBe(false);
    expect(estMethodeActive({ METHODE_ACTIVE: "false" })).toBe(false);
    expect(estMethodeActive({ METHODE_ACTIVE: "TRUE" })).toBe(false);
    expect(estMethodeActive({ METHODE_ACTIVE: "1" })).toBe(false);
    expect(estMethodeActive(ALLUME)).toBe(true);
  });

  it("éteint : contexte neutre, et le lecteur n'est jamais appelé", async () => {
    const lecteur = lecteurEspion([VENTE]);
    const ctx = await obtenirContexteMethode({ sujet: "trop cher" }, { env: {}, lecteur });
    expect(ctx).toEqual({ noyau: null, extraits: [] });
    expect(ctx).toBe(CONTEXTE_NEUTRE);
    expect(lecteur.lireNoyau).not.toHaveBeenCalled();
    expect(lecteur.rechercher).not.toHaveBeenCalled();
  });

  it("éteint : le prompt système d'un mail est rendu à l'identique", async () => {
    const lecteur = lecteurEspion([VENTE]);
    const prompt = "Tu rédiges un mail de relance.";
    expect(await injecterMethodeDansPromptSysteme(prompt, "mail", {}, { env: {}, lecteur })).toBe(
      prompt,
    );
    expect(lecteur.lireNoyau).not.toHaveBeenCalled();
  });

  it("allumé : une page publique (nature non commerciale) n'est jamais augmentée", async () => {
    const lecteur = lecteurEspion([VENTE]);
    const prompt = "Tu rédiges un article de blog.";
    expect(
      await injecterMethodeDansPromptSysteme(prompt, "blog_article", {}, { env: ALLUME, lecteur }),
    ).toBe(prompt);
    expect(lecteur.lireNoyau).not.toHaveBeenCalled();
  });

  it("allumé : un mail reçoit le noyau, avec l'avertissement sur les montants", async () => {
    const lecteur = lecteurEspion([]);
    const sortie = await injecterMethodeDansPromptSysteme(
      "Tu rédiges un mail.",
      "mail",
      {},
      { env: ALLUME, lecteur },
    );
    expect(sortie).toContain("Conclure le jour même");
    expect(sortie).toContain(AVERTISSEMENT_CHIFFRES);
  });
});

describe("obtenirContexteMethode : noyau, extraits, secteur santé à part", () => {
  it("rend le noyau et les extraits, avertissement en tête de chaque extrait chiffré", async () => {
    const ctx = await obtenirContexteMethode(
      { sujet: "prix" },
      { env: ALLUME, lecteur: lecteurEspion([VENTE]) },
    );
    expect(ctx.noyau?.slug).toBe(SLUG_NOYAU);
    expect(ctx.noyau?.texte.startsWith(AVERTISSEMENT_CHIFFRES)).toBe(true);
    expect(ctx.extraits).toHaveLength(1);
    expect(ctx.extraits[0]?.chiffresExercice).toBe(true);
    expect(ctx.extraits[0]?.texte.startsWith(AVERTISSEMENT_CHIFFRES)).toBe(true);
  });

  it("sans secteur : la collection santé n'est pas demandée, et n'est pas rendue même si le lecteur la renvoie", async () => {
    const lecteur = lecteurEspion([VENTE, SANTE]);
    const ctx = await obtenirContexteMethode({ sujet: "cabinet" }, { env: ALLUME, lecteur });
    expect(lecteur.collectionsDemandees).toEqual([[COLLECTION_VENTE]]);
    expect(ctx.extraits.map((e) => e.slug)).toEqual([VENTE.slug]);
    expect(ctx.extraits.some((e) => e.etiquettes.includes("secteur:sante"))).toBe(false);
  });

  it("un autre secteur n'ouvre pas la santé", async () => {
    const lecteur = lecteurEspion([SANTE]);
    const ctx = await obtenirContexteMethode(
      { sujet: "cabinet", secteur: "btp" },
      { env: ALLUME, lecteur },
    );
    expect(ctx.extraits).toEqual([]);
  });

  it("secteur = 'sante' : la collection santé est demandée et rendue", async () => {
    const lecteur = lecteurEspion([VENTE, SANTE]);
    const ctx = await obtenirContexteMethode(
      { sujet: "cabinet", secteur: "sante" },
      { env: ALLUME, lecteur },
    );
    expect(lecteur.collectionsDemandees).toEqual([[COLLECTION_VENTE, COLLECTION_SANTE]]);
    expect(ctx.extraits.map((e) => e.slug)).toEqual([VENTE.slug, SANTE.slug]);
  });

  it("borne max au plafond et ne cherche pas sans sujet", async () => {
    const lecteur = lecteurEspion([VENTE]);
    await obtenirContexteMethode({ sujet: "   " }, { env: ALLUME, lecteur });
    expect(lecteur.rechercher).not.toHaveBeenCalled();
    await obtenirContexteMethode({ sujet: "prix", max: 99 }, { env: ALLUME, lecteur });
    expect(lecteur.rechercher).toHaveBeenCalledWith("prix", [COLLECTION_VENTE], 10);
  });
});

/** Fiche PROPRE (axion-brand `methode/propre/`) : en-tête YAML + marqueurs d'id. */
const FICHE_00_PROPRE = [
  "---",
  "slug: methode/00-axion-ia-methode-de-vente",
  "titre: La méthode de vente AXION IA",
  "---",
  "",
  "# La méthode de vente AXION IA",
  "",
  "## 1. Dire non doit coûter plus cher que dire oui",
  "<!-- id: dire-non-coute-plus-cher ; type: regle ; livres: Cialdini ; chiffres-exercice: oui -->",
  "",
  "Le client ne doit jamais voir ton offre comme une charge en plus : 290 € par mois (exemple).",
  "",
  "> **L'ESSENTIEL EN 30 SECONDES**",
  ">",
  "> - Toujours trois chiffres : ce que le client perd, ce que coûte AXION IA, ce qu'il garde.",
  "",
  "**LE CHEMIN**",
  "",
  "1. Diagnostic gratuit de 45 min en visio.",
  "",
  "(Les idées clés)",
  "",
  "## 2. Les objections et la bonne réponse",
  "<!-- id: 00-axion-ia-methode-de-vente--objections ; type: objection ; chiffres-exercice: non -->",
  "",
  "« C'est trop cher » : reposer la perte chiffrée à côté du prix, puis le silence.",
].join("\n");

const SANTE_PROPRE_SANS_ID = [
  "---",
  "slug: methode/dossier-axion-ia-sante-privee-2026-code-source/03-le-dictionnaire-sans-jargon",
  "secteur: sante",
  "---",
  "# 3. LE DICTIONNAIRE SANS JARGON",
  "HDS, RGPD, dispositif médical : les mots expliqués simplement, sans jargon.",
].join("\n");

describe("fiches propres (axion-brand methode/propre)", () => {
  const fiches = decouperFichier("livres/00-AXION-IA-Methode-de-vente.md", FICHE_00_PROPRE);
  const slugs = fiches.map((f) => f.slug);

  it("l'id écrit par l'auteur fait la section du slug, tel quel (« -- » compris)", () => {
    expect(slugs).toEqual([
      SLUG_NOYAU,
      "methode/00-axion-ia-methode-de-vente/dire-non-coute-plus-cher",
      "methode/00-axion-ia-methode-de-vente/00-axion-ia-methode-de-vente--objections",
    ]);
  });

  it("le noyau (citation « L'essentiel » + « Le chemin ») est extrait et retiré de la section 1", () => {
    const noyau = fiches.find((f) => f.slug === SLUG_NOYAU);
    expect(noyau?.corps).toContain("L'ESSENTIEL EN 30 SECONDES");
    expect(noyau?.corps).toContain("LE CHEMIN");
    expect(noyau?.corps).not.toContain("> -");
    const s1 = fiches.find((f) => f.slug.endsWith("/dire-non-coute-plus-cher"));
    expect(s1?.corps).not.toContain("LE CHEMIN");
    expect(s1?.corps).not.toContain("<!--");
  });

  it("le marqueur chiffres-exercice et le type de l'auteur sont respectés", () => {
    const s1 = fiches.find((f) => f.slug.endsWith("/dire-non-coute-plus-cher"));
    expect(s1?.etiquettes).toContain("chiffres-exercice");
    expect(s1?.corps.startsWith(AVERTISSEMENT_CHIFFRES)).toBe(true);
    const s2 = fiches.find((f) => f.slug.endsWith("--objections"));
    expect(s2?.etiquettes).toContain("type:objection");
    expect(s2?.chiffresExercice).toBe(false);
  });

  it("un fichier santé sans marqueur fait UNE fiche, dans la collection santé", () => {
    const [seule, ...rien] = decouperFichier(
      "secteurs/sante/03-le-dictionnaire-sans-jargon.md",
      SANTE_PROPRE_SANS_ID,
    );
    expect(rien).toEqual([]);
    expect(seule?.slug).toBe("methode/03-le-dictionnaire-sans-jargon/fiche");
    expect(seule?.collection).toBe(COLLECTION_SANTE);
    expect(seule?.etiquettes).toContain("secteur:sante");
  });

  it("n'importe ni l'INDEX ni les rapports de contrôle", () => {
    expect(estFichierImportable("INDEX.md")).toBe(false);
    expect(estFichierImportable("_controles/GLOBAL.md")).toBe(false);
    expect(estFichierImportable("_controles/P01.md")).toBe(false);
    expect(estFichierImportable("livres/09-voss-never-split-the-difference.md")).toBe(true);
  });
});

describe("cloisonnement : la Méthode ne sort jamais vers le public", () => {
  const racine = join(__dirname, "..", "..", "..", "..");
  const lister = (dossier: string): string[] =>
    readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
      const p = join(dossier, e.name);
      if (e.isDirectory()) return e.name === "node_modules" ? [] : lister(p);
      return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
    });

  it("aucun fichier du chatbot ni des pages/routes publiques n'importe @/server/methode", () => {
    const fautifs = [
      ...lister(join(racine, "src", "server", "chatbot")),
      ...lister(join(racine, "src", "app")).filter((f) => !/[\\/]api[\\/]mcp[\\/]/.test(f)),
    ].filter((f) => /from\s+["']@\/server\/methode/.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("la recherche du chatbot n'interroge que des fiches publiées, publiques", () => {
    const sql = readFileSync(
      join(racine, "src", "server", "chatbot", "retrieval", "knowledge-entry-search.ts"),
      "utf8",
    );
    expect(sql).toContain(`ke.status = 'published'::"KbStatus"`);
    expect(sql).toContain(`ke.audience = 'public'::"KbAudience"`);
  });
});
