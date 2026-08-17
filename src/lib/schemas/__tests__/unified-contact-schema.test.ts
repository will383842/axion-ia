import { describe, expect, it } from "vitest";

import { unifiedContactSchema } from "../unified-contact-schema";

/**
 * Le formulaire de contact refusait de partir SANS RIEN DIRE.
 *
 * Constaté le 2026-08-17 sur la PRODUCTION, dans un vrai navigateur : type de
 * service choisi, six champs requis remplis, consentement coché, clic sur
 * « Envoyer ma demande » — et rien. Pas de message. Un liseré rouge sur un menu
 * déroulant de la section « Aller plus loin (RECOMMANDÉ) », révélé un champ à la
 * fois : d'abord « Taille (INSEE) », puis « Timing souhaité ».
 *
 * Cause : `z.enum(...).optional()` accepte `undefined` mais REFUSE la chaîne
 * vide, alors que le `<select>` porte `<option value="">—</option>`. Un champ
 * déclaré optionnel devenait donc obligatoire.
 *
 * Ces tests reproduisent EXACTEMENT ce que le formulaire envoie : des chaînes,
 * y compris vides. Les écrire avec `undefined` les rendrait verts sans rien
 * garder — c'est précisément l'écart qui avait laissé passer le défaut.
 */

const baseValide = {
  type: "audit",
  nom: "ZZ TEST",
  email: "zz-test@example.invalid",
  telephone: "+33600000001",
  ville: "Grenoble",
  message: "Un message de plus de vingt caracteres pour satisfaire le minimum.",
  consent: true as const,
};

describe("unifiedContactSchema — champs optionnels du bloc « Aller plus loin »", () => {
  it("accepte les menus déroulants LAISSÉS VIDES (ce que le formulaire envoie)", () => {
    const r = unifiedContactSchema.safeParse({
      ...baseValide,
      companySize: "",
      timingWeeks: "",
    });

    expect(r.success).toBe(true);
    if (r.success) {
      // Vide = « non renseigné », pas une valeur à transmettre au CRM.
      expect(r.data.companySize).toBeUndefined();
      expect(r.data.timingWeeks).toBeUndefined();
    }
  });

  it("accepte l'absence pure et simple de ces champs", () => {
    expect(unifiedContactSchema.safeParse(baseValide).success).toBe(true);
  });

  it("garde la contrainte : une valeur non vide doit rester dans l'énumération", () => {
    const r = unifiedContactSchema.safeParse({
      ...baseValide,
      companySize: "taille-inventee",
    });

    expect(r.success).toBe(false);
  });

  it("accepte une valeur valide de l'énumération", () => {
    const r = unifiedContactSchema.safeParse({ ...baseValide, companySize: "tpe" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.companySize).toBe("tpe");
  });

  it("les champs texte optionnels acceptent aussi le vide", () => {
    const r = unifiedContactSchema.safeParse({
      ...baseValide,
      companyName: "",
      companySector: "",
      budgetIndicative: "",
    });

    expect(r.success).toBe(true);
  });
});
