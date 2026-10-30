// Le bloc libre ajouté par l'admin avant validation est échappé : jamais de HTML brut.

import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";

import { RelanceDevisClientEmail } from "../relance-devis-client";

describe("relance-devis-client", () => {
  it("échappe le message personnalisé (aucun <script> dans le HTML)", async () => {
    const html = await render(
      <RelanceDevisClientEmail
        locale="fr"
        payload={{
          destinataireNom: "Claire Martin",
          numero: "AXI-DEV-2026-014",
          messagePersonnalise: "<script>alert(1)</script>",
        }}
      />,
    );
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});
