/**
 * Le dossier d'un candidat — qui peut l'ouvrir, et qui en garde la trace.
 *
 * ## Le défaut mesuré (2026-08-25, cahier D6-1)
 *
 * Trois surfaces servent le dossier d'une personne qui a postulé : la liste des
 * candidatures, son CV, sa photo. Les deux pièces jointes étaient gardées par
 * une liste de rôles écrite à la main. La troisième — celle qui rend le **nom,
 * l'adresse e-mail et le téléphone déchiffrés** — ne testait AUCUN rôle : elle
 * vérifiait la seule présence d'une session.
 *
 * La pièce jointe était donc mieux protégée que l'identité à laquelle elle
 * appartient, et un compte `reader` lisait l'identité complète de chaque
 * candidat.
 *
 * ## Ce que ce fichier verrouille, et pourquoi de cette façon
 *
 * Il ne vérifie pas « les trois fichiers d'aujourd'hui sont corrects » — une
 * liste énumérée à la main prend du retard, et ce dépôt l'a payé quatre fois.
 * Il **dérive la classe** : *tout* fichier qui sert une pièce ou une identité de
 * candidat doit passer par le prédicat commun. Une quatrième surface écrite
 * demain — un export CSV, un aperçu, une API — tombe dans la classe sans que
 * personne ait à penser à ce fichier.
 *
 * 🔑 Chaque extracteur porte son **contre-témoin** : s'il cesse de trouver quoi
 * que ce soit (renommage, déplacement, motif cassé), il ROUGIT au lieu de
 * passer au vert en n'examinant rien. Ce dépôt a payé cette panne cinq fois.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, it, expect } from "vitest";

import { ROLES_ADMIN, ROLES_DOSSIER_CANDIDAT, peutOuvrirDossierCandidat } from "./habilitations";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Le prédicat lui-même — tests NÉGATIFS
// ─────────────────────────────────────────────────────────────────────────────

describe("peutOuvrirDossierCandidat — le refus, pas l'autorisation", () => {
  it("refuse « reader » : c'est le rôle de consultation, il lisait les PII déchiffrées", () => {
    expect(peutOuvrirDossierCandidat("reader")).toBe(false);
  });

  it("refuse « editor » : un rôle purement rédactionnel n'ouvre pas le CV d'une personne", () => {
    // C'est le point exact où l'ancienne liste écrite à la main se trompait :
    // elle admettait `editor` et refusait les deux rôles qui TRAITENT le dossier.
    expect(peutOuvrirDossierCandidat("editor")).toBe(false);
  });

  it("admet le secrétariat et le responsable qualité — ceux qui traitent le dossier", () => {
    // Trier des candidatures est du secrétariat ; le responsable qualité en a
    // besoin pour l'indicateur des compétences.
    expect(peutOuvrirDossierCandidat("secretaire")).toBe(true);
    expect(peutOuvrirDossierCandidat("responsable_qualite")).toBe(true);
  });

  it("refuse par défaut un rôle inconnu, vide, nul ou de casse différente", () => {
    expect(peutOuvrirDossierCandidat(null)).toBe(false);
    expect(peutOuvrirDossierCandidat(undefined)).toBe(false);
    expect(peutOuvrirDossierCandidat("")).toBe(false);
    expect(peutOuvrirDossierCandidat("Admin")).toBe(false);
    expect(peutOuvrirDossierCandidat("responsable-qualite")).toBe(false);
    expect(peutOuvrirDossierCandidat("super_admin ")).toBe(false);
  });

  it("n'ouvre pas le dossier à tout le monde — au moins un rôle admin en est exclu", () => {
    // Contre-témoin du prédicat : une liste qui contiendrait tous les rôles ne
    // cloisonnerait rien tout en passant les tests ci-dessus.
    const exclus = ROLES_ADMIN.filter((r) => !peutOuvrirDossierCandidat(r));
    expect(exclus.length, "le prédicat n'exclut personne — il ne cloisonne rien").toBeGreaterThan(
      0,
    );
    expect(ROLES_DOSSIER_CANDIDAT.length).toBeLessThan(ROLES_ADMIN.length);
  });

  it("chaque rôle de la liste est un rôle admin réel — pas une chaîne inventée", () => {
    // Une faute de frappe dans la liste (`secretaires`) refuserait en silence
    // la personne qu'elle prétend admettre : le prédicat resterait vert.
    for (const role of ROLES_DOSSIER_CANDIDAT) {
      expect(ROLES_ADMIN, `« ${role} » n'existe pas dans ROLES_ADMIN`).toContain(role);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Le cliquet — la CLASSE des surfaces, dérivée du code
// ─────────────────────────────────────────────────────────────────────────────

const RACINE_SRC = join(process.cwd(), "src");

/** Ce qui trahit qu'un fichier sert une pièce ou une identité de candidat. */
const MARQUEURS_DOSSIER_CANDIDAT = [
  "cvStoragePath", // sert le CV
  "photoStoragePath", // sert la photo
  "JobApplicationDetail", // rend le détail d'un dossier
] as const;

/** Le fichier interroge-t-il la table des candidatures ? */
const LIT_LA_TABLE = /prisma\.jobApplication\./;

/** Est-on sur une surface ADMIN — c'est-à-dire un écran ou une route humaine ? */
function estSurfaceAdmin(cheminRelatif: string): boolean {
  const p = cheminRelatif.split(sep).join("/");
  return (
    p.includes("/(admin)/") || p.includes("/admin-job-applications/") || p.startsWith("app/api/")
  );
}

function listerFichiers(dossier: string, acc: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    if (entree === "node_modules" || entree === "__tests__") continue;
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      listerFichiers(chemin, acc);
    } else if (/\.tsx?$/.test(entree) && !/\.(spec|test)\.tsx?$/.test(entree)) {
      acc.push(chemin);
    }
  }
  return acc;
}

interface Surface {
  readonly chemin: string;
  readonly source: string;
}

/**
 * Les surfaces admin qui exposent un dossier de candidat, DÉRIVÉES du code.
 *
 * Deux conditions cumulatives : le fichier lit la table des candidatures ET il
 * porte au moins un marqueur d'exposition (pièce jointe ou détail). La lecture
 * seule ne suffit pas — un compteur de boîte de réception lit la table sans
 * jamais rien montrer de la personne, et n'a rien à faire dans cette classe.
 */
function surfacesDossierCandidat(): Surface[] {
  const surfaces: Surface[] = [];
  for (const chemin of listerFichiers(RACINE_SRC)) {
    const relatif = relative(RACINE_SRC, chemin);
    if (!estSurfaceAdmin(relatif)) continue;
    const source = readFileSync(chemin, "utf8");
    if (!LIT_LA_TABLE.test(source)) continue;
    if (!MARQUEURS_DOSSIER_CANDIDAT.some((m) => source.includes(m))) continue;
    surfaces.push({ chemin: relatif.split(sep).join("/"), source });
  }
  return surfaces;
}

describe("cliquet — aucune surface n'ouvre un dossier de candidat sans le prédicat commun", () => {
  const surfaces = surfacesDossierCandidat();

  it("🔑 CONTRE-TÉMOIN : l'extracteur trouve bien les surfaces connues", () => {
    // Sans ceci, un renommage de dossier ou un marqueur cassé rendrait la suite
    // verte en n'examinant RIEN. Trois surfaces existent au 2026-08-25 : la
    // liste unifiée, le CV, la photo.
    expect(
      surfaces.length,
      "l'extracteur ne trouve plus aucune surface — le motif est cassé, pas le code",
    ).toBeGreaterThanOrEqual(3);

    const chemins = surfaces.map((s) => s.chemin);
    expect(chemins.some((c) => c.endsWith("cv/route.ts"))).toBe(true);
    expect(chemins.some((c) => c.endsWith("photo/route.ts"))).toBe(true);
    expect(chemins.some((c) => c.includes("admin-job-applications/actions.ts"))).toBe(true);
  });

  it.each(surfaces.map((s) => s.chemin))("« %s » passe par peutOuvrirDossierCandidat", (chemin) => {
    const surface = surfaces.find((s) => s.chemin === chemin);
    expect(surface, `surface introuvable : ${chemin}`).toBeDefined();
    expect(
      surface?.source.includes("peutOuvrirDossierCandidat"),
      `${chemin} sert un dossier de candidat sans passer par le prédicat commun — ` +
        "une liste de rôles écrite sur place diverge de ses jumelles",
    ).toBe(true);
  });

  it("les deux routes de pièce jointe n'ont plus AUCUNE liste de rôles écrite à la main", () => {
    // Restreint aux routes : elles ne portent aucune garde d'écriture légitime,
    // donc toute comparaison de rôle littérale y est forcément une liste locale.
    const routes = surfaces.filter((s) => s.chemin.endsWith("route.ts"));
    expect(routes.length, "aucune route de pièce jointe trouvée").toBeGreaterThanOrEqual(2);

    const comparaisonLitterale = /\brole\s*(?:===|!==)\s*["'][a-z_]+["']/;

    // Témoin du détecteur : il DOIT trouver le motif qu'il prétend chercher.
    expect(
      comparaisonLitterale.test('if (role !== "super_admin" && role !== "admin") {'),
      "le détecteur de liste locale ne détecte plus rien",
    ).toBe(true);

    for (const route of routes) {
      expect(
        comparaisonLitterale.test(route.source),
        `${route.chemin} compare un rôle littéral — la liste doit vivre au SSOT`,
      ).toBe(false);
    }
  });

  it("chaque surface laisse une TRACE de l'accès — c'est elle qui le rend défendable", () => {
    // Une liste de rôles dit qui A LE DROIT ; seul le journal dit qui A OUVERT.
    // Devant la CNIL, c'est la seconde question qui est posée.
    for (const surface of surfaces) {
      const journalise =
        surface.source.includes("logActivity") || surface.source.includes("ActivityLog");
      expect(
        journalise,
        `${surface.chemin} ouvre un dossier de candidat sans journaliser l'accès`,
      ).toBe(true);
    }
  });
});
