/**
 * Garde RGPD de `devis_assistant_brouillons` (assistant de devis, fiche S17).
 *
 * Le brouillon est rattaché à une fiche client (`client_id`) : il suit la personne, donc
 * `rgpd: dossier-client` et non `technique`. À poser AVANT l'allumage de S06 (premier code qui
 * écrit la table). Aucune donnée n'est supprimée ni purgée : le modèle n'a ni `retentionUntil`,
 * et l'effacement le déclare en exception motivée au lieu de le muter.
 */
import { describe, expect, it } from "vitest";
import { lire, lireModeles } from "./sources-du-circuit-visio";

const MODELE = "DevisAssistantBrouillon";

/** Motif écrit après `modele: "<nom>",` dans une liste déclarée (texte du source). */
function motifDeclare(source: string): string | null {
  const m = new RegExp(`modele:\\s*"${MODELE}",\\s*motif:\\s*((?:"[^"\\n]*"\\s*\\+?\\s*)+)`).exec(
    source,
  );
  return m ? (m[1] as string) : null;
}

describe("le brouillon de l'assistant de devis suit la personne (S17)", () => {
  const m = lireModeles().find((x) => x.nom === MODELE);

  it("le modèle existe et est annoté `rgpd: dossier-client`, pas `technique`", () => {
    expect(m, "modèle introuvable dans le schéma").toBeDefined();
    expect(m?.annotation).toBe("dossier-client");
  });

  it("l'export art. 15 LIT les brouillons de la fiche (ils ne sont plus exclus)", () => {
    const source = lire("src/lib/rgpd-dossier-client.ts");
    expect(source).toMatch(/\.devisAssistantBrouillon\.findMany\b/);
    expect(motifDeclare(source)).toBeNull();
  });

  it("l'effacement le déclare en exception motivée : jamais supprimé ni purgé", () => {
    const motif = motifDeclare(lire("src/lib/rgpd-erase.ts"));
    expect(motif).toMatch(/jamais supprimé ni purgé/);
  });

  it("aucune purge : pas de colonne de rétention", () => {
    expect(m?.corps ?? "").not.toMatch(/retention/i);
  });
});
