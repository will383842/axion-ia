/**
 * Tests — registre-seances.ts
 *
 * Ce module est la SEULE lecture d'audit des signatures AFEST. Ce qu'il doit
 * garantir, et qui se casserait sans bruit :
 *
 *  1. **Les empreintes sont réellement recalculées.** Un registre qui affiche
 *     « chaîne intacte » sans vérifier est pire que pas de registre du tout : il
 *     donne à un contrôle une assurance qu'il ne fonde sur rien. Les fixtures
 *     sont donc hachées par les VRAIES fonctions du socle, jamais par un stub.
 *  2. **Une ligne révoquée reste VISIBLE et sort de la chaîne.** C'est toute la
 *     doctrine append-only : une preuve retirée du décompte n'est pas effacée.
 *  3. **Le maillon terminal est identifié AVANT le clic.** Sans quoi l'écran
 *     proposerait une révocation que le service refuse — un refus qui se lit
 *     comme une panne.
 *  4. **Les chaînes sont séparées par rôle.** Les mélanger ferait rendre
 *     « rupture_chainage » sur trois chaînes parfaitement intactes.
 *  5. **Rien n'est relu depuis le parcours.** Les noms rendus sont ceux FIGÉS
 *     dans la ligne : un écran qui suivrait les corrections ultérieures mentirait
 *     sur ce qui a été signé.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { coachingSeanceSignature: { findMany: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { listerRegistreSeancesAfest } from "./registre-seances";
import {
  calculerSelfHashSeance,
  tupleSeanceDepuisLigne,
  type LigneSeanceSignature,
} from "./seance-signature-hash";

type Mock = ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as { coachingSeanceSignature: { findMany: Mock } };

const COACHING = "11111111-1111-4111-8111-111111111111";
const SEANCE = "22222222-2222-4222-8222-222222222222";

/** Colonne `@db.Date` : Prisma la rend TOUJOURS à minuit UTC. */
const JOUR = new Date("2026-06-10T00:00:00.000Z");

/**
 * Fabrique une ligne dont l'empreinte est VRAIE.
 *
 * 🔴 On passe par `calculerSelfHashSeance` plutôt que par une constante : une
 * empreinte codée en dur se désynchroniserait du sérialiseur au premier
 * changement de tuple, et le test continuerait à passer en vérifiant un hachage
 * que plus personne n'émet.
 */
function ligne(
  over: Partial<LigneSeanceSignature> & { id: string },
): Record<string, unknown> {
  const base: LigneSeanceSignature = {
    coachingId: COACHING,
    compteRenduSeanceId: SEANCE,
    role: "beneficiaire",
    seanceDate: JOUR,
    heureDebut: "09:00",
    heureFin: "11:30",
    formationIntitule: "AFEST — pilotage",
    modulesSnapshot: ["M1"],
    formateurNom: "Simone Blanc",
    signataireNom: "Jean Dupont",
    signataireEmail: null,
    methode: "trace",
    mentionVersion: "afest-v1",
    signatureSha256: null,
    signeAt: new Date("2026-06-10T09:05:00.000Z"),
    prevHash: null,
    selfHash: "provisoire",
    hashVersion: 1,
    ...over,
  };
  const tuple = tupleSeanceDepuisLigne(base);
  if (tuple === null) throw new Error("fixture non recalculable — le test testerait autre chose");
  const selfHash = over.selfHash ?? calculerSelfHashSeance(tuple, base.hashVersion);

  // Les colonnes non scellées que le module lit, avec leurs valeurs par défaut.
  return {
    ...base,
    selfHash,
    dureeMinutes: 150,
    createdAt: new Date("2026-06-10T09:05:10.000Z"),
    recueilliParTrainerId: null,
    imagePurgeeAt: null,
    revokedAt: null,
    revokedById: null,
    revokedMotif: null,
    signatureKey: null,
    mimeType: null,
    sizeBytes: null,
    ipHash: null,
    userAgentSha256: null,
    tokenId: null,
    suppressionPrevueAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.coachingSeanceSignature.findMany.mockReset();
});

describe("listerRegistreSeancesAfest", () => {
  it("rend un registre VIDE — pas null — quand aucune signature n'existe", async () => {
    mockPrisma.coachingSeanceSignature.findMany.mockResolvedValue([]);
    const r = await listerRegistreSeancesAfest(COACHING);
    // Un parcours en régime déclaratif n'a légitimement aucune ligne : le
    // distinguer d'une base injoignable évite d'afficher une fausse anomalie.
    expect(r).not.toBeNull();
    expect(r?.lignes).toEqual([]);
    expect(r?.chaines).toEqual([]);
  });

  it("déclare la chaîne intacte quand les empreintes se recalculent", async () => {
    const a = ligne({ id: "a" });
    const b = ligne({
      id: "b",
      role: "formateur",
      signataireNom: "Simone Blanc",
      prevHash: null,
    });
    mockPrisma.coachingSeanceSignature.findMany.mockResolvedValue([a, b]);

    const r = await listerRegistreSeancesAfest(COACHING);
    expect(r?.chaines).toHaveLength(2);
    expect(r?.chaines.every((c) => c.resultat.valide)).toBe(true);
  });

  it("détecte une empreinte qui ne correspond plus à son contenu", async () => {
    // Falsification typique : le nom est modifié APRÈS coup, l'empreinte reste.
    const intacte = ligne({ id: "a" });
    const falsifiee = { ...intacte, signataireNom: "Quelqu'un d'autre" };
    mockPrisma.coachingSeanceSignature.findMany.mockResolvedValue([falsifiee]);

    const r = await listerRegistreSeancesAfest(COACHING);
    expect(r?.chaines[0]?.resultat.valide).toBe(false);
    expect(r?.chaines[0]?.resultat.anomalies.map((x) => x.type)).toContain("empreinte_invalide");
  });

  it("garde une ligne révoquée VISIBLE mais l'exclut de la chaîne", async () => {
    const revoquee = {
      ...ligne({ id: "a" }),
      revokedAt: new Date("2026-06-11T10:00:00.000Z"),
      revokedMotif: "Erreur de signataire",
    };
    mockPrisma.coachingSeanceSignature.findMany.mockResolvedValue([revoquee]);

    const r = await listerRegistreSeancesAfest(COACHING);
    // Visible : une preuve retirée du décompte n'est pas une preuve effacée.
    expect(r?.lignes).toHaveLength(1);
    expect(r?.lignes[0]?.revocation?.motif).toBe("Erreur de signataire");
    // Hors chaîne : la relecture du service filtre `WHERE revoked_at IS NULL`.
    expect(r?.chaines).toEqual([]);
    // Et surtout : plus aucun formulaire de révocation ne doit être proposé.
    expect(r?.lignes[0]?.dernierMaillon).toBe(false);
  });

  it("n'ouvre la révocation QUE sur le dernier maillon de la chaîne", async () => {
    const premier = ligne({ id: "a" });
    const second = ligne({ id: "b", prevHash: premier["selfHash"] as string });
    mockPrisma.coachingSeanceSignature.findMany.mockResolvedValue([premier, second]);

    const r = await listerRegistreSeancesAfest(COACHING);
    const parId = new Map(r?.lignes.map((l) => [l.signatureId, l]));
    // Révoquer `a` romprait le chaînage de `b` : l'écran doit le dire AVANT le
    // clic, pas laisser le service refuser après.
    expect(parId.get("a")?.dernierMaillon).toBe(false);
    expect(parId.get("b")?.dernierMaillon).toBe(true);
    expect(r?.chaines[0]?.resultat.valide).toBe(true);
  });

  it("sépare les chaînes par rôle — un même parcours, trois chaînes", async () => {
    // Trois rôles, chacun premier maillon de SA chaîne. Les confondre ferait
    // rendre « rupture_chainage » sur trois chaînes intactes.
    const lignes = [
      ligne({ id: "a", role: "beneficiaire" }),
      ligne({ id: "b", role: "formateur", signataireNom: "Simone Blanc" }),
      ligne({ id: "c", role: "tuteur", signataireNom: "Marc Petit" }),
    ];
    mockPrisma.coachingSeanceSignature.findMany.mockResolvedValue(lignes);

    const r = await listerRegistreSeancesAfest(COACHING);
    expect(r?.chaines).toHaveLength(3);
    expect(r?.chaines.every((c) => c.resultat.valide)).toBe(true);
    expect(r?.chaines.every((c) => c.resultat.nbVerifies === 1)).toBe(true);
  });

  it("signale une insertion tardive, et seulement au-delà du seuil", async () => {
    const rapide = ligne({ id: "a" }); // 10 s d'écart : écriture de l'image.
    const tardive = {
      ...ligne({ id: "b", role: "formateur", signataireNom: "Simone Blanc" }),
      createdAt: new Date("2026-06-12T09:00:00.000Z"), // deux jours plus tard.
    };
    mockPrisma.coachingSeanceSignature.findMany.mockResolvedValue([rapide, tardive]);

    const r = await listerRegistreSeancesAfest(COACHING);
    const parId = new Map(r?.lignes.map((l) => [l.signatureId, l]));
    expect(parId.get("a")?.insertionTardive).toBe(false);
    expect(parId.get("b")?.insertionTardive).toBe(true);
  });

  it("rend le nom FIGÉ dans la ligne, jamais un nom relu ailleurs", async () => {
    mockPrisma.coachingSeanceSignature.findMany.mockResolvedValue([
      ligne({ id: "a", signataireNom: "Jean Dupont" }),
    ]);
    const r = await listerRegistreSeancesAfest(COACHING);
    expect(r?.lignes[0]?.signataireNom).toBe("Jean Dupont");
    // Et l'empreinte est exposée : c'est elle qui rend la ligne opposable.
    expect(r?.lignes[0]?.empreinte).toHaveLength(64);
  });

  it("dit le plafond probant d'une signature recueillie sur le poste du formateur", async () => {
    mockPrisma.coachingSeanceSignature.findMany.mockResolvedValue([
      { ...ligne({ id: "a" }), recueilliParTrainerId: "44444444-4444-4444-8444-444444444444" },
    ]);
    const r = await listerRegistreSeancesAfest(COACHING);
    // Taire la différence présenterait comme égales deux signatures qui ne le
    // sont pas : l'une est apposée par la partie, l'autre par l'organisme.
    expect(r?.lignes[0]?.recueilliSurPosteFormateur).toBe(true);
  });

  it("interroge la base sur le parcours ET dans l'ordre d'écriture", async () => {
    mockPrisma.coachingSeanceSignature.findMany.mockResolvedValue([]);
    await listerRegistreSeancesAfest(COACHING);
    const arg = mockPrisma.coachingSeanceSignature.findMany.mock.calls[0]?.[0];
    expect(arg.where).toEqual({ coachingId: COACHING });
    // 🔴 `createdAt`, jamais `signeAt` : le chaînage suit l'ordre d'ÉCRITURE.
    // Trier sur la date DÉCLARÉE ferait apparaître rompue une chaîne intacte
    // dès qu'une signature est antidatée.
    expect(arg.orderBy).toEqual([{ createdAt: "asc" }]);
  });
});
