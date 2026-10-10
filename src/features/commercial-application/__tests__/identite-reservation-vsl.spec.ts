/**
 * Le préremplissage de la réservation maison depuis la page vidéo (2026-10-07).
 *
 * Le jeton `?j=` de l'étape 1 retrouve le prénom et l'e-mail de la fiche : le même
 * e-mail rattache la réservation. Tout ce qui n'est pas un lead vidéo valide rend
 * `null` (formulaire vide), et rien ne lève.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, connue } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  connue: { ids: new Set<string>() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { submission: { findFirst } } }));
vi.mock("../deja-connu-vsl", () => ({
  ligneDejaConnue: async (j: { lead: string }) => (connue.ids.has(j.lead) ? { id: j.lead } : null),
}));

import { creerJeton } from "../jeton-lead";
import { encryptPii } from "@/lib/pii-crypto";
import { identiteDuJetonVsl, jetonVslValide } from "../identite-reservation-vsl";

const LIGNE_VSL = {
  contactName: "Léa",
  contactEmail: "lea@exemple.fr",
  details: { vsl: { etape: 2 } },
};

beforeEach(() => {
  findFirst.mockReset();
  connue.ids = new Set();
});

describe("identiteDuJetonVsl", () => {
  it("jeton valide d'un lead vidéo → prénom et e-mail de la fiche", async () => {
    findFirst.mockResolvedValue(LIGNE_VSL);
    const jeton = creerJeton({ lead: "lead-1", suspect: false });
    expect(await identiteDuJetonVsl(jeton)).toEqual({ nom: "Léa", email: "lea@exemple.fr" });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "lead-1", deletedAt: null } }),
    );
  });

  it("téléphone de l'étape 2 sur la fiche → proposé en clair, modifiable ; absent → pas de clé", async () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    try {
      findFirst.mockResolvedValueOnce({ ...LIGNE_VSL, contactPhone: encryptPii("06 12 34 56 78") });
      const jeton = creerJeton({ lead: "lead-1", suspect: false });
      expect(await identiteDuJetonVsl(jeton)).toEqual({
        nom: "Léa",
        email: "lea@exemple.fr",
        telephone: "06 12 34 56 78",
      });
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ contactPhone: true }),
        }),
      );
      findFirst.mockResolvedValueOnce({ ...LIGNE_VSL, contactPhone: null });
      expect(await identiteDuJetonVsl(jeton)).toEqual({ nom: "Léa", email: "lea@exemple.fr" });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("jeton de réservation (reprise, 10 jours) accepté ; trafiqué → rien ne se préremplit", async () => {
    findFirst.mockResolvedValue(LIGNE_VSL);
    const jeton = creerJeton({ lead: "lead-1", genre: "reprise" });
    expect(await identiteDuJetonVsl(jeton)).toEqual({ nom: "Léa", email: "lea@exemple.fr" });
    findFirst.mockClear();
    const [corps, sig] = jeton.split(".") as [string, string];
    const autre = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(corps, "base64url").toString()), lead: "lead-2" }),
    ).toString("base64url");
    expect(await identiteDuJetonVsl(`${autre}.${sig}`)).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("jeton absent, trafiqué ou expiré → null, sans lire la base", async () => {
    const jeton = creerJeton({ lead: "lead-1", suspect: false });
    const expire = creerJeton({ lead: "lead-1", suspect: false, maintenant: 0 });
    for (const v of [undefined, "", ["a"], `${jeton}x`, "pas.unjeton", expire]) {
      expect(await identiteDuJetonVsl(v)).toBeNull();
    }
    expect(findFirst).not.toHaveBeenCalled();
    expect(jetonVslValide(jeton)).toBe(jeton);
    expect(jetonVslValide(`${jeton}x`)).toBeNull();
  });

  it("aucune ligne (adresse déjà connue), ligne hors page vidéo, sans e-mail → null", async () => {
    const jeton = creerJeton({ lead: "lead-1", suspect: false });
    findFirst.mockResolvedValueOnce(null);
    expect(await identiteDuJetonVsl(jeton)).toBeNull();
    findFirst.mockResolvedValueOnce({ ...LIGNE_VSL, details: { candidature: {} } });
    expect(await identiteDuJetonVsl(jeton)).toBeNull();
    findFirst.mockResolvedValueOnce({ ...LIGNE_VSL, contactEmail: null });
    expect(await identiteDuJetonVsl(jeton)).toBeNull();
  });

  it("🔴 prénom et e-mail CHIFFRÉS en base (cas réel du 2026-10-07) → proposés EN CLAIR", async () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    try {
      findFirst.mockResolvedValue({
        ...LIGNE_VSL,
        contactName: encryptPii("Léa"),
        contactEmail: encryptPii("lea@exemple.fr"),
      });
      const r = await identiteDuJetonVsl(creerJeton({ lead: "lead-1", suspect: false }));
      expect(r).toEqual({ nom: "Léa", email: "lea@exemple.fr" });
      expect(JSON.stringify(r)).not.toContain("enc:v1");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("chiffré mais clé absente → null, jamais le texte chiffré ni le marqueur", async () => {
    vi.stubEnv("PII_ENCRYPTION_KEY", "a".repeat(64));
    const chiffre = { ...LIGNE_VSL, contactEmail: encryptPii("lea@exemple.fr") };
    vi.stubEnv("PII_ENCRYPTION_KEY", "");
    try {
      findFirst.mockResolvedValue(chiffre);
      expect(await identiteDuJetonVsl(creerJeton({ lead: "lead-1", suspect: false }))).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("base en panne → null, ne lève jamais", async () => {
    findFirst.mockRejectedValue(new Error("db down"));
    expect(await identiteDuJetonVsl(creerJeton({ lead: "lead-1", suspect: false }))).toBeNull();
  });
});

describe("câblage de la page du formulaire", () => {
  it("préremplit SEULEMENT l'échange apporteur, et une reprise de saisie l'emporte", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/app/[locale]/appel/reserver/page.tsx"),
      "utf8",
    ).replace(/^\s*\/\/.*$/gm, " ");
    expect(src).toMatch(
      /!reprise && choix === "apporteur" \? await identiteDuJetonVsl\(sp\[PARAM_JETON_VSL\]\)/,
    );
    expect(src).toMatch(
      /reprise\s*\?\s*\{ erreurs: reprise\.erreurs, valeurs: reprise\.valeurs \}/,
    );
  });

  it("le formulaire reçoit le téléphone préchargé, dans un champ qui reste modifiable", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/app/[locale]/appel/reserver/page.tsx"),
      "utf8",
    ).replace(/^\s*\/\/.*$/gm, " ");
    expect(src).toMatch(
      /prerempli\.telephone \? \{ \[CHAMPS\.telephone\]: prerempli\.telephone \}/,
    );
  });

  it("la page calendrier de l'échange apporteur recopie le jeton VALIDE dans chaque créneau", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/app/[locale]/appel/page.tsx"),
      "utf8",
    ).replace(/^\s*\/\/.*$/gm, " ");
    // Validé par `jetonVslValide` (un jeton faux n'est jamais recopié), et seulement
    // pour l'échange apporteur.
    expect(src).toMatch(
      /choix === "apporteur" \? \(jetonVslValide\(sp\[PARAM_JETON_VSL\]\) \?\? undefined\)/,
    );
    expect(src).toMatch(/\$\{PARAM_JETON_VSL\}=\$\{encodeURIComponent\(jeton\)\}/);
    expect(src).toMatch(/parametresDuChoix=\{parametresCreneau\}/);
  });

  it("🔒 P2 — personne DÉJÀ CONNUE : aucun préremplissage, sa fiche n'est pas lue", async () => {
    // Quiconque a tapé son adresse à l'étape 1 détient un jeton vers sa fiche.
    connue.ids = new Set(["fiche-connue"]);
    findFirst.mockResolvedValue(LIGNE_VSL);
    expect(
      await identiteDuJetonVsl(creerJeton({ lead: "fiche-connue", suspect: false })),
    ).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
