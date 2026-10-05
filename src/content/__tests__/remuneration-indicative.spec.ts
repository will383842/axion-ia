// @req REQ-JUR-001 REQ-JUR-002 REQ-JUR-019 REQ-JUR-041
/**
 * remuneration-indicative.spec.ts — JUR-T29 (chantier Axion Partners) : la rémunération d'un
 * apporteur ne se promet pas.
 *
 * La garde `jur:remuneration-indicative` (`scripts/gates/jur-copy-indicative.ts`) lit les
 * surfaces de `jur:vocab-public` et rougit sur une formule ferme (« vous touchez », « commission
 * de 10 % », un montant de commission interpolé, « par journée vendue ») sans mention indicative
 * dans la ligne ou ses deux voisines, sur « kit de vente », et sur tout balisage structuré de
 * rémunération. Chaque famille a son TÉMOIN ROUGE, et la fenêtre ses CONTRE-TÉMOINS.
 * Depuis les relectures securite et exactitude de #1232 : tout montant ou taux affiché, verbe
 * ou pas, le revenu illimité, l'anglais, les exceptions nommées, et les e-mails d'avant
 * signature (liste nommée, en fin de fichier).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  EXCEPTIONS_REMUNERATION,
  fautesDeRemuneration,
  lireSurfacesPubliques,
  type FamilleRemuneration,
} from "../../../scripts/gates/jur-copy-indicative";
import { lireSurfacesApporteur } from "../../../scripts/gates/vocab-public";

const temoin = (texte: string): FamilleRemuneration[] =>
  fautesDeRemuneration([{ chemin: "src/content/recrutement/temoin.ts", texte }]).map(
    (f) => f.famille,
  );

describe("REQ-JUR-001, REQ-JUR-002, REQ-JUR-019, REQ-JUR-041 — le dépôt tel qu'il est", () => {
  it("REQ-JUR-019 — le dépôt réel est sans faute, sur un périmètre NON vide", () => {
    const surfaces = lireSurfacesPubliques();
    expect(surfaces.length).toBeGreaterThan(10);
    expect(fautesDeRemuneration(surfaces)).toEqual([]);
  });

  it("REQ-JUR-019 : les e-mails privés sont hors de la copy publique, les pages y sont toutes", () => {
    const publiques = lireSurfacesPubliques().map((s) => s.chemin);
    const toutes = lireSurfacesApporteur().map((s) => s.chemin);
    expect(publiques.some((c) => c.startsWith("src/lib/email/templates/"))).toBe(false);
    // Rien d'autre n'est retiré : seules les surfaces d'e-mail manquent à l'appel.
    expect(toutes.filter((c) => !publiques.includes(c)).every((c) => c.includes("/email/"))).toBe(
      true,
    );
    expect(publiques.length).toBeGreaterThan(10);
  });
});

describe("REQ-JUR-019 — une rémunération ferme rougit", () => {
  it.each([
    "Vous touchez 250 € par journée",
    "Une commission de 10 % sur chaque audit.",
    "answer: `${commission(1)} pour vous.`",
    "Le montant, par journée vendue.",
    "Plus vous en présentez, plus vous gagnez.",
  ])("REQ-JUR-019 — TÉMOIN ROUGE : « %s »", (texte) => {
    expect(temoin(texte)).toContain<FamilleRemuneration>("remuneration_ferme");
  });

  it("REQ-JUR-019 — TÉMOIN ROUGE : « jusqu'à 500 € » seul (un plafond n'est pas indicatif)", () => {
    expect(temoin("Vous touchez jusqu'à 500 € par journée.")).toContain<FamilleRemuneration>(
      "remuneration_ferme",
    );
  });

  it("REQ-JUR-019 — TÉMOIN ROUGE : la même formule, la mention à TROIS lignes", () => {
    const texte = ["Vous touchez 250 € par journée", "", "", "à titre indicatif"].join("\n");
    expect(temoin(texte)).toContain<FamilleRemuneration>("remuneration_ferme");
  });
});

describe("REQ-JUR-001 — la mention indicative lève la faute, dans la phrase servie", () => {
  it.each([
    "À titre indicatif, vous touchez 250 € par journée",
    "Vous touchez 250 € par journée, selon profil.",
    "Vous touchez à partir de 250 € par journée.",
    "Vous touchez 250 € par journée, selon votre profil.",
  ])("REQ-JUR-001 — CONTRE-TÉMOIN, mention dans la ligne : « %s »", (texte) => {
    expect(temoin(texte)).toEqual([]);
  });

  it("REQ-JUR-001 — CONTRE-TÉMOIN : la mention sur la ligne voisine (JSX coupé)", () => {
    expect(temoin(["Vous touchez 250 € par journée", "à titre indicatif."].join("\n"))).toEqual([]);
    expect(temoin(["À titre indicatif :", "vous touchez 250 € par journée"].join("\n"))).toEqual(
      [],
    );
  });

  it("REQ-JUR-001 — CONTRE-TÉMOIN : un commentaire de code n'est pas lu", () => {
    const texte = [
      "// Vous touchez 250 € par journée — ancienne formule, retirée",
      " * commission de 10 % : exemple de ce qu'il ne faut plus écrire",
      "/* kit de vente */",
    ].join("\n");
    expect(temoin(texte)).toEqual([]);
  });

  it("REQ-JUR-002 — une ligne commentée ne sert pas de mention indicative", () => {
    const texte = ["// à titre indicatif", "Vous touchez 250 € par journée"].join("\n");
    expect(temoin(texte)).toContain<FamilleRemuneration>("remuneration_ferme");
  });
});

describe("REQ-JUR-019 — un revenu illimité rougit, MÊME dit indicatif", () => {
  it.each([
    "À titre indicatif, 500 € par journée, sans plafond.",
    "Plus vous en présentez, plus vos commissions progressent — sans aucune limite",
    "Il n’y a pas de plafond, à titre indicatif.",
    "As an indication, €500 per day, uncapped.",
    "As a guide, your commissions grow — with no cap.",
    "Des revenus illimités, selon votre profil",
    "Un revenu illimité",
    "Un revenu illimité.",
    "Potentiel illimité, à titre indicatif",
    "Pas de limite à vos commissions",
    "Limitless earnings, as a guide",
    "Commissions without limit",
    "Commissions with no ceiling",
    "Des commissions sans maximum",
  ])("REQ-JUR-019 — TÉMOIN ROUGE : « %s »", (texte) => {
    expect(temoin(texte)).toContain<FamilleRemuneration>("revenu_illimite");
  });

  it("REQ-JUR-019 — CONTRE-TÉMOIN : « sans limite d'âge » n'est pas un revenu illimité", () => {
    expect(temoin("L'activité est ouverte à tous, sans limite d'âge.")).not.toContain(
      "revenu_illimite",
    );
    expect(temoin("Aucune limite d&apos;âge")).not.toContain("revenu_illimite");
  });
});

describe("REQ-JUR-001 — ni promesse sans risque, ni AI Act trop large", () => {
  it.each([
    "Zéro risque, accompagnement, commissions rapides et mensuelles",
    "Zero risk, support, fast monthly commissions",
    "Une activité sans risque pour vous",
    "Risk-free, from day one",
    "Aucun risque financier pour vous",
    "Un risque nul pour l'apporteur",
    "A no-risk opportunity",
    "A zero-risk opportunity",
    "Earn without risk",
    "No financial risk for you",
  ])("REQ-JUR-001 — TÉMOIN ROUGE, promesse sans risque : « %s »", (texte) => {
    expect(temoin(texte)).toContain<FamilleRemuneration>("promesse_sans_risque");
  });

  it.each([
    "L'AI Act l'impose aux PME, ETI et grands groupes : 474 communes au choix.",
    "L'AI Act oblige PME, ETI et grands groupes à former leurs équipes à l'IA.",
    "The AI Act mandates it for SMEs, mid-caps and large groups.",
    "The AI Act requires small businesses, SMEs, mid-caps and large groups to train their teams.",
    "Les PME doivent se conformer à l'AI Act.",
    "PME, ETI et grands groupes sont tenus de respecter l'AI Act",
    "SMEs must comply with the AI Act.",
    "Quel que soit le secteur et quelle que soit la taille : l'obligation de formation de l'AI Act concerne tout le monde.",
    "De la PME au grand groupe : l'AI Act ne fait pas de tri entre les tailles ni entre les secteurs.",
    "The AI Act applies to all companies.",
    "Every business is covered by the AI Act.",
  ])("REQ-JUR-001 — TÉMOIN ROUGE, AI Act trop large : « %s »", (texte) => {
    expect(temoin(texte)).toContain<FamilleRemuneration>("ai_act_trop_large");
  });

  it.each([
    "Aucun frais d'entrée ni engagement de volume, accompagnement",
    "L'AI Act crée des obligations pour les entreprises qui utilisent l'IA.",
    "The AI Act sets obligations for companies that use AI.",
    "Quel que soit le secteur et quelle que soit la taille, une entreprise qui utilise l'IA a des obligations au titre de l'AI Act.",
    "De la PME au grand groupe, chaque taille a ses clients.",
  ])("REQ-JUR-001 — CONTRE-TÉMOIN : « %s »", (texte) => {
    expect(temoin(texte)).toEqual([]);
  });
});

describe("REQ-JUR-019 — aucune projection de revenu mensuel", () => {
  it.each([
    "{scenarios[1]!.n} formations d'1 jour vendues dans le mois, à titre indicatif",
    "10 formations vendues dans le mois = 5 000 € de commissions",
    "5 formations 1 j / mois",
    "20 formations par mois",
    "10 one-day trainings sold in a month, as a guide",
    "5 trainings 1 d / month",
  ])("REQ-JUR-019 — TÉMOIN ROUGE, même dit indicatif : « %s »", (texte) => {
    expect(temoin(texte)).toContain<FamilleRemuneration>("projection_mensuelle");
  });

  it.each([
    "1 journée de formation vendue et encaissée = {formatAmount(perFormation)} de commission, à titre indicatif.",
    "commissions versées chaque mois, à l'encaissement",
    "Ce sont des exemples de calcul, pas une promesse : vos revenus dépendent de vos ventes.",
  ])("REQ-JUR-019 — CONTRE-TÉMOIN : « %s »", (texte) => {
    expect(temoin(texte)).not.toContain("projection_mensuelle");
  });
});

describe("REQ-JUR-041 — « kit de vente » est banni", () => {
  it("REQ-JUR-041 — TÉMOIN ROUGE : « kit de vente », même avec une mention indicative", () => {
    expect(temoin("Recevez votre kit de vente, à titre indicatif.")).toContain<FamilleRemuneration>(
      "kit_de_vente",
    );
  });

  it("REQ-JUR-041 — CONTRE-TÉMOIN : « le kit » seul passe", () => {
    expect(temoin('cta: "Recevoir le kit"')).toEqual([]);
  });
});

describe("REQ-JUR-019 — aucun balisage structuré de rémunération", () => {
  it.each([
    "incentiveCompensation: `${commission(1)} par journée, à titre indicatif`,",
    'baseSalary: { "@type": "MonetaryAmount", currency: "EUR" },',
    '"@type": "JobPosting",',
  ])("REQ-JUR-019 — TÉMOIN ROUGE : « %s »", (texte) => {
    expect(temoin(texte)).toContain<FamilleRemuneration>("jsonld_remuneration");
  });
});

// ── Élargissement après les relectures securite et exactitude de #1232 ─────────────────────────
// Face ROUGE réelle mesurée avant correction : 42 fautes sur le dépôt (24 de la relecture
// securite, 18 de plus avec les taux, l'impératif et le revenu illimité).

describe("REQ-JUR-019 — un montant ou un taux affiché sans mention rougit, verbe ou pas", () => {
  it.each([
    "500 € par journée payée",
    "500 € pour vous par journée de formation IA signée et payée",
    "<span>{montantJournee}</span>",
    "<p>{commission(1)} par journée</p>",
    "You receive your commission",
    "€500 per paid day",
    "Gagnez 500 € par formation vendue",
    "30 % de commission sur chaque audit",
    "title: `Référent · ${jour} € par journée payée`",
  ])("REQ-JUR-019 — TÉMOIN ROUGE : « %s »", (texte) => {
    expect(temoin(texte)).toContain<FamilleRemuneration>("remuneration_ferme");
  });

  it.each(["vos revenus n'ont aucune limite", "Revenus déplafonnés", "your income is uncapped"])(
    "REQ-JUR-019 — TÉMOIN ROUGE, revenu illimité : « %s »",
    (texte) => {
      expect(temoin(texte)).toContain<FamilleRemuneration>("revenu_illimite");
    },
  );

  it("REQ-JUR-019 — TÉMOIN ROUGE : `{montantJournee}` seul sur sa ligne, en JSX", () => {
    const texte = ['<span className="text-fg">', "  {montantJournee}", "</span>"].join("\n");
    expect(temoin(texte)).toContain<FamilleRemuneration>("remuneration_ferme");
  });

  it("REQ-JUR-019 — TÉMOIN ROUGE : la mention à TROIS lignes du héro ne compte pas", () => {
    const texte = ["<p>À titre indicatif</p>", "<p>", "<span>", "{montantJournee}"].join("\n");
    expect(temoin(texte)).toContain<FamilleRemuneration>("remuneration_ferme");
  });
});

describe("REQ-JUR-001 — les mêmes lignes, la mention indicative dans la fenêtre", () => {
  it.each([
    "500 € par journée payée, à titre indicatif",
    "À titre indicatif, 500 € pour vous par journée de formation IA payée",
    "<span>{montantJournee}</span> <span>À titre indicatif</span>",
    "<p>{commission(1)} par journée, à titre indicatif</p>",
    "You receive your commission, as a guide",
    "€500 per paid day, as a guide",
    "Gagnez 500 € par formation vendue, à titre indicatif",
    "À titre indicatif, 30 % de commission sur chaque audit",
  ])("REQ-JUR-001 — CONTRE-TÉMOIN : « %s »", (texte) => {
    expect(temoin(texte)).toEqual([]);
  });

  it("REQ-JUR-001 — CONTRE-TÉMOIN : le héro, « À titre indicatif » à deux lignes du chiffre", () => {
    const texte = [
      '<p className="flex">',
      '  <span className="text-mocha-fg-muted">À titre indicatif</span>',
      '  <span className="text-mocha-fg">',
      "    {montantJournee}",
      "  </span>",
    ].join("\n");
    expect(temoin(texte)).toEqual([]);
  });

  it("REQ-JUR-001 — CONTRE-TÉMOIN : un e-mail reçu n'est pas une rémunération", () => {
    expect(temoin("You receive a confirmation email, then an invitation.")).toEqual([]);
    expect(temoin("Vous recevez un e-mail de confirmation.")).toEqual([]);
  });
});

describe("REQ-JUR-019 — les exceptions nommées ne couvrent que LEUR ligne", () => {
  const exception = {
    chemin: "src/content/recrutement/temoin.ts",
    ligne: "Aucune limite de places pour candidater",
    motif: "témoin : une limite de places n'est pas un revenu",
  };
  const juge = (chemin: string, texte: string) =>
    fautesDeRemuneration([{ chemin, texte }], [exception]).map((f) => f.famille);

  it("REQ-JUR-019 — l'exception lève SA ligne, dans SON fichier", () => {
    expect(juge(exception.chemin, "Aucune limite de places pour candidater.")).toEqual([]);
  });

  it("REQ-JUR-019 — TÉMOIN ROUGE : la même phrase dans un AUTRE fichier rougit", () => {
    const autre = "src/content/recrutement/autre.ts";
    expect(juge(autre, "Aucune limite de places pour candidater.")).toEqual(["revenu_illimite"]);
  });

  it("REQ-JUR-019 — TÉMOIN ROUGE : une SECONDE occurrence dans le même fichier rougit", () => {
    const phrase = "Aucune limite de places pour candidater.";
    const texte = [phrase, "", "", "", phrase].join("\n");
    expect(juge(exception.chemin, texte)).toEqual(["revenu_illimite"]);
  });

  it("REQ-JUR-019 — TÉMOIN ROUGE : la promesse de la ligne voisine n'est pas couverte", () => {
    const texte = ["Aucune limite de places pour candidater.", "Vos revenus n'ont aucune limite."];
    expect(juge(exception.chemin, texte.join("\n"))).toEqual(["revenu_illimite"]);
  });

  it("REQ-JUR-019 — TÉMOIN ROUGE : une exception qui ne trouve plus sa ligne est périmée", () => {
    expect(juge(exception.chemin, "Une autre copy.")).toEqual(["exception_perimee"]);
  });

  it("REQ-JUR-019 — chaque exception du dépôt nomme un fichier lu et un motif", () => {
    const chemins = lireSurfacesPubliques().map((s) => s.chemin);
    expect(EXCEPTIONS_REMUNERATION.length).toBeGreaterThan(0);
    for (const e of EXCEPTIONS_REMUNERATION) {
      expect(chemins, e.chemin).toContain(e.chemin);
      expect(e.motif.length, e.ligne).toBeGreaterThan(10);
    }
  });
});

// ── E-mails envoyés AVANT la signature du contrat d'apporteur ──────────────────
// Hors de la garde publique (voir son en-tête) ; mais un barème envoyé AVANT la signature n'est
// pas encore celui d'un contrat : il se dit indicatif. Tout gabarit apporteur ou commercial est
// classé ici, avant ou après la signature ; un nouveau gabarit non classé rougit.
const GABARITS = "src/lib/email/templates";
const GABARITS_AVANT_SIGNATURE = [
  "_kit-apporteur.tsx", // le kit, joint aux e-mails du tunnel
  "apporteur-echange.tsx", // confirmation de l'échange de 15 minutes
  "apporteur-invitation-appel.tsx", // invitation à l'échange
  "apporteur-invitation-relance.tsx", // relance de l'invitation
  "apporteur-issue-echange.tsx", // issue de l'échange : « nous vous enverrons votre contrat »
  "candidature-commercial-confirmee.tsx", // candidature reçue
  "candidature-commercial-recap.tsx", // récapitulatif de la candidature
  "lead-apporteur-recu.tsx", // formulaire court reçu (tunnel Facebook)
  "lead-apporteur-relance.tsx", // relances du formulaire court
] as const;
/**
 * Gabarits envoyés après la signature du contrat d'apporteur.
 * `apporteur-demarrage.tsx` (démarrage manuel, 2026-10-05) : les e-mails d'avant signature
 * (lien du dossier, pièces) ne citent aucun montant ; le seul barème cité l'est dans « contrat
 * signé », envoyé une fois le contrat signé — il est alors celui du contrat, pas indicatif.
 */
const GABARITS_APRES_SIGNATURE: readonly string[] = ["apporteur-demarrage.tsx"];
const CITE_UN_MONTANT =
  /commission\s*\(|€|\d\s?%|\}\s?%|COMMISSION_FORMATION|getCommissionById|COMMERCIAL_COMMISSIONS/;
const MENTION = /à\s+titre\s+indicatif/i;

function gabaritsSansMention(fichiers: ReadonlyArray<{ nom: string; texte: string }>): string[] {
  return fichiers
    .filter(({ texte }) => {
      const servi = texte
        .split("\n")
        .filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l))
        .join("\n");
      return CITE_UN_MONTANT.test(servi) && !MENTION.test(servi);
    })
    .map((f) => f.nom);
}

describe("REQ-JUR-001 — un e-mail d'avant signature qui cite un barème le dit indicatif", () => {
  const lire = (nom: string) => ({ nom, texte: readFileSync(path.join(GABARITS, nom), "utf8") });

  it("REQ-JUR-001 — la liste nommée n'est pas vide, et chaque gabarit existe", () => {
    expect(GABARITS_AVANT_SIGNATURE.length).toBeGreaterThan(0);
    for (const nom of GABARITS_AVANT_SIGNATURE) {
      expect(existsSync(path.join(GABARITS, nom)), nom).toBe(true);
    }
  });

  it("REQ-JUR-001 — tout gabarit apporteur ou commercial est classé avant ou après", () => {
    const classes = new Set<string>([...GABARITS_AVANT_SIGNATURE, ...GABARITS_APRES_SIGNATURE]);
    const apporteurs = readdirSync(GABARITS).filter(
      (n) => /apporteur|commercial/.test(n) && /\.tsx?$/.test(n),
    );
    expect(apporteurs.filter((n) => !classes.has(n))).toEqual([]);
  });

  it("REQ-JUR-001 — chaque gabarit d'avant signature qui cite un montant porte la mention", () => {
    const fichiers = GABARITS_AVANT_SIGNATURE.map(lire);
    expect(fichiers.filter((f) => CITE_UN_MONTANT.test(f.texte)).length).toBeGreaterThan(0);
    expect(gabaritsSansMention(fichiers)).toEqual([]);
  });

  it("REQ-JUR-001 — TÉMOIN ROUGE : un gabarit synthétique sans la mention rougit", () => {
    const texte = "formation: (eur: number) => `Formation : ${eur} € HT par journée.`,";
    expect(gabaritsSansMention([{ nom: "temoin.tsx", texte }])).toEqual(["temoin.tsx"]);
    const commente = `// à titre indicatif\n${texte}`;
    expect(gabaritsSansMention([{ nom: "temoin.tsx", texte: commente }])).toEqual(["temoin.tsx"]);
  });

  it("REQ-JUR-001 — CONTRE-TÉMOIN : le même gabarit avec la mention passe", () => {
    const texte = '"Le barème ci-dessous est donné à titre indicatif.",\n`${eur} € HT par journée`';
    expect(gabaritsSansMention([{ nom: "temoin.tsx", texte }])).toEqual([]);
  });
});
