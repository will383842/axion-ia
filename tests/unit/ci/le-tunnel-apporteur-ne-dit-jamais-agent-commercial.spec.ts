// Le tunnel apporteurs ne doit JAMAIS nommer un statut de mandataire.
//
// ── Pourquoi cette garde, et pourquoi elle est étroite ────────────────────
// Le 2026-09-04, la page publique `/apporteur-affaires` répondait, à la
// question « Il faut un statut ? » : « micro-entreprise, AGENT COMMERCIAL ou
// société ». Elle est restée en ligne ainsi.
//
// Ce n'était pas un mot maladroit. « Agent commercial » est un statut défini
// par les articles L.134-1 et suivants du code de commerce, et son critère est
// l'existence d'un MANDAT de négocier au nom du mandant. Or :
//
//   · l'article 1.2 du contrat d'apporteur repose sur l'inverse exact —
//     « L'Apporteur n'est investi d'AUCUN mandat » ;
//   · l'article 8.2 lui interdit de se présenter comme « mandataire, agent ou
//     représentant de la Société » ;
//   · le registre des risques du contrat écrit, à propos de la seule mention
//     de ce statut : « aveu que la qualification d'agent commercial était
//     envisagée : elle DÉTRUIRAIT la portée des articles 1 et 2 ».
//
// La page publique invitait donc les candidats à s'immatriculer sous le statut
// que tout le contrat existe pour écarter — statut qui ouvre en outre un droit
// à indemnité de fin de contrat (L.134-12) auquel on ne peut pas renoncer
// (L.134-16).
//
// ── Ce que cette garde NE fait PAS, délibérément ──────────────────────────
// Elle ne balaie pas tout le lexique de `ANTI-REQUALIFICATION.md`. Ce lexique
// interdit « objectif », « quota », « salaire » — mais le tunnel les emploie
// tous les trois EN LES NIANT : « Aucun objectif, aucun quota », « Pas de
// salaire fixe ». Ces phrases sont PROTECTRICES : elles affirment l'absence de
// ce que la règle proscrit. Une garde qui les compterait comme fautes
// obligerait à les retirer, c'est-à-dire à supprimer la défense pour satisfaire
// le contrôle. C'est le mode de défaillance qu'on veut éviter le plus.
//
// Elle vise donc uniquement les termes qui NOMMENT UN STATUT DE MANDATAIRE, et
// pour lesquels aucune négation n'a de sens dans une page d'acquisition.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCommercialKeywords } from "@/content/recrutement/commercial-offer";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Surfaces LUES ou REÇUES par un candidat apporteur. */
const SURFACES = [
  "src/content/recrutement/tunnel-facebook.ts",
  "src/components/recrutement/FacebookLandingPage.tsx",
  "src/components/recrutement/LeadApporteurForm.tsx",
  "src/components/recrutement/TunnelFacebookShell.tsx",
  // 2026-09-19 — la landing des annonces (Indeed, Leboncoin, Mémorial) disait
  // encore « micro-entreprise, agent commercial ou société » : la faute exacte
  // retirée du tunnel Facebook le 2026-09-04, restée sur la page sœur.
  "src/components/recrutement/PartenaireLandingPage.tsx",
  "src/lib/email/templates/lead-apporteur-recu.tsx",
  "src/lib/email/templates/lead-apporteur-relance.tsx",
  // 2026-09-19 — le kit, la confirmation du dossier et l'invitation à l'échange.
  "src/lib/email/templates/_kit-apporteur.tsx",
  "src/lib/email/templates/candidature-commercial-confirmee.tsx",
  "src/lib/email/templates/apporteur-invitation-appel.tsx",
  "src/app/[locale]/apporteur-affaires/merci/page.tsx",
  // 2026-09-19 (B5, P4) — les pages publiques qui recrutent des apporteurs
  // HORS du tunnel Facebook. Elles disaient toutes « agent commercial » ou
  // « VRP » : dans la FAQ statut de /memo-isere, dans la bande de réassurance
  // des annonces, dans le JSON-LD `JobPosting` que Google lisait. La garde ne
  // lisait que le tunnel Facebook : la même faute vivait à côté, en ligne.
  "src/content/recrutement/partenaire-landings.ts",
  "src/app/[locale]/devenir-commercial-ia/page.tsx",
  "src/app/[locale]/devenir-commercial-ia/candidature/page.tsx",
  "src/app/[locale]/apporteur-affaires-independant-formation-ia-entreprise/page.tsx",
  "src/app/[locale]/memo-isere/page.tsx",
  "src/components/services/devenir-commercial/CommercialProductsEarnings.tsx",
  // 2026-09-21 — TROUVE HORS LISTE : cette page disait « Nous recrutons plus de
  // 200 commerciaux » / « We're hiring 200+ sales reps ». P4 avait retire le
  // balisage `JobPosting` que Google lisait, mais la page continuait de le DIRE
  // en toutes lettres — et aucune garde ne la lisait. Le vocabulaire d'EMBAUCHE
  // est plus lourd que « agent commercial » : il decrit un contrat de travail.
  "src/components/services/devenir-commercial/CommercialProcess.tsx",
];

/**
 * Statuts et qualités de MANDATAIRE. Chacun contredit l'article 1.2 du contrat
 * (« aucun mandat ») et l'article 8.2 (« ne se présente pas comme mandataire,
 * agent ou représentant »).
 */
const TERMES_DE_MANDAT = [
  /agents?\s+commerciaux?/i,
  /agent\s+commercial/i,
  /mandataire/i,
  /VRP\b/,
  /notre\s+force\s+de\s+vente/i,
  /nos\s+commerciaux/i,
  /nos\s+vendeurs/i,
  /votre\s+manager/i,
  /votre\s+responsable/i,
  // 2026-09-21 — le vocabulaire d'EMBAUCHE. Un apporteur est un independant qui
  // recommande : annoncer qu'on le « recrute » decrit un contrat de travail, et
  // c'est la premiere piece qu'un conseil de prud'hommes lirait. Borne aux
  // SURFACES ci-dessus : `/carrieres` recrute de vrais salaries, legitimement.
  //
  // 🔑 CES MOTIFS SONT POSSESSIFS OU EMBAUCHANTS, JAMAIS LE MOT SEUL — et ce
  // n'est pas un detail. La liste francaise ci-dessus interdit « nos
  // commerciaux », « notre force de vente », « nos vendeurs » : elle n'a JAMAIS
  // interdit « commercial » tout court, parce que le mot nomme un metier que
  // les gens tapent dans un moteur de recherche (arbitrage de Will du
  // 2026-09-21 : le mot reste dans le TITRE et dans l'ADRESSE, il part de tout
  // ce qui decrit une relation de travail).
  //
  // Un premier jet interdisait `sales reps?` tout court. Il etait donc PLUS
  // STRICT en anglais qu'en francais, et il accusait deux titres de page dont
  // l'equivalent francais est conserve — « independent AI sales rep » en face
  // de « commercial IA independant ». Une garde qui punit une traduction
  // fidele finit par etre desarmee.
  /\bour\s+sales\s+reps?\b/i,
  /\bwe(?:'|&#x27;|’)?re\s+hiring\b/i,
  // Symetriques de `notre force de vente` et `nos vendeurs` ci-dessus :
  // sans eux, l'anglais serait desormais MOINS strict que le francais —
  // l'inverse exact du desequilibre qu'on vient de corriger.
  /\bour\s+sales\s+force\b/i,
  /\bour\s+sellers\b/i,
  /\bwe\s+are\s+hiring\b/i,
  /\bnous\s+recrutons\b/i,
  /\blooking\s+for\s+(?:hungry\s+)?sales\s+reps?\b/i,
];

/** Retire commentaires de ligne et de bloc : un commentaire n'est pas lu par un candidat. */
function texteVisible(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("le tunnel apporteurs ne nomme jamais un statut de mandataire", () => {
  it("les surfaces auditées existent — sinon la garde ne regarde rien", () => {
    // Un renommage qui sortirait un fichier de cette liste rendrait la garde
    // verte en cessant de le lire. C'est le pire mode de défaillance.
    for (const f of SURFACES) {
      expect(() => readFileSync(path.join(RACINE, f), "utf8"), `${f} introuvable`).not.toThrow();
    }
  });

  it("aucune surface ne nomme un statut ou une qualité de mandataire", () => {
    const fautes: string[] = [];
    for (const f of SURFACES) {
      const visible = texteVisible(readFileSync(path.join(RACINE, f), "utf8"));
      visible.split("\n").forEach((ligne, i) => {
        for (const motif of TERMES_DE_MANDAT) {
          if (motif.test(ligne)) fautes.push(`${f}:${i + 1} — ${ligne.trim().slice(0, 100)}`);
        }
      });
    }
    expect(
      fautes,
      "terme de MANDAT dans une surface vue par un candidat apporteur. L'article 1.2 du contrat " +
        "(« aucun mandat ») et l'article 8.2 (« ni mandataire, ni agent, ni représentant ») en " +
        "dépendent, et le registre des risques du contrat dit qu'une telle mention « détruirait la " +
        "portée des articles 1 et 2 ». Écrire « micro-entreprise ou société »",
    ).toEqual([]);
  });

  it("TÉMOIN — le détecteur voit la faute qui était en ligne, et ignore les négations protectrices", () => {
    const fauteReelle =
      'answer: "Pour facturer ta commission, oui : micro-entreprise, agent commercial ou société."';
    const negationProtectrice = '{ t: "Aucun objectif, aucun quota", d: "Pas de reporting." }';
    const enCommentaire = '// on n\'écrit jamais "agent commercial" ici';

    const voitUneFaute = (s: string) => TERMES_DE_MANDAT.some((m) => m.test(texteVisible(s)));

    expect(voitUneFaute(fauteReelle)).toBe(true);
    // 🔑 Les négations doivent PASSER : les interdire reviendrait à supprimer
    // la défense pour satisfaire le contrôle.
    expect(voitUneFaute(negationProtectrice)).toBe(false);
    expect(voitUneFaute(enCommentaire)).toBe(false);
  });

  it("les mots-clés des pages apporteur ne nomment ni un mandat, ni la vente", () => {
    // `keywords` n'est pas du texte visible, mais les moteurs le lisent : c'est
    // la même déclaration publique que la page, sous une autre forme.
    const motsCles = buildCommercialKeywords("Grenoble", "Isère", "Auvergne-Rhône-Alpes");
    expect(motsCles.length).toBeGreaterThan(20); // témoin : la liste n'est pas vide
    const fautes = motsCles.filter(
      (k) => TERMES_DE_MANDAT.some((m) => m.test(k)) || /\bvend|\bvente/i.test(k),
    );
    expect(fautes).toEqual([]);
  });

  it("TÉMOIN — les fautes retirées des pages ajoutées le 2026-09-19 seraient vues", () => {
    // Copies EXACTES de ce qui était en ligne avant la réécriture : si l'une
    // d'elles revenait, la garde doit rougir. Sans ce témoin, élargir SURFACES
    // prouverait seulement que les fichiers existent, pas qu'on y lit la faute.
    const voitUneFaute = (s: string) => TERMES_DE_MANDAT.some((m) => m.test(texteVisible(s)));
    for (const fauteRetiree of [
      '"Indépendant : micro-entrepreneur, agent commercial, VRP multicartes ou apporteur d\'affaires."',
      '"Statut libre : micro-entreprise, VRP, apporteur",',
      '"Statut libre : micro-entreprise, agent commercial, apporteur",',
      '"Agents commerciaux multicartes",',
      '"Mandataires en immobilier d\'entreprise",',
      'occupationalCategory: "Commercial indépendant · Agent commercial · VRP",',
    ]) {
      expect(voitUneFaute(fauteRetiree), fauteRetiree).toBe(true);
    }
  });
});

/**
 * 🔴 LE TÉMOIN DES MOTIFS EUX-MÊMES (2026-09-21).
 *
 * Ce test existe à cause d'un défaut réel, et sa démonstration est cette PR.
 *
 * Un caractère de contrôle invisible (U+0008, né d'un `\\b` écrit dans un
 * script Python où il désigne le retour arrière) s'était glissé DANS un motif.
 * Le motif ne pouvait matcher aucun texte : la garde passait au vert EN NE
 * CHERCHANT RIEN. Cet octet a traversé l'écriture, deux relectures, une CI
 * verte et un premier passage de la lentille sécurité. Rien, dans le dépôt, ne
 * pouvait le révéler — les deux TÉMOIN plus bas n'exercent que les motifs
 * historiques.
 *
 * 🔑 La leçon n'est pas « attention aux octets » : c'est qu'un lexique de
 * motifs doit prouver qu'il MORD, et pas seulement qu'il ne rougit pas. Les
 * dix cas ci-dessous ont d'abord été vérifiés à la main dans une console — une
 * console se referme, un test reste.
 */
describe("les motifs du lexique mordent vraiment", () => {
  it("aucun motif ne porte de caractère de contrôle", () => {
    // Le défaut exact du 2026-09-21 : un octet invisible rendait le motif
    // inerte sans changer une ligne de code à l'œil nu.
    for (const motif of TERMES_DE_MANDAT) {
      const controles = [...motif.source].filter((c) => c.charCodeAt(0) < 32);
      expect(controles, `le motif ${motif} porte un caractère de contrôle`).toEqual([]);
    }
  });

  it.each([
    "Nos commerciaux couvrent toute la France",
    "Notre force de vente est à votre écoute",
    "Nous recrutons 200 commerciaux",
    "Nous cherchons un agent commercial",
    "Our sales reps are everywhere",
    "We are hiring across France",
    "We're hiring 200+ sales reps",
    "We are looking for hungry sales reps",
  ])("attrape « %s »", (texte) => {
    expect(TERMES_DE_MANDAT.some((m) => m.test(texte))).toBe(true);
  });

  it.each([
    // Conservés par arbitrage de Will du 2026-09-21 : le mot nomme un métier
    // que les gens tapent dans un moteur de recherche. Il reste dans le TITRE
    // et l'ADRESSE ; il part de ce qui décrit une relation de travail.
    "independent AI sales rep, Grenoble-Lyon",
    "Axion-IA sales rep application · 3 minutes, no resume",
    "Commerciaux indépendants",
    "Independent sales reps",
    "Devenez commercial IA partout en France",
    // La formulation de remplacement, qui ne doit surtout pas rougir.
    "Nous développons un réseau de plus de 200 apporteurs d'affaires",
  ])("laisse passer « %s »", (texte) => {
    const fautifs = TERMES_DE_MANDAT.filter((m) => m.test(texte));
    expect(fautifs, `motif trop large : ${fautifs.join(", ")}`).toEqual([]);
  });
});
