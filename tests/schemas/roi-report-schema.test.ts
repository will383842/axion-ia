import { describe, it, expect } from "vitest";
import { roiReportRequestSchema, roiCallbackSchema } from "@/lib/schemas/roi-report-schema";

// Schémas du tunnel « simulateur de gains » (cf. ADR 0040) :
//   - roiReportRequestSchema : envoi du rapport (premier temps)
//   - roiCallbackSchema      : rattachement du téléphone (second temps)
//
// Les deux gardent une frontière commerciale autant que technique. Le premier
// ne demande QUE le strict nécessaire — chaque champ obligatoire de plus coûte
// des rapports envoyés, donc des leads. Le second est volontairement plus
// permissif que le reste du site, parce qu'il porte un champ FACULTATIF sur
// lequel un rejet de format ferait perdre un numéro déjà consenti.

describe("roiReportRequestSchema", () => {
  const valid = {
    nom: "Camille",
    email: "camille@exemple.fr",
    diagnostic: "1~bi~d~b~acp~fa20-de6~45",
    locale: "fr",
    consent: true as const,
  };

  it("accepte une demande minimale", () => {
    expect(roiReportRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("accepte le nom d'entreprise, qui reste facultatif", () => {
    expect(roiReportRequestSchema.safeParse({ ...valid, companyName: "Dupont SAS" }).success).toBe(
      true,
    );
    const { companyName: _absent, ...sansEntreprise } = { ...valid, companyName: "x" };
    expect(roiReportRequestSchema.safeParse(sansEntreprise).success).toBe(true);
  });

  it("normalise l'e-mail en minuscules et sans espaces", () => {
    // Sans cela, deux soumissions du même prospect créeraient deux leads.
    const parsed = roiReportRequestSchema.parse({ ...valid, email: "  Camille@Exemple.FR " });
    expect(parsed.email).toBe("camille@exemple.fr");
  });

  it("rejette un e-mail malformé", () => {
    expect(roiReportRequestSchema.safeParse({ ...valid, email: "camille-arobase" }).success).toBe(
      false,
    );
  });

  it("rejette un prénom trop court", () => {
    expect(roiReportRequestSchema.safeParse({ ...valid, nom: "C" }).success).toBe(false);
  });

  it("exige le consentement — `false` ne passe pas", () => {
    // L'e-mail sert aussi de point de départ à une relance commerciale : le
    // consentement est une condition, pas une case décorative.
    expect(roiReportRequestSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });

  it("rejette un diagnostic absent ou tronqué", () => {
    expect(roiReportRequestSchema.safeParse({ ...valid, diagnostic: "" }).success).toBe(false);
    expect(roiReportRequestSchema.safeParse({ ...valid, diagnostic: "1~b" }).success).toBe(false);
  });

  it("borne la longueur du diagnostic", () => {
    // Le champ vient du client : sans plafond, il devient un vecteur d'abus.
    const trop = "1~" + "a".repeat(700);
    expect(roiReportRequestSchema.safeParse({ ...valid, diagnostic: trop }).success).toBe(false);
  });

  it("retombe sur le français quand la langue n'est pas fournie", () => {
    const { locale: _sansLangue, ...sansLocale } = valid;
    expect(roiReportRequestSchema.parse(sansLocale).locale).toBe("fr");
  });

  it("🔴 ne comporte AUCUN champ téléphone", () => {
    // Invariant du tunnel : le téléphone est demandé DANS UN SECOND TEMPS
    // (`roiCallbackSchema`), une fois le rapport envoyé. L'ajouter ici ferait
    // perdre des rapports envoyés — donc des leads. Cf. ADR 0040.
    expect(Object.keys(roiReportRequestSchema.shape)).not.toContain("telephone");
  });

  it("rejette une charge vide", () => {
    expect(roiReportRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("roiCallbackSchema", () => {
  const valid = {
    submissionId: "3f1c9a2e-9d54-4b8f-9a1e-2c7b6d5f4e30",
    telephone: "06 12 34 56 78",
  };

  it("accepte un numéro au format national français", () => {
    // Le format que tape spontanément un dirigeant français. Le refuser sur un
    // champ facultatif reviendrait à jeter un numéro déjà consenti — c'est
    // pourquoi ce schéma est plus permissif que `unified-contact-schema`.
    expect(roiCallbackSchema.safeParse(valid).success).toBe(true);
  });

  it("accepte aussi les écritures internationales et pointées", () => {
    for (const tel of ["+33 6 12 34 56 78", "0033612345678", "06.12.34.56.78", "(06) 12345678"]) {
      expect(roiCallbackSchema.safeParse({ ...valid, telephone: tel }).success, tel).toBe(true);
    }
  });

  it("rejette un numéro trop court ou vide", () => {
    expect(roiCallbackSchema.safeParse({ ...valid, telephone: "0612" }).success).toBe(false);
    expect(roiCallbackSchema.safeParse({ ...valid, telephone: "" }).success).toBe(false);
  });

  it("rejette un numéro contenant des lettres", () => {
    expect(roiCallbackSchema.safeParse({ ...valid, telephone: "appelez-moi" }).success).toBe(false);
  });

  it("borne la longueur du numéro", () => {
    expect(roiCallbackSchema.safeParse({ ...valid, telephone: "0".repeat(40) }).success).toBe(
      false,
    );
  });

  it("exige un identifiant de demande au format UUID", () => {
    // L'identifiant vient du client. Le contraindre à un UUID est la première
    // des trois protections contre l'écrasement d'un lead existant (cf.
    // `attachRoiCallbackAction`).
    expect(roiCallbackSchema.safeParse({ ...valid, submissionId: "42" }).success).toBe(false);
    expect(roiCallbackSchema.safeParse({ ...valid, submissionId: "" }).success).toBe(false);
  });

  it("rejette une charge vide", () => {
    expect(roiCallbackSchema.safeParse({}).success).toBe(false);
  });
});
