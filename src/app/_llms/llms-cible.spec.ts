// @vitest-environment node
/**
 * Refonte de `llms.txt` et `llms-full.txt` (audit du 20/11/2026, plan § 4.1).
 *
 * Ce fichier verrouille ce que les gardes existantes ne regardaient pas : la présentation
 * officielle en tête, l'ordre des sections, le format de la norme (`- [titre](url): texte`),
 * l'absence de doublon, les mots interdits, l'absence de consigne adressée aux IA, et le fait
 * que chaque lien mène à une page qui existe. Les deux routes sont appelées pour de vrai :
 * seules les deux lectures de base (vidéos, avis) sont simulées.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/seo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/seo")>();
  return { ...actual, SITE_URL: "https://axion-ia.com" };
});

const h = vi.hoisted(() => ({ videos: [] as unknown[] }));
vi.mock("@/server/videos/lecture", () => ({ videosPubliees: async () => h.videos }));
vi.mock("@/server/reviews/presence", () => ({ avisPublies: async () => false }));

import { GET as getLlms } from "../llms.txt/route";
import { GET as getLlmsFull } from "../llms-full.txt/route";
import {
  CONDITION_GARANTIE,
  DEDUCTION_JOURNEE_IA,
  DESCRIPTION_ENTITE_FR,
  DESCRIPTION_SERVICE_JOURNEE_IA,
  GARANTIE_PHRASE,
  RAPPORT_COMPLET,
  remplacerJetons,
} from "@/content/journee-ia-commun";
import { JOURNEE_IA_TIER, formatTierPrice } from "@/content/pricing";
import { QUESTIONS_REFERENCE } from "@/content/questions-reference";
import { GLOSSAIRE_DATE_MISE_A_JOUR } from "@/content/glossaire-reference";
import { FAQ_GLOBAL } from "@/content/transversal";
import { CONTENU as ACCUEIL } from "@/app/[locale]/_accueil/contenu";
import {
  DATE_MISE_A_JOUR_LLMS,
  SLOGAN_LLMS,
  auFormatNorme,
  propreLlms,
} from "@/app/_llms/faits-communs";
import { deuxPremieresPhrases, phrasesDe } from "@/app/_llms/reference";
import { routing } from "@/i18n/routing";

import { uneVideo } from "@/app/[locale]/videos/__tests__/fixture";

const SITE = "https://axion-ia.com";
const lireLlms = async () => (await getLlms()).text();
const lireFull = async () => (await getLlmsFull()).text();

beforeEach(() => {
  h.videos = [];
});

/** La ligne du Tour France IA reste celle de `main` (décision en attente) : hors contrôle. */
const sansTour = (t: string) =>
  t
    .split("\n")
    .filter((l) => !l.startsWith("- [Tour France IA]"))
    .join("\n");

const titresH2 = (t: string) =>
  t
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l) => l.slice(3));

/** Le contenu d'une section H2 (sans son titre), jusqu'à la section suivante. */
function section(t: string, titre: string): string {
  const apres = t.split(`\n## ${titre}\n`)[1];
  expect(apres, `section « ${titre} » introuvable`).toBeDefined();
  return (apres ?? "").split("\n## ")[0] ?? "";
}

/** L'en-tête : tout ce qui précède la première section H2. */
const entete = (t: string) => t.split("\n## ")[0] ?? "";

/** Découpe en phrases (fin de phrase suivie d'une majuscule ou d'un guillemet ouvrant). */
const phrases = (t: string) =>
  t
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý«])/)
    .map((p) => p.trim())
    .filter(Boolean);

const SECTIONS_LLMS = [
  "Par où commencer",
  "La Journée IA, offre phare",
  "Formation, mise en place, intégration (sur devis)",
  "Questions de dirigeants : réponses courtes",
  "Ressources de référence",
  "Qui sommes-nous, contact",
  "Optional",
] as const;

const LIEN_NORME = /^- \[[^\]]+\]\(https:\/\/axion-ia\.com[^)\s]*\): \S/;

describe("1. Structure : présentation officielle en tête, sections dans l'ordre", () => {
  it("titre, citation = présentation officielle, slogan exact de l'accueil", async () => {
    const lignes = (await lireLlms()).split("\n");
    expect(lignes[0]).toBe("# Axion-IA");
    expect(lignes[1]).toBe("");
    expect(lignes[2]).toBe(`> ${DESCRIPTION_ENTITE_FR}`);
    expect(lignes[4]).toBe(
      "On vous parle d’IA partout. Vous ne savez plus par où commencer. Nous, si.",
    );
  });

  it("la présentation officielle est celle décidée le 20/11/2026", () => {
    expect(DESCRIPTION_ENTITE_FR).toMatch(
      /^Axion-IA est une entreprise française qui aide les TPE et PME à passer à l’IA en sachant où elle leur rapporte, plutôt que d’acheter des outils au hasard\./,
    );
    expect(DESCRIPTION_ENTITE_FR).toContain("Partout en France, outre-mer compris,");
    expect(DESCRIPTION_ENTITE_FR).toContain(
      "Chaque prestation peut être prise seule ou s’inscrire dans un plan d’ensemble.",
    );
    expect(DESCRIPTION_ENTITE_FR).toContain(
      "qui s’inscrit dans l’article 4 du règlement européen sur l’IA, avec une attestation par participant.",
    );
  });

  it("llms.txt : sept sections, dans cet ordre, « Optional » en dernier", async () => {
    expect(titresH2(await lireLlms())).toEqual([...SECTIONS_LLMS]);
  });

  it("llms.txt : avec une vidéo publiée, « Vidéos » se glisse juste avant « Optional »", async () => {
    h.videos = [uneVideo({})];
    const titres = titresH2(await lireLlms());
    expect(titres).toEqual([...SECTIONS_LLMS.slice(0, -1), "Vidéos", "Optional"]);
  });

  it("llms-full.txt : titre en français, mêmes premières sections, aucune réponse en anglais", async () => {
    const corps = await lireFull();
    expect(corps.split("\n")[0]).toBe("# Axion-IA");
    expect(titresH2(corps).slice(0, 3)).toEqual(SECTIONS_LLMS.slice(0, 3));
    expect(titresH2(corps)).toEqual([...new Set(titresH2(corps))]);
    expect(corps).not.toMatch(/^\(EN\)/m);
    expect(corps).not.toMatch(/full content for AI crawlers/);
  });

  it("les deux fichiers partagent le même en-tête, au caractère près", async () => {
    const [court, complet] = await Promise.all([lireLlms(), lireFull()]);
    expect(entete(court).length).toBeGreaterThan(900);
    expect(entete(complet)).toBe(entete(court));
  });
});

describe("2. Format de la norme llms.txt", () => {
  it("dans chaque section, toute ligne est un lien « - [titre](url): texte »", async () => {
    for (const videos of [[], [uneVideo({})]]) {
      h.videos = videos;
      const corps = sansTour(await lireLlms());
      const lignes = corps
        .slice(entete(corps).length)
        .split("\n")
        .filter((l) => l.trim() !== "" && !l.startsWith("## "));
      expect(lignes.length).toBeGreaterThan(30);
      for (const l of lignes) expect(l, l).toMatch(LIEN_NORME);
    }
  });

  it("l'en-tête ne porte que la citation, le slogan et la liste des faits clés", async () => {
    const lignes = entete(await lireLlms())
      .split("\n")
      .filter((l) => l.trim() !== "");
    expect(lignes.filter((l) => l.startsWith("> "))).toHaveLength(1);
    expect(lignes.some((l) => /^Faits clés \(mis à jour le \d{2}\/\d{2}\/\d{4}\) :$/.test(l))).toBe(
      true,
    );
    expect(lignes.filter((l) => l.startsWith("- ")).length).toBeGreaterThanOrEqual(8);
  });

  it("aucune adresse modèle hors des lignes « Version texte »", async () => {
    const corps = await lireLlms();
    for (const l of corps.split("\n")) {
      if (/\{[a-z]+\}|<slug/.test(l)) expect(l, l).toMatch(/Version texte/);
    }
    expect(corps).not.toMatch(/\{ville\}|\{region\}|\{secteur\}/);
  });

  it("taille : un index, pas un dossier", async () => {
    const corps = await lireLlms();
    expect(corps.length).toBeGreaterThan(6000);
    expect(corps.length).toBeLessThan(14000);
  });

  it("les deux fichiers sont servis en texte, hors des résultats de recherche", async () => {
    for (const get of [getLlms, getLlmsFull]) {
      const res = await get();
      expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
      expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    }
  });
});

describe("3. Aucun doublon", () => {
  it("hors questions, chaque adresse n'est la cible principale que d'une seule ligne", async () => {
    const corps = await lireLlms();
    const hors = corps.replace(section(corps, SECTIONS_LLMS[3]), "");
    const cibles = [...hors.matchAll(/^- \[[^\]]+\]\(([^)\s]+)\)/gm)].map((m) => m[1]);
    expect(cibles.length).toBeGreaterThan(20);
    expect(cibles).toEqual([...new Set(cibles)]);
  });

  it("aucune question posée deux fois, aucune phrase écrite deux fois", async () => {
    const corps = await lireLlms();
    const questions = [...section(corps, SECTIONS_LLMS[3]).matchAll(/^- \[([^\]]+)\]/gm)].map(
      (m) => m[1],
    );
    expect(questions).toEqual([...new Set(questions)]);
    const longues = phrases(
      corps
        .split("\n")
        .map((l) => l.replace(/^- \[[^\]]+\]\([^)]+\): /, "").replace(/^[->] /, ""))
        .join("\n"),
    ).filter((p) => p.length >= 50);
    expect(longues.length).toBeGreaterThan(30);
    const vues = new Set<string>();
    for (const p of longues) {
      expect(vues.has(p), `phrase en double : ${p}`).toBe(false);
      vues.add(p);
    }
  });

  it("la Journée IA n'est décrite qu'une fois dans llms.txt", async () => {
    const corps = await lireLlms();
    const description = remplacerJetons(DESCRIPTION_SERVICE_JOURNEE_IA);
    expect(corps.split(description)).toHaveLength(2);
    expect(corps.split(GARANTIE_PHRASE)).toHaveLength(2);
  });
});

describe("4. Les faits attendus sont là, lus dans les constantes", () => {
  it("llms.txt : premier pas, prix, garantie, déduction, zone, tailles, contact", async () => {
    const corps = await lireLlms();
    const prix = formatTierPrice(JOURNEE_IA_TIER, "fr");
    for (const attendu of [
      "Diagnostic IA",
      `${SITE}/fr/appel`,
      "gratuit, 45 minutes, en visio ou par téléphone, sans engagement",
      prix,
      remplacerJetons(DESCRIPTION_SERVICE_JOURNEE_IA),
      GARANTIE_PHRASE,
      CONDITION_GARANTIE,
      remplacerJetons(DEDUCTION_JOURNEE_IA),
      "axionai.fr",
      "contact@axion-ia.com",
      "partout en France, outre-mer compris",
      "de 2 à 250 salariés",
      "jusqu’à 15 personnes",
      "Williams Jullin",
    ]) {
      expect(corps, attendu).toContain(attendu);
    }
    expect(corps).not.toContain("{{");
  });

  it("llms.txt dit les deux portes : la Journée IA est l'offre phare, pas un passage obligé", async () => {
    const debut = section(await lireLlms(), SECTIONS_LLMS[0]);
    expect(debut).toMatch(/^- \[Diagnostic IA\]\(https:\/\/axion-ia\.com\/fr\/appel\): /m);
    expect(debut).toContain("savent déjà où elles perdent du temps");
    expect(debut).toMatch(/pas un passage obligé/);
  });

  it("llms-full.txt garde le détail : rapport, garantie, déduction", async () => {
    const corps = await lireFull();
    for (const attendu of [
      remplacerJetons(DESCRIPTION_SERVICE_JOURNEE_IA),
      RAPPORT_COMPLET,
      GARANTIE_PHRASE,
      CONDITION_GARANTIE,
      remplacerJetons(DEDUCTION_JOURNEE_IA),
    ]) {
      expect(corps, attendu).toContain(attendu);
    }
    expect(corps).not.toContain("{{");
  });
});

describe("5. Questions de dirigeants : la question, deux phrases, le lien", () => {
  it("chaque réponse reprend mot pour mot deux phrases d'une réponse de référence", async () => {
    const lignes = section(await lireLlms(), SECTIONS_LLMS[3])
      .split("\n")
      .filter((l) => l.startsWith("- ["));
    expect(lignes.length).toBeGreaterThanOrEqual(10);
    const parQuestion = new Map(Object.values(QUESTIONS_REFERENCE).map((q) => [q.question, q]));
    for (const l of lignes) {
      const m = /^- \[([^\]]+)\]\((https:\/\/axion-ia\.com\/fr[^)\s]*)\): (.+)$/.exec(l);
      expect(m, l).not.toBeNull();
      const [, question, , texte] = m as RegExpExecArray;
      const ref = parQuestion.get(question as string);
      expect(ref, `question hors référence : ${question}`).toBeDefined();
      const source = phrases(remplacerJetons(ref?.reponse ?? ""));
      const rendu = phrases(texte as string);
      expect(rendu, l).toHaveLength(2);
      for (const p of rendu) expect(source, p).toContain(p);
      expect(rendu[0], l).toBe(source[0]);
    }
  });
});

/**
 * Décisions du dirigeant du 20/11/2026 : mots et sujets qui ne paraissent dans aucun des deux
 * fichiers. Le motif est écrit ICI, indépendamment du code, pour qu'un filtre affaibli rougisse.
 */
const INTERDITS = new RegExp(
  [
    "Qualiopi",
    "OPCO",
    "\\bCPF\\b",
    "France Travail",
    "prise en charge",
    "financement",
    "financ[ée]",
    "Grenoble",
    "Aucun gain garanti",
    "Francfort",
    "Frankfurt",
    "Nuremberg",
    "maintenance",
    "(?:échange|appel) de cadrage",
    "6-8 semaines",
    "25-40 pages",
    "tier-1",
    "mission réelle",
    "grandes écoles",
    "brique par brique",
    "code source",
    "code custom",
    "métropolitaine",
    "sans remise",
    "frais de (?:déplacement|trajet)",
    "en sus",
    "acompte",
    "conforme à",
    "certifiant",
    "formation obligatoire",
    "\\bsuivi\\b",
    "\\bsupport\\b",
    "accompagnement",
    "cabinets? de conseil",
    "société de conseil",
    "témoignage",
    "cas clients?\\b",
    "machine-readable",
    "polling",
    "verbose",
  ].join("|"),
  "i",
);

describe("6. Mots et sujets interdits", () => {
  it.each([
    ["llms.txt", lireLlms],
    ["llms-full.txt", lireFull],
  ] as const)("%s : aucun, hors ligne du Tour France IA", async (_n, lire) => {
    const corps = sansTour(await lire());
    const trouve = INTERDITS.exec(corps);
    const autour = trouve ? corps.slice(Math.max(0, trouve.index - 80), trouve.index + 80) : "";
    expect(trouve?.[0] ?? null, autour).toBeNull();
  });

  it("le motif attrape ce qu'il doit attraper, et épargne les mots voisins", () => {
    for (const mot of [
      "contrat de maintenance",
      "Hetzner, Francfort",
      "pas brique par brique",
      "en code source dont l'entreprise reste propriétaire",
      "France métropolitaine",
      "un suivi mensuel",
      "frais de déplacement",
      "conforme à l'AI Act",
    ]) {
      expect(mot, mot).toMatch(INTERDITS);
    }
    for (const mot of ["suivies de 4 h de formation", "formation suivie", "un gain financier"]) {
      expect(mot, mot).not.toMatch(INTERDITS);
    }
  });

  it("AI Act : la formation « s'inscrit dans l'article 4 », rien de plus fort", async () => {
    for (const corps of [sansTour(await lireLlms()), sansTour(await lireFull())]) {
      expect(corps).toContain("s’inscrit dans l’article 4 du règlement européen sur l’IA");
      expect(corps).not.toMatch(/conforme|certifi|obligation de (?:se )?former/i);
    }
  });

  it("aucun paragraphe périmé : blog, carrières, méthodologie, implantations, exclusions", async () => {
    const corps = await lireLlms();
    for (const absent of [
      "/fr/blog",
      "/fr/carrieres",
      "/fr/methodologie",
      "/fr/implantations",
      "/fr/stack-ia",
      "## Excluded",
      "/admin",
      "NE PAS CONFONDRE",
      "⚠️",
    ]) {
      expect(corps, absent).not.toContain(absent);
    }
  });
});

describe("7. Aucune consigne adressée aux IA", () => {
  it.each([
    ["llms.txt", lireLlms],
    ["llms-full.txt", lireFull],
  ] as const)("%s", async (_n, lire) => {
    expect(await lire()).not.toMatch(
      /(?:recommande[rz]?|citez|cite[rz]?) (?:Axion|nous)|à citer|pour être cité|you must|ignore (?:all|previous)|en tant qu['’](?:IA|assistant)|ingestion/i,
    );
  });
});

describe("8. Chaque lien mène à une page qui existe", () => {
  const cles = Object.keys(routing.pathnames);
  const motifs = cles.map(
    (c) => new RegExp(`^${c.replace(/\[\.\.\.[^\]]+\]/g, ".+").replace(/\[[^\]]+\]/g, "[^/]+")}$`),
  );
  /** Une page existe si sa route est déclarée, ou si son dossier porte un `page.tsx`. */
  const routeFr = (chemin: string) =>
    chemin === "" ||
    motifs.some((m) => m.test(chemin)) ||
    existsSync(path.join(process.cwd(), "src/app/[locale]", chemin, "page.tsx"));

  /** Les adresses hors `/fr` que les fichiers ont le droit de citer : liste fermée. */
  const HORS_FR = [
    /^$/,
    /^\/llms-full\.txt$/,
    /^\/sitemap-index\.xml$/,
    /^\/sitemap-knowledge\.xml$/,
    /^\/sitemap-videos\.xml$/,
    /^\/sitemaps\/images-(?:fr|en)\.xml$/,
    /^\/tour-france-ia(?:\/conditions-generales)?$/,
    /^\/api\/markdown\/(?:glossaire|actualites)\/\{slug\}$/,
    /^\/api\/observatoire\/export-(?:csv|json)$/,
  ];

  it.each([
    ["llms.txt", lireLlms],
    ["llms-full.txt", lireFull],
  ] as const)("%s", async (_n, lire) => {
    const corps = await lire();
    const adresses = [...corps.matchAll(/https?:\/\/[^\s)<>]+/g)].map((m) =>
      m[0].replace(/[.,;:]+$/, ""),
    );
    expect(adresses.length).toBeGreaterThan(40);
    for (const a of new Set(adresses)) {
      if (/^https:\/\/www\.linkedin\.com\//.test(a)) continue;
      expect(a.startsWith(SITE), `adresse hors du site : ${a}`).toBe(true);
      const chemin = a.slice(SITE.length);
      if (chemin === "/fr" || chemin.startsWith("/fr/")) {
        expect(routeFr(chemin.slice(3)), `aucune route pour ${a}`).toBe(true);
      } else {
        expect(
          HORS_FR.some((m) => m.test(chemin)),
          `adresse inattendue : ${a}`,
        ).toBe(true);
      }
    }
  });

  it("le contrôle distingue une route d'une adresse inventée", () => {
    expect(routeFr("/journee-ia")).toBe(true);
    expect(routeFr("/equipe/williams")).toBe(true);
    expect(routeFr("/devenir-commercial-ia")).toBe(true);
    expect(routeFr("/passer-a-l-ia-pme")).toBe(false);
    expect(routeFr("/journee-ia/inexistante")).toBe(false);
  });
});

describe("9. Les outils de la refonte", () => {
  it("la date de mise à jour est une vraie date, ni future ni antérieure à celle du glossaire", () => {
    expect(DATE_MISE_A_JOUR_LLMS).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(DATE_MISE_A_JOUR_LLMS))).toBe(false);
    expect(Date.parse(DATE_MISE_A_JOUR_LLMS)).toBeLessThanOrEqual(Date.now());
    expect(DATE_MISE_A_JOUR_LLMS >= GLOSSAIRE_DATE_MISE_A_JOUR).toBe(true);
  });

  it("le slogan est lu dans le contenu de l'accueil", () => {
    expect(SLOGAN_LLMS).toBe(`${ACCUEIL.heros.titrePartie1} ${ACCUEIL.heros.titreEm}`);
  });

  it("deuxPremieresPhrases coupe aux fins de phrase, pas aux abréviations ni aux parenthèses", () => {
    expect(deuxPremieresPhrases("Un. Deux ! Trois ?")).toBe("Un. Deux !");
    expect(
      deuxPremieresPhrases(
        "L’audit dure 2 à 4 h selon l’entreprise (art. 4). Ensuite, la suite. Fin.",
      ),
    ).toBe("L’audit dure 2 à 4 h selon l’entreprise (art. 4). Ensuite, la suite.");
    expect(phrasesDe("Non, rien. « Oui », dit-elle. À demain.")).toHaveLength(3);
  });

  it("auFormatNorme passe une ligne « — » au format « : » sans toucher au reste", () => {
    expect(auFormatNorme("- [A](https://axion-ia.com/fr/a) — texte — suite\nligne — libre")).toBe(
      "- [A](https://axion-ia.com/fr/a): texte — suite\nligne — libre",
    );
  });

  it("propreLlms écarte ce que les deux fichiers ne servent pas", () => {
    for (const texte of [
      "Un contrat de maintenance optionnel existe sur devis.",
      "Les frais de déplacement sont facturés en sus.",
      "Hébergement Hetzner, Francfort.",
      "Rien ne se paie en ligne.",
      "Le code source vous appartient.",
      "Mise en production en 6-8 semaines.",
      "Nous restons à vos côtés avec un suivi mensuel.",
    ]) {
      expect(propreLlms(texte), texte).toBe(false);
    }
    expect(propreLlms("2 à 4 h d’audit le matin, suivies de 4 h de formation.")).toBe(true);
  });

  it("llms-full.txt : la FAQ partagée est une liste de liens, sans réponse recopiée ni doublon", async () => {
    const corps = await lireFull();
    const lignes = section(corps, "FAQ")
      .split("\n")
      .filter((l) => l.startsWith("- "));
    expect(lignes.length).toBeGreaterThanOrEqual(15);
    for (const l of lignes)
      expect(l, l).toMatch(/^- \[[^\]]+ \?\]\(https:\/\/axion-ia\.com\/fr\/faq\/[a-z0-9-]+\)$/);
    const ids = new Set(FAQ_GLOBAL.map((f) => f.id));
    for (const l of lignes) expect(ids.has(l.slice(l.lastIndexOf("/") + 1, -1)), l).toBe(true);
    const normaliser = (q: string) => q.toLowerCase().replace(/[’']/g, "'");
    const reference = new Set(
      Object.values(QUESTIONS_REFERENCE).map((q) => normaliser(q.question)),
    );
    for (const l of lignes) {
      const question = /^- \[([^\]]+)\]/.exec(l)?.[1] ?? "";
      expect(reference.has(normaliser(question)), question).toBe(false);
    }
  });

  it("llms-full.txt : toutes les questions de référence servies ont leur réponse et leur page", async () => {
    const bloc = section(await lireFull(), "Questions de dirigeants : réponses complètes");
    const titres = [...bloc.matchAll(/^### (.+)$/gm)].map((m) => m[1]);
    expect(titres.length).toBeGreaterThanOrEqual(14);
    expect(titres).toEqual([...new Set(titres)]);
    expect(bloc.match(/^Page : https:\/\/axion-ia\.com\/fr/gm)?.length).toBe(titres.length);
  });
});
