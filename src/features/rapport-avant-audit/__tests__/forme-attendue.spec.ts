import { describe, expect, it } from "vitest";
import { z } from "zod";

import { BesoinSchema } from "../base-audit-schema";
import { blocFormeAttendue, decrireForme } from "../forme-attendue";

describe("forme attendue d'une étape", () => {
  it("donne les noms de clés exacts et les valeurs autorisées d'un besoin", () => {
    const t = decrireForme(z.object({ besoins: z.array(BesoinSchema) }));
    for (const mot of [
      '"besoins"',
      '"id"',
      '"categorie"',
      '"douleur"',
      '"enonce"',
      '"citations"',
      '"auteur"',
      '"nbPersonnes"',
      '"intensite"',
      '"divergence"',
    ]) {
      expect(t).toContain(mot);
    }
    expect(t).toContain("(facultatif)");
  });

  it("traite les valeurs par défaut, les enums et les enregistrements", () => {
    const t = decrireForme(
      z.object({
        a: z.enum(["x", "y"]).default("x"),
        b: z.record(z.string(), z.string()).default({}),
        c: z.string().nullable(),
      }),
    );
    expect(t).toContain('"x" | "y" (facultatif)');
    expect(t).toContain('{ "<clé>": texte } (facultatif)');
    expect(t).toContain("texte ou null");
  });

  it("le bloc demande du JSON seul et interdit les clés en trop", () => {
    const b = blocFormeAttendue(z.object({ n: z.number() }));
    expect(b).toContain("UNIQUEMENT par un objet JSON");
    expect(b).toContain("N'ajoute aucune autre clé");
    expect(b).toContain('"n": nombre');
  });
});
