// 🔴 Audit réservation 2026-08-26 (relevé P1 / plainte de Will : « plein de
// boutons qui apparaissent même si ça ne correspond pas au client »).
//
// Le bloc « Par stagiaire » de DocumentsSection affichait ses 8 boutons SANS
// consulter `pertinence-piece` : « Contrat de formation (particulier) » proposé
// sur un dossier entreprise, « Kit CPF » sur un financement direct. Le bloc
// Documents de session, lui, filtrait déjà.
//
// Cette garde est STRUCTURELLE (source, pas rendu) : elle lit le composant et
// exige que chaque type nominatif rendu par un EnrollmentDocButton passe par
// `pieceMiseEnAvant(...)` dans son bloc. Un test de rendu aurait exigé de
// monter tout l'îlot (actions serveur, contexte) pour re-dire la même chose.
// VUE ROUGIR : sur l'arbre d'avant le correctif, le bloc stagiaire ne contenait
// aucun appel à pieceMiseEnAvant → le spec échoue (vérifié par mutation :
// retirer le filtre du bloc le fait re-rougir).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  join(process.cwd(), "src/components/admin/qualiopi/DocumentsSection.tsx"),
  "utf8",
);

/** Le bloc « Par stagiaire » : de son titre à la section suivante. */
function blocParStagiaire(): string {
  const debut = SOURCE.indexOf(">Par stagiaire<");
  const fin = SOURCE.indexOf(">Financier<");
  expect(debut, "le bloc Par stagiaire existe").toBeGreaterThan(-1);
  expect(fin, "le bloc Financier suit").toBeGreaterThan(debut);
  return SOURCE.slice(debut, fin);
}

describe("DocumentsSection — le bloc Par stagiaire trie par pertinence", () => {
  it("filtre ses boutons par pieceMiseEnAvant (attendues en avant)", () => {
    const bloc = blocParStagiaire();
    expect(bloc).toMatch(/pieceMiseEnAvant\(/);
  });

  it("replie les pièces hors cas au lieu de les masquer, avec leur motif", () => {
    const bloc = blocParStagiaire();
    // Le repli est un <details> qui annonce son contenu, jamais un masquage dur.
    expect(bloc).toMatch(/<details/);
    expect(bloc).toMatch(/motifRepli\(/);
    expect(bloc).toMatch(/Autres pièces \(/);
  });

  it("chaque type sensible au financement est déclaré dans le tri", () => {
    const bloc = blocParStagiaire();
    // Les pièces dont la pertinence dépend du financement ou du type de client :
    // les proposer sans tri est exactement le défaut corrigé.
    for (const type of ["contrat", "kit_cpf", "kit_france_travail"]) {
      expect(bloc, `type ${type} présent dans le bloc trié`).toContain(`type: "${type}"`);
    }
  });

  it("la fiche d'adaptation reste toujours proposée (hors tri)", () => {
    const bloc = blocParStagiaire();
    // L'adaptation individuelle ne dépend pas du financement (A16/A9).
    expect(bloc).toContain("Fiche d'adaptation individuelle");
  });
});
