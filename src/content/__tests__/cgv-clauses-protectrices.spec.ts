/**
 * Garde-fou — clauses limitatives des CGV (Will 2026-08-14).
 *
 * Les CGV publiées sur /conditions-generales sont annexées à la convention de
 * formation, à la convention tripartite et au contrat de formation, et
 * désormais rappelées sur le devis. C'est le seul texte qui limite la
 * responsabilité d'Axion-IA sur les prestations d'audit, d'implémentation, de
 * site web et de coaching.
 *
 * Une clause limitative qui disparaît d'un contenu ne casse RIEN : le site
 * compile, la page rend, les tests passent. Ce fichier est là pour qu'elle
 * rougisse. Chaque assertion correspond à un risque nommé, pas à une
 * formulation : si la rédaction évolue, adapter la regex — pas supprimer le cas.
 *
 * ── Trois familles de vérifications ────────────────────────────────────────
 *   1. PRÉSENCE des clauses protectrices (le trou qu'elles bouchent est en
 *      commentaire au-dessus de chacune).
 *   2. COHÉRENCE du verrou consommateur : toute clause limitative doit être
 *      énumérée dans « Particulier — clauses non opposables au consommateur ».
 *      Opposée à un consommateur, elle serait abusive de plein droit
 *      (art. R.212-1 et R.212-2 C. conso.).
 *   3. ÉTANCHÉITÉ : aucun assureur nommé, aucun n° de police, dans aucun
 *      contenu destiné au client. L'identité de l'assureur se communique sur
 *      demande — elle ne se publie pas, et elle change.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { getLegal } from "@/content/legal";

const SRC = path.resolve(process.cwd(), "src");

const CGV_FR = getLegal("conditions-generales").fr;

/** Corps concaténé de toutes les sections FR, pour les recherches globales. */
const CORPS = CGV_FR.sections.map((s) => `${s.title}\n${s.body}`).join("\n\n");

/** Retrouve une section par son titre exact ; échoue explicitement si absente. */
function section(titre: string): string {
  const found = CGV_FR.sections.find((s) => s.title === titre);
  if (!found) {
    throw new Error(
      `Section CGV « ${titre} » introuvable. Titres présents :\n` +
        CGV_FR.sections.map((s) => `  - ${s.title}`).join("\n"),
    );
  }
  return found.body;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Présence des clauses protectrices
// ─────────────────────────────────────────────────────────────────────────────

describe("CGV — clauses limitatives présentes", () => {
  it("délais : indicatifs, sans pénalité ni indemnité ni résolution, seuil 60 j + 30 j", () => {
    // Trou comblé : un retard restait indemnisable au droit commun (1231-1 C. civ.).
    const b = section("Exécution des prestations et délais");
    expect(b).toMatch(/à titre indicatif/);
    expect(b).toMatch(/ni à pénalité, ni à indemnité, ni à résolution/);
    expect(b).toMatch(/soixante \(60\) jours/);
    expect(b).toMatch(/trente \(30\) jours/);
  });

  it("sauvegarde préalable du Client + sécurité de ses propres systèmes", () => {
    // Trou comblé : une perte de données pendant une intervention était arbitrée
    // au seul détriment d'Axion-IA, qui n'a pas la maîtrise de l'état antérieur.
    const b = section("Sauvegarde préalable et sécurité des systèmes du Client");
    expect(b).toMatch(/sauvegarde complète et vérifiée/);
    expect(b).toMatch(/responsable de la sécurité de ses propres systèmes/);
  });

  it("services et fournisseurs tiers : interruption, hausse tarifaire, dérive de modèle, cyberattaque", () => {
    // Trou comblé : la force majeure ne couvre pas ces événements — l'art. 1218
    // exige l'imprévisibilité ET l'irrésistibilité, qu'une hausse de tarif d'API
    // ou une dépréciation de modèle n'ont pas.
    const b = section("Services, technologies et fournisseurs tiers");
    expect(b).toMatch(/hausse tarifaire/);
    expect(b).toMatch(/évolution des modèles d'intelligence artificielle/);
    expect(b).toMatch(/cyberattaque/);
    expect(b).toMatch(/le Client fait son affaire de la souscription/);
  });

  it("IA : nature probabiliste reconnue, aucune garantie d'exactitude", () => {
    // Trou comblé : le Client ne reconnaissait NULLE PART que le résultat peut
    // être faux. « Le résultat était faux » n'a pas la même portée selon que le
    // contrat l'annonce ou non.
    const b = section("Nature probabiliste des systèmes d'intelligence artificielle");
    expect(b).toMatch(/probabilistes/);
    expect(b).toMatch(/validation humaine/);
    expect(b).toMatch(/ne garantit ni l'exactitude/);
    // 🔴 Les garde-fous techniques réduisent le risque — ils ne le suppriment
    // pas. Retirer cette phrase, c'est recréer une garantie de résultat.
    expect(b).toMatch(/ne valent pas garantie de résultat/);
  });

  it("propriété intellectuelle : garantie du Client contre les réclamations de tiers", () => {
    // Trou comblé : la PI n'était traitée que dans le sens Axion → Client.
    const b = section("Propriété intellectuelle — garanties du Client");
    expect(b).toMatch(/garantit Axion-IA contre toute réclamation/);
    expect(b).toMatch(/contenus générés ou assistés par des systèmes d'intelligence artificielle/);
  });

  it("plafond de responsabilité borné à 12 mois, exclusions énumérées, renonciation réciproque", () => {
    // Trou comblé : sans borne temporelle, le plafond grossit indéfiniment sur
    // une relation pluriannuelle. Et une exclusion non énumérée n'en est pas une.
    const b = section("Limitation de responsabilité — plafond et exclusions");
    expect(b).toMatch(/douze \(12\) mois précédant le fait générateur/);
    expect(b).toMatch(/réciproquement/);
    for (const prejudice of [
      "perte de chiffre d'affaires",
      "perte de clientèle",
      "perte de chance",
      "préjudice d'image",
      "coûts d'interruption d'activité",
      "recours d'un tiers contre le Client",
    ]) {
      expect(b).toContain(prejudice);
    }
    // Les trois brèches que la loi impose de laisser ouvertes.
    expect(b).toMatch(/dol ou de faute lourde/);
    expect(b).toMatch(/dommages corporels/);
  });

  it("obligation de moyens : les chiffres commerciaux ne sont pas contractuels", () => {
    const b = section("Garanties et responsabilité");
    expect(b).toMatch(/aucune obligation de résultat/);
    expect(b).toMatch(/estimations indicatives/);
    // 🔴 La liste des supports compte : c'est elle qui neutralise un ROI promis
    // dans un PDF commercial ou sur une page du site.
    expect(b).toMatch(/supports de présentation/);
    expect(b).toMatch(/contenus du site/);
  });

  it("forclusion 90 jours, réservée au professionnel et réservant dol et vice caché", () => {
    // Trou comblé : une contestation restait recevable 5 ans (art. 2224 C. civ.),
    // sur des prestations dont les traces techniques ne survivent pas à ce délai.
    const b = section("Délai de réclamation sur une prestation");
    expect(b).toMatch(/quatre-vingt-dix \(90\) jours/);
    expect(b).toMatch(/Client professionnel/);
    expect(b).toMatch(/forclose/);
    // 🔴 Sans ces réserves la clause est indéfendable, y compris entre
    // professionnels (déséquilibre significatif, L442-1 C. com.).
    expect(b).toMatch(/ni en cas de dol/);
    expect(b).toMatch(/vice caché/);
    expect(b).toMatch(/ni au Client consommateur/);
  });

  it("force majeure : sortie symétrique au-delà de 60 jours", () => {
    // Trou comblé : « si l'empêchement devient définitif » laissait sans issue
    // l'empêchement long mais non définitif.
    const b = section("Force majeure");
    expect(b).toMatch(/soixante \(60\) jours/);
    expect(b).toMatch(/sans indemnité/);
  });

  it("assurance : solvabilité et justification sur demande", () => {
    const b = section("Assurance");
    expect(b).toMatch(/notoirement solvable/);
    expect(b).toMatch(/justifier sur demande/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cohérence du verrou consommateur
// ─────────────────────────────────────────────────────────────────────────────

describe("CGV — verrou consommateur", () => {
  const verrou = section("Particulier — clauses non opposables au consommateur");

  /**
   * Chaque clause limitative des CGV, et le mot par lequel le verrou la
   * désigne. 🔴 AJOUTER UNE CLAUSE LIMITATIVE = AJOUTER UNE LIGNE ICI ET DANS
   * LE VERROU, dans le même patch. Une clause abusive n'est pas seulement
   * écartée : sa présence fragilise la lecture de tout le contrat et expose à
   * la sanction administrative de la DGCCRF.
   */
  const CLAUSES_A_NEUTRALISER: ReadonlyArray<[string, RegExp]> = [
    ["plafond de responsabilité", /plafonnement de responsabilité/],
    ["exclusions de réparation", /exclusions de réparation/],
    ["forclusion 90 jours", /délai de forclusion/],
    ["exclusion de pénalité de retard", /exclusion de pénalité, d'indemnité ou de résolution/],
    ["garantie PI à la charge du Client", /garantie contre les réclamations de tiers/],
    ["exclusion au titre de la sauvegarde", /sauvegarde préalable des données/],
    ["non-sollicitation", /non-sollicitation/],
  ];

  it.each(CLAUSES_A_NEUTRALISER)("neutralise « %s » nommément", (_libelle, motif) => {
    expect(verrou).toMatch(motif);
  });

  it("subordonne la référence commerciale à l'accord exprès du consommateur", () => {
    expect(verrou).toMatch(/accord exprès et préalable, révocable/);
  });

  it("la section « Limitation de responsabilité » renvoie elle-même au verrou", () => {
    // Une double sécurité : même lu isolément, le plafond dit qu'il ne vaut pas
    // contre un consommateur.
    expect(section("Limitation de responsabilité — plafond et exclusions")).toMatch(
      /ni au Client consommateur/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Étanchéité — aucun assureur nommé dans un contenu client
// ─────────────────────────────────────────────────────────────────────────────

describe("CGV et documents contractuels — l'assureur ne se publie pas", () => {
  /**
   * L'assureur d'Axion-IA change (appel d'offres, résiliation, changement de
   * courtier). Le nommer dans un contenu publié ou dans un PDF contractuel crée
   * une mention à maintenir, fausse dès le premier changement, et sur un
   * support contractuel une mention fausse se retourne contre son auteur.
   * L'engagement pris est le bon : « justifier sur demande ».
   */
  const ASSUREURS =
    /\b(axa|allianz|generali|hiscox|groupama|swiss\s?life|zurich|maaf|matmut|gan|abeille\s?assurances|covea|chubb|beazley)\b/i;
  /** Numéro de police / de contrat : ne figure jamais dans un contenu client. */
  const NUMERO_POLICE = /\b(n°|no\.?|num[ée]ro)\s*(de\s+)?(police|contrat\s+rc)\b/i;

  it("aucun assureur nommé dans les CGV", () => {
    expect(CORPS).not.toMatch(ASSUREURS);
    expect(CORPS).not.toMatch(NUMERO_POLICE);
  });

  it("aucun assureur nommé dans les gabarits de documents contractuels", () => {
    const dir = path.join(SRC, "server", "qualiopi", "documents", "templates");
    const fichiers = readdirSync(dir)
      .filter((f) => /\.tsx?$/.test(f) && !/\.(spec|test)\.tsx?$/.test(f))
      .map((f) => path.join(dir, f))
      .filter((p) => statSync(p).isFile());

    // Le dossier doit être trouvé : un chemin cassé rendrait ce test vert à vide.
    expect(fichiers.length).toBeGreaterThan(5);

    const fautifs = fichiers.filter((p) => ASSUREURS.test(readFileSync(p, "utf8")));
    expect(fautifs.map((p) => path.relative(SRC, p))).toEqual([]);
  });
});
