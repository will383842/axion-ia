import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * **LE FILTRE DE SORTIE (ADR 0076) — RIEN D'INTERDIT NE SORT.**
 *
 * Corpus entièrement FAUX et inventé. Les montants, courriels et téléphones sont
 * fabriqués à l'exécution : aucun n'est écrit en clair dans ce fichier.
 */

const findManyMock = vi.fn();
const queryRawMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    knowledgeEntry: { findMany: (...a: unknown[]) => findManyMock(...a) },
    $queryRawUnsafe: (...a: unknown[]) => queryRawMock(...a),
  },
}));

import { ETIQUETTE_CHIFFRES, ETIQUETTE_DOCTRINE, ETIQUETTE_SANTE } from "../decoupage";
import { obtenirContexteMethode, filtrerPourSortie } from "../index";
import { contientCourriel, contientTelephone, motifRefus } from "../filtre-sortie";

const EURO = String.fromCharCode(0x20ac);
const MONTANT = `${["4", "200"].join(" ")} ${EURO}`;
const COURRIEL = ["faux.nom", "exemple.invalid"].join("@");
const TELEPHONE = ["06", "12", "34", "56", "78"].join(" ");
/** Le nom de la ville du siège n'est écrit nulle part : on déclenche le motif « ancrage local ». */
const ANCRAGE = "Axion-IA est basée à l'étage du fond";
const SLUG_NOYAU_FAUX = "methode/faux-00-atelier/essentiel";

/** La marque d'approbation du fondateur, écrite en clair : le test ne dépend d'aucune constante du code. */
const MARQUE = "sortie: validee";

/** Une section APPROUVÉE (marque en première ligne) : seule forme que le filtre peut laisser sortir. */
function fiche(texte: string, etiquettes: string[] = [], titre = "Un titre inventé") {
  return {
    slug: "methode/faux-atelier/une-fiche",
    titre,
    texte: `${MARQUE}\n${texte}`,
    etiquettes,
  };
}
/** Une section SANS marque (ou avec une marque mal placée) : le texte est pris tel quel. */
function ficheBrute(texte: string, etiquettes: string[] = []) {
  return { slug: "methode/faux-atelier/une-fiche", titre: "Un titre inventé", texte, etiquettes };
}

describe("motifRefus — fiche par fiche", () => {
  it("une fiche saine passe", () => {
    expect(
      motifRefus(fiche("Accueillir le client, puis l'écouter sans l'interrompre.")),
    ).toBeNull();
  });

  it("refuse un montant en euros, dans le texte comme dans le titre", () => {
    expect(motifRefus(fiche(`Un exercice à ${MONTANT} par an.`))).toBe("montant");
    expect(motifRefus(fiche("Texte sain.", [], `Titre à ${MONTANT}`))).toBe("montant");
  });

  it("refuse les étiquettes chiffres-exercice, doctrine:a-revoir et secteur:sante", () => {
    for (const e of [ETIQUETTE_CHIFFRES, ETIQUETTE_DOCTRINE, ETIQUETTE_SANTE]) {
      expect(motifRefus(fiche("Texte sain.", [e]))).toBe(`etiquette:${e}`);
    }
  });

  it("refuse un courriel et un téléphone", () => {
    expect(motifRefus(fiche(`Écrire à ${COURRIEL}.`))).toBe("courriel");
    expect(motifRefus(fiche(`Appeler le ${TELEPHONE}.`))).toBe("telephone");
    expect(contientCourriel(`x ${COURRIEL}`)).toBe(true);
    expect(contientTelephone(`${["+33", "6", "12", "34", "56", "78"].join(" ")}`)).toBe(true);
    expect(contientTelephone(["(+33)", "6", "12", "34", "56", "78"].join(" "))).toBe(true);
    expect(contientTelephone("Il y a 12 fournées en 2026.")).toBe(false);
  });

  it("refuse une promesse de gain, un témoignage et un ancrage local", () => {
    expect(motifRefus(fiche("Un gain garanti pour tous."))).toMatch(/^doctrine:promesse-garantie/);
    expect(motifRefus(fiche("Un de nos clients a doublé son chiffre."))).toMatch(
      /^doctrine:temoignage-axion/,
    );
    expect(motifRefus(fiche(ANCRAGE))).toMatch(/^doctrine:ancrage-local/);
  });
});

describe("motifRefus — formes de montant (k, M, symbole devant)", () => {
  const formes = [
    ["5", " k", EURO],
    ["5", "k", EURO],
    ["1,5 ", "M", EURO],
    [EURO, "500"],
    [EURO, " 500"],
    ["5 ", "K", "EUR"],
    ["3 ", "millions d'", "euros"],
    ["2 ", "mille ", "euros"],
    ["EUR", " 40"],
    ["3 ", "Mds ", EURO],
    ["3 ", "Mrd", EURO],
    ["2 ", "Mds d'", "euros"],
    ["cinq mille ", "euros"],
    ["cent ", "euros"],
    ["K", "EUR", " 5"],
    ["un prix en ", EURO],
    ["1 500 ", "HT"],
    ["1 490 ", "TTC"],
    ["3 ", "Mds"],
    ["2 ", "milliards"],
  ].map((morceaux) => morceaux.join(""));

  for (const forme of formes) {
    it(`refuse la forme « ${forme.length} caractères » dans le texte`, () => {
      expect(motifRefus(fiche(`Un exercice : ${forme} par an.`))).toBe("montant");
    });
  }

  it("ne refuse pas un texte sans montant", () => {
    expect(motifRefus(fiche("Cinq clients, 3 étapes, 12 fournées, 2026."))).toBeNull();
  });
});

/** Formes INVENTÉES, assemblées à l'exécution : aucun montant ni coordonnée n'est écrit en clair. */
const j = (...m: string[]) => m.join("");
const NBSP = String.fromCharCode(0xa0);

describe("motifRefus — promesses et pourcentages (première personne comprise)", () => {
  const formes = [
    j("Je garan", "tis des gains rapides."),
    j("Je rembour", "se si ça ne marche pas."),
    j("On garan", "tit +30", " %"),
    j("Un résultat gar", "anti."),
    j("La garan", "tie du résultat."),
    j("Un rembour", "sement intégral."),
    j("Gar", "antissez-vous un gain"),
    j("92", " % des clients d'Axion-IA sont satisfaits."),
    j("92", NBSP, "% des clients."),
    j("Hausse de 7", "% en un mois."),
    j("Hausse de 7", "\uFF05 en un mois."),
    j("Dix pour", " cent de mieux."),
  ];
  for (const forme of formes) {
    it(`refuse « ${forme.length} caractères, ${forme.slice(0, 3)}… »`, () => {
      expect(motifRefus(fiche(forme))).not.toBeNull();
    });
  }
  it("refuse aussi dans le titre", () => {
    expect(motifRefus(fiche("Texte sain.", [], j("Je garan", "tis")))).not.toBeNull();
  });
  it("une fiche saine sans promesse ni pourcentage passe encore", () => {
    expect(motifRefus(fiche("Écouter, reformuler, proposer deux choix."))).toBeNull();
  });
});

describe("motifRefus — montants sans devise (k, M, millions, mille) et dollars", () => {
  const formes = [
    j("5", "k par mois"),
    j("300", "K de CA"),
    j("2 ", "M de CA"),
    j("2 ", "millions"),
    j("1,2 ", "million"),
    j("3 ", "mille"),
    j("$", "1,500"),
    j("$ ", "40"),
    j("1500 ", "USD"),
    j("USD ", "1500"),
    j("50 ", "dollars"),
    j("1", "$"),
  ];
  for (const forme of formes) {
    it(`refuse « ${forme.length} caractères, ${forme.slice(0, 2)}… »`, () => {
      expect(motifRefus(fiche(`Un exercice : ${forme}.`))).toBe("montant");
    });
  }
  it("ne refuse pas des nombres ordinaires", () => {
    expect(motifRefus(fiche("Trois étapes, 12 fournées, 5 km, 10 min."))).toBeNull();
  });
});

describe("motifRefus — courriels masqués et indicatifs entre parenthèses", () => {
  const formes = [
    j("faux.nom", " [at] ", "exemple.invalid"),
    j("faux.nom", "[at]", "exemple.invalid"),
    j("faux.nom", " (arobase) ", "exemple.invalid"),
    j("faux.nom", " (at) ", "exemple.invalid"),
    j("faux.nom", " @ ", "exemple.invalid"),
    j("faux.nom", " arobase ", "exemple point invalid"),
    j("faux.nom", "@", "exemple [dot] invalid"),
  ];
  for (const forme of formes) {
    it(`refuse le courriel masqué « ${forme.length} caractères »`, () => {
      expect(motifRefus(fiche(`Écrire à ${forme}.`))).toBe("courriel");
    });
  }
  const tels = [
    j("(06", ") 12-34-56-78"),
    j("(06", ")12 34 56", " 78"),
    j("(0", ")6 12 34 56", " 78"),
    j("(+33", ") (0)6 12 34 56", " 78"),
    j("(33", ") 6 12 34 56", " 78"),
  ];
  for (const t of tels) {
    it(`refuse le téléphone « ${t.length} caractères »`, () => {
      expect(motifRefus(fiche(`Appeler le ${t}.`))).toBe("telephone");
    });
  }
});

describe("motifRefus — tour 2 : autres devises, parts, promesses déguisées, coordonnées", () => {
  const cyr = String.fromCharCode(0x0430); // « а » cyrillique
  const grec = String.fromCharCode(0x03bf); // « ο » grec
  const formes = [
    j("£", "500"),
    j("1 500 ", "£"),
    j("500 ", "GBP"),
    j("500 ", "CHF"),
    j("500 ", "francs"),
    j("\u00a5", "5000"),
    j("4 ", "bn"),
    j("trois mille ", "balles"),
    j("un ticket de 2 000 ", "balles"),
    j("tarif : 1500", "/mois"),
    j("1500", "/jour"),
    j("TJ", "M 800"),
    j("800 la ", "journée"),
    j("un ", "million"),
    j("deux ", "millions de CA"),
    j("trente ", "%"),
    j("30 ", "pct"),
    j("30 p. ", "100"),
    j("30 p", ".c."),
    j("0,5 ", "\u2030"),
    j("9 clients ", "sur 10"),
    j("neuf clients ", "sur dix"),
    j("la moitié ", "des clients signent"),
    j("deux tiers ", "des clients"),
    j("résultat ass", "uré"),
    j("on vous ass", "ure le résultat"),
    j("succès cert", "ain"),
    j("je m'eng", "age sur le résultat"),
    j("nous prom", "ettons des résultats"),
    j("dou", "blez vos ventes"),
    j("tri", "plez votre chiffre"),
    j("multi", "pliez par 3 vos ventes"),
    j("un R", "OI x3"),
    j("g", cyr, "ranti"),
    j("remb", grec, "ursé"),
    j("g a r ", "a n t i"),
    j("06", "/12/34/56/78"),
    j("0612 345", " 678"),
    j("6 12 34 56", " 78"),
    j("nom\uFF20", "domaine.fr"),
    j("nom\uFF08at\uFF09", "domaine.fr"),
    j("nom AT domaine ", "DOT fr"),
    j("nom chez domaine ", "point com"),
    j("nom@", "domaine"),
  ];
  for (const forme of formes) {
    it(`refuse la forme de ${forme.length} caractères commençant par « ${forme.slice(0, 2)} »`, () => {
      expect(motifRefus(fiche(`Voici : ${forme}.`))).not.toBeNull();
    });
  }
  it("n'a pas de retour arrière explosif sur un long texte de chiffres", () => {
    const t0 = Date.now();
    motifRefus(fiche("1 ".repeat(25000)));
    motifRefus(fiche("a.".repeat(25000)));
    expect(Date.now() - t0).toBeLessThan(500);
  });
});

describe("motifRefus — tour 3 : promesses, parts, montants, numéros spéciaux", () => {
  const formes = [
    j("On s'eng", "age sur des résultats concrets."),
    j("C'est pro", "mis, vous gagnerez du temps."),
    j("Si vous n'êtes pas sati", "sfait, vous ne payez pas."),
    j("Si c'est sati", "sfait ou rien."),
    j("Divi", "sez par deux le temps passé."),
    j("Deux ", "fois plus de rendez-vous."),
    j("Vous êtes cer", "tain de gagner dix heures."),
    j("À coup ", "sûr, vos équipes gagneront."),
    j("Vous gagnerez for", "cément du temps."),
    j("La journée est renta", "bilisée en un mois."),
    j("Un dirigeant ", "sur deux hésite."),
    j("Huit dirigeants ", "sur 10 hésitent."),
    j("Trente pour", "-cent de mieux."),
    j("La moi", "tié du temps."),
    j("Trois qua", "rts du temps."),
    j("Un CA de 50 ", "KE."),
    j("Un prix de 1 490 H", ".T."),
    j("Un prix de 1 490 T", ".T.C."),
    j("290 men", "suels."),
    j("1 200 an", "nuels."),
    j("Le 0 8", "00 123 456."),
  ];
  for (const forme of formes) {
    it(`refuse la forme de ${forme.length} caractères commençant par « ${forme.slice(0, 2)} »`, () => {
      expect(motifRefus(fiche(forme))).not.toBeNull();
    });
  }
  it("pas de retour arrière quadratique sur des chiffres collés", () => {
    const t0 = Date.now();
    motifRefus(fiche("1".repeat(50000)));
    motifRefus(fiche(`+${"1".repeat(50000)}a`));
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it("les phrases saines passent encore", () => {
    for (const t of [
      "Avant de parler du prix, je reformule le besoin en une phrase.",
      "Je pose trois questions ouvertes, puis je laisse le silence travailler.",
      "Quand une objection arrive, je la remercie puis je demande ce qui se cache derrière.",
      "Il faut compromettre le moins possible la relation.",
    ]) {
      expect(motifRefus(fiche(t))).toBeNull();
    }
  });
});

describe("filtrerPourSortie — point unique", () => {
  it("ne garde que les fiches sans motif, dans l'ordre", () => {
    const saines = [fiche("Un."), fiche("Deux.")];
    const rendues = filtrerPourSortie([
      saines[0]!,
      fiche(`À ${MONTANT}`),
      saines[1]!,
      fiche("ok", [ETIQUETTE_CHIFFRES]),
    ]);
    expect(rendues).toEqual(saines);
  });
});

describe("obtenirContexteMethode — rien d'interdit ne sort", () => {
  beforeEach(() => {
    findManyMock.mockReset();
    queryRawMock.mockReset();
    vi.stubEnv("METHODE_ACTIVE", "true");
    queryRawMock.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());

  function noyauEn(texte: string, titre = "Essentiel inventé", marque = true) {
    findManyMock.mockResolvedValue([
      {
        slug: SLUG_NOYAU_FAUX,
        translations: [{ title: titre, bodyText: marque ? `${MARQUE}\n${texte}` : texte }],
      },
    ]);
  }
  function extraitsEn(
    lignes: Array<{
      slug: string;
      texte: string;
      etiquettes?: string[];
      titre?: string;
      marque?: boolean;
    }>,
  ) {
    queryRawMock.mockResolvedValue(
      lignes.map((l) => ({
        slug: l.slug,
        titre: l.titre ?? "Titre inventé",
        texte: l.marque === false ? l.texte : `${MARQUE}\n${l.texte}`,
        collection: "methode-vente",
        etiquettes: l.etiquettes ?? [],
      })),
    );
  }

  it("noyau sain : servi", async () => {
    noyauEn("Une vitrine chaleureuse vaut mieux qu'une longue explication.");
    const ctx = await obtenirContexteMethode({ sujet: "vitrine" });
    expect(ctx.noyau?.slug).toBe(SLUG_NOYAU_FAUX);
  });

  it("noyau qui contient un montant : NON servi", async () => {
    noyauEn(`Un exercice à ${MONTANT}.`);
    const ctx = await obtenirContexteMethode({ sujet: "vitrine" });
    expect(ctx.noyau).toBeNull();
  });

  it("noyau avec une promesse, un témoignage ou un ancrage local : NON servi", async () => {
    for (const t of ["Un gain garanti.", "Un de nos clients a réussi.", ANCRAGE]) {
      noyauEn(t);
      expect((await obtenirContexteMethode({ sujet: "vitrine" })).noyau).toBeNull();
    }
  });

  it("extrait étiqueté chiffres-exercice : NON servi", async () => {
    noyauEn("Texte sain.");
    extraitsEn([
      { slug: "methode/faux-a/un", texte: "Texte sain un." },
      { slug: "methode/faux-a/deux", texte: "Texte sain deux.", etiquettes: [ETIQUETTE_CHIFFRES] },
    ]);
    const ctx = await obtenirContexteMethode({ sujet: "vitrine" });
    expect(ctx.extraits.map((e) => e.slug)).toEqual(["methode/faux-a/un"]);
  });

  it("extrait avec « garanti », témoignage, ancrage local, courriel, téléphone ou montant : NON servi", async () => {
    noyauEn("Texte sain.");
    extraitsEn([
      { slug: "methode/faux-a/garanti", texte: "Un gain garanti." },
      { slug: "methode/faux-a/temoin", texte: "Un de nos clients a doublé." },
      { slug: "methode/faux-a/siege", texte: ANCRAGE },
      { slug: "methode/faux-a/mail", texte: `Écrire à ${COURRIEL}` },
      { slug: "methode/faux-a/tel", texte: `Appeler le ${TELEPHONE}` },
      { slug: "methode/faux-a/montant", texte: `Pour ${MONTANT}` },
      { slug: "methode/faux-a/sante", texte: "Texte sain.", etiquettes: [ETIQUETTE_SANTE] },
      { slug: "methode/faux-a/bon", texte: "Texte sain." },
    ]);
    const ctx = await obtenirContexteMethode({ sujet: "vitrine", max: 10 });
    expect(ctx.extraits.map((e) => e.slug)).toEqual(["methode/faux-a/bon"]);
  });

  it("un extrait refusé ne fait pas passer le total sous la demande si d'autres sont sains", async () => {
    noyauEn("Texte sain.");
    extraitsEn([
      { slug: "methode/faux-a/1", texte: "Un gain garanti." },
      { slug: "methode/faux-a/2", texte: "Sain deux." },
      { slug: "methode/faux-a/3", texte: "Sain trois." },
    ]);
    const ctx = await obtenirContexteMethode({ sujet: "vitrine", max: 2 });
    expect(ctx.extraits.map((e) => e.slug)).toEqual(["methode/faux-a/2", "methode/faux-a/3"]);
  });

  it("la demande n'a plus de paramètre « secteur » : la santé n'est jamais interrogée", async () => {
    noyauEn("Texte sain.");
    await obtenirContexteMethode({ sujet: "vitrine", secteur: "sante" } as never);
    expect(queryRawMock.mock.calls[0]![2]).toEqual(["methode-vente"]);
    expect(queryRawMock.mock.calls[0]![4] as number).toBeGreaterThan(0);
    expect(queryRawMock.mock.calls[0]![5]).toContain(ETIQUETTE_SANTE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DÉCISION DU PILOTE (18/11) : refus par défaut. La sécurité, c'est l'approbation
//  à la main ; le filtre n'est que le second filet.
// ─────────────────────────────────────────────────────────────────────────────

const SAINE = "Accueillir le client, puis l'écouter sans l'interrompre.";

describe("approbation — une section NON marquée n'est jamais servie, même saine", () => {
  it("motifRefus : « non-approuvee » pour une section saine sans marque", () => {
    expect(motifRefus(ficheBrute(SAINE))).toBe("non-approuvee");
    expect(filtrerPourSortie([ficheBrute(SAINE)])).toEqual([]);
  });

  it("une marque mal formée, mal placée ou masquée ne compte pas", () => {
    const j = (...m: string[]) => m.join("");
    const formes = [
      `Sortie: validee\n${SAINE}`,
      `SORTIE: VALIDEE\n${SAINE}`,
      `sortie:validee\n${SAINE}`,
      `sortie : validee\n${SAINE}`,
      `sortie:  validee\n${SAINE}`,
      `sortie: validée\n${SAINE}`,
      `sortie: validee \n${SAINE}`,
      ` sortie: validee\n${SAINE}`,
      `\tsortie: validee\n${SAINE}`,
      `\nsortie: validee\n${SAINE}`,
      `sortie: validee.\n${SAINE}`,
      `sortie: validees\n${SAINE}`,
      `sortie: non-validee\n${SAINE}`,
      `sortie: validee-non\n${SAINE}`,
      `- sortie: validee\n${SAINE}`,
      `> sortie: validee\n${SAINE}`,
      `**sortie: validee**\n${SAINE}`,
      `\`sortie: validee\`\n${SAINE}`,
      `<!-- sortie: validee -->\n${SAINE}`,
      `sortie: validee${String.fromCharCode(0x200b)}\n${SAINE}`,
      `sortie:${String.fromCharCode(0xa0)}validee\n${SAINE}`,
      `sortie: validee\r\n${SAINE}`,
      `${j("sorti", String.fromCharCode(0xff45))}: validee\n${SAINE}`,
      `sortie: valid${String.fromCharCode(0x435)}e\n${SAINE}`,
      `sortie: validee ${SAINE}`,
      `${SAINE}\nsortie: validee`,
      `${SAINE}\n${MARQUE}\n${SAINE}`,
      `Une première ligne.\n${MARQUE}`,
      `Texte ${MARQUE} au milieu d'une phrase.`,
    ];
    for (const t of formes) {
      expect(motifRefus(ficheBrute(t)), JSON.stringify(t)).toBe("non-approuvee");
    }
  });

  it("la marque n'est lue que dans le TEXTE, jamais dans le titre ni dans les étiquettes", () => {
    const f = { slug: "methode/faux-a/x", titre: MARQUE, texte: SAINE, etiquettes: [MARQUE] };
    expect(motifRefus(f)).toBe("non-approuvee");
    expect(
      motifRefus({
        slug: "methode/faux-a/x",
        titre: "T",
        texte: SAINE,
        etiquettes: ["sortie:validee"],
      }),
    ).toBe("non-approuvee");
  });

  it("filtrerPourSortie ne garde que les sections marquées", () => {
    const marquee = fiche(SAINE);
    expect(filtrerPourSortie([ficheBrute(SAINE), marquee, ficheBrute(SAINE)])).toEqual([marquee]);
  });
});

describe("approbation — marquée et douteuse : refusée ; marquée et saine : servie", () => {
  it("marquée et saine : servie", () => {
    expect(motifRefus(fiche(SAINE))).toBeNull();
  });

  it("marquée et douteuse : refusée (montant, courriel, téléphone, promesse, étiquettes)", () => {
    expect(motifRefus(fiche(`Un exercice à ${MONTANT}.`))).toBe("montant");
    expect(motifRefus(fiche(`Écrire à ${COURRIEL}.`))).toBe("courriel");
    expect(motifRefus(fiche(`Appeler le ${TELEPHONE}.`))).toBe("telephone");
    expect(motifRefus(fiche("Un gain garanti."))).toMatch(/^doctrine:/);
    expect(motifRefus(fiche("Une remise de 20 % ce mois-ci."))).toBe("pourcentage");
    expect(motifRefus(fiche(SAINE, [ETIQUETTE_CHIFFRES]))).toBe(`etiquette:${ETIQUETTE_CHIFFRES}`);
  });

  it("la marque seule, sans corps, n'est pas une section servable", () => {
    expect(motifRefus(ficheBrute(MARQUE))).not.toBeNull();
  });
});

describe("approbation — refus à la racine (second filet, sections marquées seulement)", () => {
  const j = (...m: string[]) => m.join("");
  const X = String.fromCharCode(0xd7);
  const formes = [
    // montants : taxes, périodes, brut / net
    "Un forfait hors taxes pour l'atelier.",
    "Un forfait hors-taxe pour l'atelier.",
    "Un forfait hors TVA pour l'atelier.",
    "Un forfait HTVA pour l'atelier.",
    `Un forfait ${["500", "brut"].join(" ")} pour l'atelier.`,
    `Un forfait ${["500", "net"].join(" ")} pour l'atelier.`,
    "Un tarif de l'heure pour l'atelier.",
    "Un forfait par heure pour l'atelier.",
    "Un forfait par jour pour l'atelier.",
    "Un forfait par mois pour l'atelier.",
    "Un forfait par trimestre pour l'atelier.",
    "Un forfait par an pour l'atelier.",
    "Un forfait par année pour l'atelier.",
    // promesses
    "On vous rend votre argent.",
    "Il rend l'argent si besoin.",
    "Pas de résultat, pas de facture.",
    "Je m'y engage.",
    "Un engagement de résultat.",
    "Une obligation de résultat.",
    "On s'engage sur le résultat.",
    "On double vos ventes.",
    "On triple vos ventes.",
    "Un chiffre d'affaires doublé.",
    "Un chiffre d'affaires triplé.",
    "Un chiffre d'affaires décuplé.",
    "Un chiffre d'affaires quadruplé.",
    "Un chiffre d'affaires décuplera.",
    j("Un gain de 10", "x", " sur les ventes."),
    j("Un gain de 3 ", "x", "."),
    j("Un gain ", X, "3 sur les ventes."),
    j("Un gain de 3", X, "."),
    j("Un gain de 3 ", X, "."),
    j("Une hausse de x", "10", "."),
    // parts
    "La moitié de nos clients reviennent.",
    "Les deux tiers de nos clients reviennent.",
    "Un tiers reviennent.",
    "Un quart reviennent.",
    "La grande majorité reviennent.",
    "La majorité de nos clients reviennent.",
    // courriel : « at » + domaine avec point
    "Écrire à jean.dupont at exemple.fr pour la suite.",
    "Écrire à jean.dupont AT exemple.com pour la suite.",
    // tour 2 de relecture
    `Un forfait ${["3000", "bruts"].join(" ")}.`,
    `Un forfait ${["3000", "brute"].join(" ")}.`,
    `Un forfait ${["40", "nettes"].join(" ")}.`,
    "Un chiffre d'affaires redoublé.",
    "Un chiffre d'affaires dédoublé.",
    "Un chiffre d'affaires retriplée.",
    "Un chiffre d'affaires surdécuplé.",
    "Un forfait hors T.V.A. pour l'atelier.",
    "Un forfait hors-T.V.A. pour l'atelier.",
    "Nous prenons un engagement ferme, écrit, signé et contresigné, sur chaque résultat.",
    "On vous rend, sans discuter et sous quinzaine au plus tard, tout votre argent.",
  ];
  for (const t of formes) {
    it(`refuse : ${t}`, () => {
      expect(motifRefus(fiche(t)), t).not.toBeNull();
    });
  }

  it("ne refuse pas à tort une prose saine (l'at de « l'atelier », « et », « dans »)", () => {
    for (const t of [
      "Accueillir le client à l'atelier, puis l'écouter.",
      "Préparer la vitrine avant l'ouverture du matin.",
      "Noter ce que le client dit, puis reformuler.",
      "Laisser goûter, puis demander ce qui a plu.",
    ]) {
      expect(motifRefus(fiche(t)), t).toBeNull();
    }
  });
});

describe("approbation — la marque ne se pose pas par le code", () => {
  it("le texte rendu au lecteur ne commence plus par la marque", async () => {
    findManyMock.mockReset();
    queryRawMock.mockReset();
    vi.stubEnv("METHODE_ACTIVE", "true");
    findManyMock.mockResolvedValue([
      {
        slug: SLUG_NOYAU_FAUX,
        translations: [{ title: "Essentiel inventé", bodyText: `${MARQUE}\n${SAINE}` }],
      },
    ]);
    queryRawMock.mockResolvedValue([
      {
        slug: "methode/faux-a/un",
        titre: "T",
        texte: `${MARQUE}\n${SAINE}`,
        collection: "methode-vente",
        etiquettes: [],
      },
    ]);
    const ctx = await obtenirContexteMethode({ sujet: "vitrine" });
    expect(ctx.noyau?.texte).toBe(SAINE);
    expect(ctx.extraits[0]?.texte).toBe(SAINE);
    vi.unstubAllEnvs();
  });

  it("noyau et extraits non marqués : jamais servis, par le point d'entrée", async () => {
    findManyMock.mockReset();
    queryRawMock.mockReset();
    vi.stubEnv("METHODE_ACTIVE", "true");
    findManyMock.mockResolvedValue([
      { slug: SLUG_NOYAU_FAUX, translations: [{ title: "T", bodyText: SAINE }] },
    ]);
    queryRawMock.mockResolvedValue([
      {
        slug: "methode/faux-a/un",
        titre: "T",
        texte: SAINE,
        collection: "methode-vente",
        etiquettes: [],
      },
      {
        slug: "methode/faux-a/deux",
        titre: "T",
        texte: `${SAINE}\n${MARQUE}`,
        collection: "methode-vente",
        etiquettes: [],
      },
    ]);
    const ctx = await obtenirContexteMethode({ sujet: "vitrine", max: 10 });
    expect(ctx.noyau).toBeNull();
    expect(ctx.extraits).toEqual([]);
    vi.unstubAllEnvs();
  });

  it("la requête des extraits exige elle aussi la marque (premier filet, côté base)", async () => {
    findManyMock.mockReset();
    queryRawMock.mockReset();
    vi.stubEnv("METHODE_ACTIVE", "true");
    findManyMock.mockResolvedValue([]);
    queryRawMock.mockResolvedValue([]);
    await obtenirContexteMethode({ sujet: "vitrine" });
    const sql = String(queryRawMock.mock.calls[0]![0]);
    expect(sql).toMatch(/body_text/);
    expect(sql).toMatch(/LIKE|~|starts_with|left\(/i);
    expect(queryRawMock.mock.calls[0]!.slice(1)).toContainEqual(`${MARQUE}\n%`);
    vi.unstubAllEnvs();
  });
});
