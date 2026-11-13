/**
 * L'accueil `/fr` refondu (PR-C) : la page, ses textes et ses nœuds JSON-LD.
 *
 * Ce que ce fichier verrouille :
 *  - aucun montant, aucune lecture de prix hors `pricing.ts`, aucun drapeau Qualiopi ;
 *  - le JSON-LD est exactement { WebPage, Service, FAQPage, graphe d'images } ;
 *  - le Service est celui de la Journée IA, construit par le même constructeur que la
 *    landing (un seul objet, donc identique octet pour octet) ;
 *  - le FAQPage dit les six questions que la page affiche, pas une de plus ;
 *  - la garantie affichée est la phrase et la condition du socle commun ;
 *  - le h1 est celui de `src/messages/fr.json` (décision de Williams : inchangé).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CONDITION_GARANTIE,
  GARANTIE,
  GARANTIE_PHRASE,
  remplacerJetons,
} from "@/content/journee-ia-commun";
import { FOUNDER_PERSON_ID } from "@/lib/brand";
import { META_DESCRIPTION_MAX, SITE_URL } from "@/lib/seo";
import { PAGE_IMAGES_MANIFEST } from "@/lib/seo/page-images";
import { buildJourneeIaServiceJsonLd } from "@/lib/seo/journee-ia-service";

import { CONTENU, DESCRIPTION_META, TITRE } from "../_accueil/contenu";
import { jsonLdAccueil, questionsAccueil } from "../_accueil/jsonld";

const DOSSIER_ACCUEIL = join(process.cwd(), "src/app/[locale]/_accueil");

function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
}

function lire(chemin: string): string {
  return readFileSync(join(process.cwd(), chemin), "utf8");
}

/** `page.tsx` + tous les fichiers de code de `_accueil/`, commentaires retirés. */
const FICHIERS: ReadonlyArray<readonly [string, string]> = [
  ["src/app/[locale]/page.tsx", sansCommentaires(lire("src/app/[locale]/page.tsx"))],
  ...readdirSync(DOSSIER_ACCUEIL)
    .filter((nom) => /\.(ts|tsx)$/.test(nom))
    .map(
      (nom) =>
        [
          `src/app/[locale]/_accueil/${nom}`,
          sansCommentaires(readFileSync(join(DOSSIER_ACCUEIL, nom), "utf8")),
        ] as const,
    ),
];

/** Tout le texte de l'accueil, jetons résolus (ce que le lecteur voit). */
const TEXTE_RESOLU = remplacerJetons(JSON.stringify(CONTENU));

describe("accueil : aucun montant écrit, aucune lecture de prix, aucun drapeau", () => {
  it("le balayage lit page.tsx et au moins contenu.ts, jsonld.ts", () => {
    const noms = FICHIERS.map(([nom]) => nom);
    expect(noms).toContain("src/app/[locale]/page.tsx");
    expect(noms).toContain("src/app/[locale]/_accueil/contenu.ts");
    expect(noms).toContain("src/app/[locale]/_accueil/jsonld.ts");
  });

  it.each([
    ["le prix de la Journée IA en toutes lettres", /1[   .]?490/],
    ["un montant en euros", /\d[   ]?€/],
    ["la lecture d'un prix d'entrée", /getEntryPriceEur/],
    ["un drapeau Qualiopi", /isQualiopi/],
    ["un rendez-vous forcé", /rdv=/],
    ["une mention du déplacement", /d[ée]placement/i],
  ])("aucun fichier de l'accueil ne contient %s", (_libelle, motif) => {
    for (const [nom, code] of FICHIERS) {
      expect(code, nom).not.toMatch(motif);
    }
  });

  it("aucun jeton inconnu n'atteint la page : tout se résout", () => {
    expect(TEXTE_RESOLU).not.toContain("{{");
    expect(TEXTE_RESOLU).toContain("1 490");
  });
});

describe("accueil : le JSON-LD", () => {
  const noeuds = jsonLdAccueil() as ReadonlyArray<Record<string, unknown>>;
  const types = noeuds.map((n) => n["@type"]);

  it("émet WebPage, Service, FAQPage et le graphe d'images, dans cet ordre", () => {
    expect(types).toEqual(["WebPage", "Service", "FAQPage", undefined]);
    expect(Array.isArray(noeuds[3]?.["@graph"])).toBe(true);
    const graphe = noeuds[3]?.["@graph"] as ReadonlyArray<Record<string, unknown>>;
    expect(graphe.length).toBeGreaterThan(5);
    for (const image of graphe) {
      expect(image["@type"]).toBe("ImageObject");
    }
  });

  it("n'émet aucun nœud que le layout ou une autre page porte déjà", () => {
    // Les nœuds de premier niveau : les trois premiers, plus les membres du graphe d'images.
    // (Un ImageObject porte, lui, un `creator` Organization imbriqué : ce n'est pas un nœud.)
    const graphe = noeuds[3]?.["@graph"] as ReadonlyArray<Record<string, unknown>>;
    const typesDePremierNiveau = [...noeuds.slice(0, 3), ...graphe].map((n) => n["@type"]);
    for (const interdit of ["Organization", "WebSite", "Person", "LocalBusiness"]) {
      expect(typesDePremierNiveau, interdit).not.toContain(interdit);
    }
    // Ceux-là ne doivent apparaître nulle part, même imbriqués.
    const brut = JSON.stringify(noeuds);
    for (const interdit of ["AggregateRating", "Review", "ProfessionalService", "VideoObject"]) {
      expect(brut, interdit).not.toContain(`"@type":"${interdit}"`);
    }
  });

  it("la WebPage a l'@id /fr#webpage, mentionne le Service et ne le déclare pas principal", () => {
    const page = noeuds[0] as Record<string, unknown>;
    expect(page["@id"]).toBe(`${SITE_URL}/fr#webpage`);
    expect(page["mentions"]).toEqual([{ "@id": (noeuds[1] as Record<string, unknown>)["@id"] }]);
    expect(page).not.toHaveProperty("mainEntity");
    expect(page["name"]).toBe(TITRE);
    expect(page["description"]).toBe(remplacerJetons(DESCRIPTION_META));
    expect(page["dateModified"]).toBe("2026-11-09");
  });

  it("l'image principale est la carte d'aperçu : eyebrow, 1200 × 675, @id /fr#primaryimage", () => {
    const page = noeuds[0] as Record<string, unknown>;
    const image = page["primaryImageOfPage"] as Record<string, unknown>;
    expect(image["@type"]).toBe("ImageObject");
    expect(image["@id"]).toBe(`${SITE_URL}/fr#primaryimage`);
    expect(String(image["url"])).toContain("/api/og?title=");
    expect(String(image["url"])).toContain("eyebrow=");
    expect(image["width"]).toBe(1200);
    expect(image["height"]).toBe(675);
    // Le héros n'est plus « représentatif » : sinon deux images principales se disputeraient.
    const graphe = noeuds[3]?.["@graph"] as ReadonlyArray<Record<string, unknown>>;
    expect(graphe.some((n) => n["representativeOfPage"] === true)).toBe(false);
  });

  it("la WebPage est lisible à voix haute sur le titre et l'En bref", () => {
    const page = noeuds[0] as { speakable: { cssSelector: string[] } };
    expect(page.speakable.cssSelector).toEqual(["#hero-heading", "[data-en-bref]"]);
  });

  it("le FAQPage est signé du fondateur, sans speakable propre", () => {
    const faq = noeuds[2] as { author: { "@id": string }; dateModified: string };
    expect(faq.author["@id"]).toBe(FOUNDER_PERSON_ID);
    expect(faq.dateModified).toBe("2026-11-09");
    expect(faq).not.toHaveProperty("speakable");
  });

  it("les tuiles secteurs ont le même texte alternatif dans la page et dans le manifeste", () => {
    const images = PAGE_IMAGES_MANIFEST.find((p) => p.path === "/")?.images ?? [];
    for (const tuile of CONTENU.secteurs.tuiles) {
      const declaree = images.find((i) => i.src === `/illustrations/secteurs/${tuile.slug}.avif`);
      expect(declaree?.altFr, tuile.slug).toBe(tuile.alt);
    }
  });

  it("le Service est égal en profondeur à celui que la landing construit", () => {
    expect(noeuds[1]).toEqual(buildJourneeIaServiceJsonLd());
  });

  it("le FAQPage dit les six questions affichées, avec leurs réponses affichées", () => {
    const faq = noeuds[2] as {
      mainEntity: ReadonlyArray<{ name: string; acceptedAnswer: { text: string } }>;
    };
    const affichees = questionsAccueil();
    expect(affichees).toHaveLength(6);
    expect(faq.mainEntity.map((q) => q.name)).toEqual(affichees.map((q) => q.question));
    expect(faq.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(
      affichees.map((q) => q.answer),
    );
    expect(new Set(CONTENU.faq.questions.map((q) => q.id)).size).toBe(6);
  });

  it("la page affiche la FAQ depuis la même source que le JSON-LD", () => {
    const page = FICHIERS.find(([nom]) => nom === "src/app/[locale]/page.tsx")?.[1] ?? "";
    expect(page).toContain("questionsAccueil()");
    expect(page).toContain("emitJsonLd={false}");
    expect(page).toContain("jsonLdAccueil()");
  });

  it("la FAQ ne dit ni mot interdit ni jeton non résolu", () => {
    for (const q of questionsAccueil()) {
      expect(q.answer).not.toContain("{{");
    }
  });
});

describe("accueil : la meta description", () => {
  it("tient dans META_DESCRIPTION_MAX une fois le prix résolu", () => {
    const description = remplacerJetons(DESCRIPTION_META);
    expect(description.length).toBeLessThanOrEqual(META_DESCRIPTION_MAX);
    expect(description).toContain("1 490");
  });

  it("le titre porte la marque (rendu absolu) et reste court", () => {
    expect(TITRE).toContain("Axion-IA");
    expect(TITRE.length).toBeLessThanOrEqual(60);
  });
});

describe("accueil : la garantie et le titre", () => {
  const journee = CONTENU.deuxFacons.blocJournee;

  it("affiche « Garantie écrite « 3 fois le prix ». », la phrase du socle puis la condition", () => {
    expect(journee.garantieTitre).toBe("Garantie écrite « 3 fois le prix ».");
    expect(`${journee.garantieDebut}${journee.garantieEngagement}`).toBe(GARANTIE_PHRASE);
    expect(journee.condition).toBe(CONDITION_GARANTIE);
    // La phrase du socle est bien la fin de la garantie complète de la landing.
    expect(GARANTIE.endsWith(GARANTIE_PHRASE)).toBe(true);
  });

  it("n'ajoute pas la précision « Gains identifiés : calculés… » (engagement non validé)", () => {
    expect(TEXTE_RESOLU).not.toMatch(/Gains identifiés/);
  });

  it("la FAQ de la garantie reprend la phrase et la condition du socle", () => {
    const reponse = CONTENU.faq.questions.find((q) => q.id === "faq-garantie")?.reponse;
    expect(reponse).toBe(`${GARANTIE_PHRASE} ${CONDITION_GARANTIE}`);
  });

  it("le h1 est celui de src/messages/fr.json", () => {
    const fr = JSON.parse(lire("src/messages/fr.json")) as { home: Record<string, string> };
    expect(CONTENU.heros.titrePartie1).toBe(fr.home["heroTitlePart1"]);
    expect(CONTENU.heros.titreEm).toBe(fr.home["heroTitleEm"]);
    expect(CONTENU.heros.titrePartie2).toBe(fr.home["heroTitlePart2"]);
  });
});

describe("accueil : le vocabulaire proscrit", () => {
  // Liste du § 6 de l'audit final (09/11) : jamais sur l'accueil.
  const INTERDITS: ReadonlyArray<readonly [string, RegExp]> = [
    ["conforme", /\bconforme/i],
    ["certifié", /certifi/i],
    ["conformité", /conformit/i],
    ["certificat", /certificat/i],
    ["obligatoire", /obligatoire/i],
    ["Qualiopi", /qualiopi/i],
    ["CPF", /\bCPF\b/],
    ["OPCO", /\bOPCO\b/i],
    ["financement", /financement/i],
    ["amende", /\bamende/i],
    ["offert", /\boffert/i],
    ["valeur de", /\bvaleur de\b/i],
    ["satisfait ou remboursé", /satisfait ou rembours/i],
    ["ETI", /(^|[^A-Za-zÀ-ÿ])ETI([^A-Za-zÀ-ÿ]|$)/],
    ["TPE/PME", /TPE\s?\/\s?PME/],
    ["intégrateur", /intégrateur/i],
    ["SaaS", /\bSaaS\b/i],
    ["no-code", /no-code/i],
    ["Grenoble", /Grenoble/i],
    ["Vous êtes remboursé", /Vous êtes remboursé/],
    ["même prix pour tous", /m[êe]me prix pour tou/i],
    ["3 à 4 h", /3 à 4[\s ]h/],
  ];

  // Trois surfaces : le texte résolu, le code de la page et de `_accueil/` (commentaires
  // retirés), et le JSON-LD émis (noms, alt et descriptions des images compris).
  const SURFACES: ReadonlyArray<readonly [string, string]> = [
    ["texte résolu", TEXTE_RESOLU],
    ...FICHIERS.map(([nom, code]) => [nom, code] as const),
    ["JSON-LD émis", JSON.stringify(jsonLdAccueil())],
  ];

  it("le balayage couvre bien page.tsx, _accueil/ et le JSON-LD", () => {
    expect(SURFACES.map(([nom]) => nom)).toEqual(
      expect.arrayContaining(["texte résolu", "src/app/[locale]/page.tsx", "JSON-LD émis"]),
    );
    expect(SURFACES.every(([, texte]) => texte.length > 200)).toBe(true);
  });

  it.each(INTERDITS)("aucune surface de l'accueil ne contient « %s »", (_mot, motif) => {
    for (const [nom, texte] of SURFACES) {
      expect(texte, nom).not.toMatch(motif);
    }
  });

  it("la tuile de l'après-midi dit l'attestation nominative par personne", () => {
    const tuile = CONTENU.deuxFacons.blocJournee.tuiles[1];
    expect(tuile?.repere).toMatch(/^L’après-midi · 4\s+h de formation$/);
    expect(tuile?.texte).toBe(
      "Vos équipes, sur leurs vrais dossiers. Une attestation de formation nominative par personne.",
    );
  });

  it("annonce « 2 à 4 h » d'audit le matin", () => {
    expect(TEXTE_RESOLU).toMatch(/2 à 4\s?h selon la structuration de l’entreprise/);
  });
});
