/**
 * Chantier Axion Partners — INT-T27-A (REQ-INT-004, REQ-INT-032).
 *
 * LA SORTIE RÉELLE DU PRODUCTEUR, JUGÉE PAR LE CONTRAT PUBLIÉ. `fixtures.v3.json` est ce que
 * l'outbox écrit ; `contracts.v2.json` est ce que Partners accepte. Les tests voisins comparent
 * le producteur à des formes tapées ici, et c'est ainsi qu'un `amountHtCents` a traversé là où
 * le contrat fermé exige `montantHtCents` : chaque paiement aurait été refusé en 422.
 *
 * Le dépôt n'embarque pas de validateur JSON Schema. Celui-ci ne lit QUE les mots-clés que le
 * contrat emploie, et REFUSE tout mot-clé inconnu : le jour où le contrat en ajoute un, ce test
 * rougit au lieu de l'ignorer.
 */
import { describe, expect, it } from "vitest";

import fixtures from "@/server/partners/contrat/fixtures.v3.json";
import { finaliserCorps } from "@/server/partners-sync/outbox";

import { fautes, RACINE, resoudre } from "./contrat-schema";

/**
 * Une fixture est une ligne d'outbox : `emitted_at` n'y est pas encore posé. Le corps jugé est
 * celui que le relais ENVOIE, finalisé par la vraie `finaliserCorps`, jamais complété à la main.
 */
const EVENEMENTS = (
  fixtures as unknown as { evenements: Record<string, unknown>[] }
).evenements.map(
  (e) =>
    JSON.parse(
      finaliserCorps(
        JSON.stringify({ ...e, emitted_at: null }),
        BigInt(e["sequence"] as number),
        new Date(e["occurred_at"] as string),
      ),
    ) as Record<string, unknown>,
);

describe("REQ-INT-004, REQ-INT-032 — la sortie du producteur passe le contrat publié", () => {
  it("chaque fixture, un par un, est conforme à contracts.v3.json", () => {
    expect(EVENEMENTS.length).toBeGreaterThan(10);
    const rapport = EVENEMENTS.map((e) => [e["event_type"], fautes(RACINE, e)] as const).filter(
      ([, f]) => f.length > 0,
    );
    expect(rapport).toEqual([]);
  });

  it("les douze types du contrat v3 sont exercés, devis.emis compris", () => {
    const types = new Set(EVENEMENTS.map((e) => e["event_type"]));
    expect(types.size).toBe(12);
    expect(types.has("devis.emis")).toBe(true);
  });

  it("TÉMOIN — le paiement qui porte `amountHtCents` (la faute trouvée en revue) est refusé", () => {
    const paiement = EVENEMENTS.find((e) => e["event_type"] === "paiement.recu")!;
    const { montantHtCents, ...reste } = paiement["payload"] as Record<string, unknown>;
    const fautif = { ...paiement, payload: { ...reste, amountHtCents: montantHtCents } };
    expect(fautes(RACINE, fautif)).toEqual(
      expect.arrayContaining([
        "$.payload.montantHtCents : requis, absent",
        "$.payload.amountHtCents : hors contrat",
      ]),
    );
  });

  it("REQ-INT-032 — la réponse de la route des coordonnées, contre son `$defs`, jamais retapée", () => {
    const defs = resoudre("#/$defs/api_coordonnees_candidature_reponse");
    const conforme = {
      nom: "Camille Durand",
      prenom: null,
      email: "c@example.test",
      telephone: null,
    };
    expect(fautes(defs, conforme)).toEqual([]);
    expect(fautes(defs, { ...conforme, prenom: "" })).not.toEqual([]);
    expect(fautes(defs, { ...conforme, adresse: "x" })).not.toEqual([]);
  });

  it("TÉMOIN — un mot-clé que le validateur ne lit pas le fait rougir, jamais passer", () => {
    expect(fautes({ maximum: 0 }, 1)).toEqual(["$ : mot-clé non lu par ce validateur (maximum)"]);
  });
});
