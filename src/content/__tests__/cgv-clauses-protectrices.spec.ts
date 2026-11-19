/**
 * Garde-fou — clauses limitatives des CGV (2026-08-14, réécrit pour la v3 du 19 novembre 2026).
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

/** Retrouve l'article N de la v3 (titre « Article N. … », préfixe « TITRE … · » accepté). */
function article(n: number): string {
  const found = CGV_FR.sections.find((s) => new RegExp(`(^|· )Article ${n}\\. `).test(s.title));
  if (!found) {
    throw new Error(
      `Article ${n} des CGV introuvable. Titres présents :\n` +
        CGV_FR.sections.map((s) => `  - ${s.title}`).join("\n"),
    );
  }
  return found.body;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Présence des clauses protectrices (une assertion par protection, article v3 cité)
// ─────────────────────────────────────────────────────────────────────────────

describe("CGV v3 — clauses limitatives présentes", () => {
  it("délais : estimatifs, prolongés de plein droit ; retard > 30 jours + 15 jours de mise en demeure (v3 art. 12)", () => {
    // Trou comblé : un retard restait indemnisable au droit commun (1231-1 C. civ.).
    const b = article(12);
    expect(b).toMatch(/Les délais du devis sont estimatifs/);
    expect(b).toMatch(/prolongés de plein droit/);
    expect(b).toMatch(/plus de 30 jours, persistant 15 jours après une mise en demeure/);
    expect(b).toMatch(/sans indemnité minimale due par lui/);
  });

  it("sauvegarde préalable du Client + sécurité de ses propres systèmes (v3 art. 12.4)", () => {
    // Trou comblé : une perte de données pendant une intervention était arbitrée
    // au seul détriment d'Axion-IA, qui n'a pas la maîtrise de l'état antérieur.
    const b = article(12);
    expect(b).toMatch(/sauvegarde complète et vérifiée/);
    expect(b).toMatch(/responsable de la sécurité de ses propres systèmes/);
  });

  it("services et fournisseurs tiers : à la charge du Client, hausse de prix ni force majeure ni faute d'Axion-IA (v3 art. 29, 38.5, 39.3)", () => {
    // Trou comblé : la force majeure ne couvre pas ces événements — l'art. 1218
    // exige l'imprévisibilité ET l'irrésistibilité, qu'une hausse de tarif d'API
    // ou une dépréciation de modèle n'ont pas.
    expect(article(29)).toMatch(
      /Le Client les souscrit à son nom, accepte les conditions des tiers et les paie directement/,
    );
    expect(article(38)).toMatch(
      /Axion-IA ne répond pas :[\s\S]*des Services extérieurs souscrits par le Client/,
    );
    expect(article(39)).toMatch(
      /L'évolution d'un modèle d'IA ou la hausse de prix d'un fournisseur ne constituent pas/,
    );
  });

  it("IA : nature probabiliste reconnue, aucune garantie d'exactitude (v3 art. 26)", () => {
    // Trou comblé : le Client ne reconnaissait NULLE PART que le résultat peut
    // être faux. « Le résultat était faux » n'a pas la même portée selon que le
    // contrat l'annonce ou non.
    const b = article(26);
    expect(b).toMatch(/fonctionne par probabilités/);
    expect(b).toMatch(/résultats inexacts, incomplets ou inadaptés/);
    expect(b).toMatch(/validation humaine/);
    expect(b).toMatch(/Axion-IA ne répond pas de l'inexactitude ponctuelle d'un résultat/);
    // 🔴 La responsabilité de conception reste : la clause ne devient pas une exonération totale.
    expect(b).toMatch(
      /Elle reste responsable[^.]*d'un défaut de conception, de paramétrage ou de garde-fous/,
    );
  });

  it("propriété intellectuelle : garantie du Client contre les réclamations de tiers (v3 art. 33.1 et 33.4)", () => {
    // Trou comblé : la PI n'était traitée que dans le sens Axion → Client.
    const b = article(33);
    expect(b).toMatch(/Le Client garantit Axion-IA contre toute réclamation d'un tiers/);
    expect(b).toMatch(/contenus produits avec l'IA/);
  });

  it("plafond de responsabilité sur 12 mois, exclusions énumérées, renonciation réciproque (v3 art. 38)", () => {
    // Trou comblé : sans borne temporelle, le plafond grossit indéfiniment sur
    // une relation pluriannuelle. Et une exclusion non énumérée n'en est pas une.
    const b = article(38);
    expect(b).toMatch(/12 mois précédant le fait générateur/);
    expect(b).toMatch(
      /Chaque partie renonce à demander à l'autre la réparation des dommages indirects/,
    );
    for (const prejudice of [
      "perte de chiffre d'affaires",
      "de bénéfice",
      "de clientèle",
      "de chance",
      "perte d'exploitation",
      "atteinte à l'image",
    ]) {
      expect(b).toContain(prejudice);
    }
    // Les brèches que la loi impose de laisser ouvertes.
    expect(b).toMatch(/faute lourde ou de dol, de dommage corporel/);
  });

  it("obligation de moyens : les chiffres commerciaux ne sont pas contractuels (v3 art. 16.2)", () => {
    const b = article(16);
    expect(b).toMatch(/obligation de moyens/);
    expect(b).toMatch(/Elle ne s'engage sur aucun résultat chiffré/);
    // 🔴 C'est cette phrase qui neutralise un ROI promis avant la commande.
    expect(b).toMatch(
      /gains, économies et indicateurs évoqués avant la commande sont des hypothèses/,
    );
  });

  it("signalement sous 90 jours : ne prive le Client d'aucune action ; prescription réservant dol et faute lourde (v3 art. 58)", () => {
    // La v3 ABANDONNE exprès la forclusion de 90 jours de l'ancien texte : le délai de 90 jours
    // conditionne la garantie commerciale et les avoirs, jamais l'action elle-même.
    const b = article(58);
    expect(b).toMatch(
      /dans les 90 jours suivant le jour où il l'a connue ou aurait dû la connaître/,
    );
    expect(b).toMatch(/il ne prive le Client d'aucune action/);
    expect(b).not.toMatch(/forclos/);
    // Prescription d'un an entre professionnels, sans effet en cas de dol ou de faute lourde.
    expect(b).toMatch(/par un an[^.]*article 2254 du Code civil/);
    expect(b).toMatch(/Il ne s'applique pas en cas de dol ou de faute lourde/);
  });

  it("force majeure : sortie symétrique au-delà de 60 jours (v3 art. 39.2)", () => {
    // Trou comblé : « si l'empêchement devient définitif » laissait sans issue
    // l'empêchement long mais non définitif.
    const b = article(39);
    expect(b).toMatch(/plus de 60 jours, chaque partie peut résilier par écrit sans indemnité/);
  });

  it("assurance : le Client est assuré pour son activité et l'usage des livrables (v3 art. 40)", () => {
    // La v3 ne reprend ni « notoirement solvable » ni « justifier sur demande » de l'ancien texte.
    expect(article(40)).toMatch(/Le Client est assuré pour les risques liés à son activité/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1 bis. Produits numériques (v3 art. 52 : professionnels seulement)
// ─────────────────────────────────────────────────────────────────────────────

describe("CGV v3 — produits numériques", () => {
  it("le champ d'application les connaît (v3 art. 2.1)", () => {
    // Trou comblé : le régime pouvait exister en section dédiée tout en étant
    // absent de l'objet des CGV — donc sans rattachement au contrat.
    expect(article(2)).toMatch(/produits numériques/);
  });

  it("nature : fiche produit, format, outils compatibles, durée d'accès (v3 art. 52.1)", () => {
    const b = article(52);
    expect(b).toMatch(/La fiche produit décrit le produit/);
    expect(b).toMatch(/son format, les outils et versions compatibles et la durée d'accès/);
  });

  it("livraison et durée d'accès : sous 24 heures, licence bornée à 12 mois pour les accès en ligne (v3 art. 52.2 et 52.4)", () => {
    const b = article(52);
    expect(b).toMatch(/L'accès est fourni sous 24 heures après le paiement/);
    expect(b).toMatch(/à défaut : 12 mois\) pour les accès en ligne/);
  });

  it("vente aux consommateurs : abandonnée par la v3 — professionnels seulement, pas de rétractation (v3 art. 2.2 et 52.6)", () => {
    // 🔴 DÉCISION v3 : l'ancien texte organisait la vente en ligne aux particuliers (prix TTC,
    // renonciation à rétractation recueillie par case distincte, garantie légale de conformité).
    // La v3 ne vend qu'à des professionnels : ces protections consommateur n'ont plus d'objet.
    // Si Axion-IA rouvre un jour la vente aux particuliers, ce cas DOIT rougir avec l'art. 2.2.
    expect(article(2)).toMatch(/Axion-IA contracte exclusivement avec des professionnels/);
    expect(article(2)).toMatch(/Axion-IA ne contracte pas avec des consommateurs/);
    const b = article(52);
    expect(b).toMatch(
      /Le Client professionnel qui commande en ligne n'a pas de droit de rétractation/,
    );
    expect(b).toMatch(
      /aucun remboursement n'est dû après téléchargement ou premier accès, hors articles 52\.4 et 52\.5/,
    );
    expect(b).toMatch(
      /Le recours du Client professionnel se limite au remplacement ou au remboursement/,
    );
  });

  it("le régime formation est écarté des règles générales, et la personne physique qui paie elle-même exclue (v3 art. 49.1 et 49.2)", () => {
    // 🔴 L.6353-6 est d'ordre public : aucune case ne rend conforme un paiement
    // immédiat pour une FORMATION vendue à un particulier.
    const b = article(49);
    expect(b).toMatch(
      /la convention l'emporte sur les présentes conditions, et les articles 6\.5, 14, 15 et 42 ne s'appliquent pas/,
    );
    expect(b).toMatch(/Axion-IA ne conclut pas de contrat de formation avec une personne physique/);
    expect(b).toMatch(/aucune somme n'est exigible pendant ce délai/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Clients protégés par une règle particulière (v3 Titre IX) — remplace le « verrou consommateur »
// ─────────────────────────────────────────────────────────────────────────────

describe("CGV v3 — Titre IX : règles propres aux clients protégés", () => {
  const titre9 = article(53);

  /**
   * Chaque clause limitative des CGV et la mention par laquelle l'art. 53.3 la neutralise pour
   * la personne morale non professionnelle. 🔴 AJOUTER UNE CLAUSE LIMITATIVE = AJOUTER UNE LIGNE
   * ICI ET À L'ART. 53.3, dans le même patch.
   */
  const CLAUSES_A_NEUTRALISER: ReadonlyArray<[string, RegExp]> = [
    [
      "plafond et exclusions de responsabilité",
      /le plafond et les exclusions de responsabilité \(article 38\.2 à 38\.5\)/,
    ],
    [
      "réception par silence ou par usage",
      /la réception par silence ou par usage \(article 14\.3\)/,
    ],
    [
      "modification des conditions et des prix",
      /la modification des conditions et des prix \(articles 5\.3 et 8\.3\)/,
    ],
    ["écart des articles 1222 et 1223", /l'écart des articles 1222 et 1223 \(article 11\.3\)/],
    ["clause de tribunal", /la clause de tribunal \(article 60\.2\)/],
  ];

  it.each(CLAUSES_A_NEUTRALISER)("neutralise « %s » nommément (art. 53.3)", (_libelle, motif) => {
    expect(titre9).toMatch(motif);
  });

  it("le petit professionnel démarché hors des locaux d'Axion-IA garde sa rétractation de 14 jours (art. 53.2)", () => {
    expect(titre9).toMatch(
      /délai de rétractation de 14 jours à compter de la formation du contrat/,
    );
    expect(titre9).toMatch(/aucun paiement ni acompte dans les 7 jours suivant la signature/);
  });

  it("le Titre IX prime sur toute clause contraire (art. 2.3 et 53.1)", () => {
    expect(article(2)).toMatch(
      /règles particulières qui priment sur les présentes : voir le Titre IX/,
    );
    expect(titre9).toMatch(/Le présent article l'emporte sur toute clause contraire/);
  });

  it("le plafond de responsabilité renvoie lui-même à ses brèches légales (art. 38.6)", () => {
    // Une double sécurité : même lu isolément, le plafond dit qu'il cède devant l'ordre public.
    expect(article(38)).toMatch(/Ces limites ne s'appliquent pas en cas de faute lourde ou de dol/);
  });

  it("la non-sollicitation est une clause entre professionnels, bornée à 12 mois et aux personnes ayant travaillé 5 jours (art. 54)", () => {
    const b = article(54);
    expect(b).toMatch(/12 mois après sa fin/);
    expect(b).toMatch(/au moins 5 jours à la prestation/);
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
