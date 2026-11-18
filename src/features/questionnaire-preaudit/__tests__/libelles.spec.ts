// Les questions en français dans la console (vérification F, défaut E, 25/10/2026) : lues dans
// la copie déposée du questionnaire, repli lisible sinon. Module PUR.

import { describe, expect, it } from "vitest";

import { AUCUN_LIBELLE, libelleDe, libellesDuHtml } from "../libelles";

const HTML = String.raw`<script>
F("text", "dat_fai", IT ? "Connexion internet (fournisseur, fibre, IP fixe ?)" : "Votre abonnement internet (opérateur, fibre ou ADSL)", { sens: 1 }),
F("chips", "tools_bi", "Tableaux de chiffres automatiques (Power BI, Excel…)", { opts: [] }),
F("textarea", "org_note", "Ce qu'on doit \"savoir\" de votre organisation"),
F("chips", "tools_bi", "Doublon ignoré"),
F("text", "pourquoi", hKey === "x" ? "a" : "b"),
</script>`;

describe("libellés des questions", () => {
  const l = libellesDuHtml(HTML);

  it("lit F(type, id, libellé) ; le premier appel d'un id l'emporte ; échappements compris", () => {
    expect(libelleDe("tools_bi", l)).toBe("Tableaux de chiffres automatiques (Power BI, Excel…)");
    expect(libelleDe("org_note", l)).toBe('Ce qu\'on doit "savoir" de votre organisation');
  });

  it("le référent informatique a son propre libellé quand le HTML en donne un", () => {
    expect(libelleDe("dat_fai", l)).toBe("Votre abonnement internet (opérateur, fibre ou ADSL)");
    expect(libelleDe("dat_fai", l, "it")).toBe(
      "Connexion internet (fournisseur, fibre, IP fixe ?)",
    );
    expect(libelleDe("tools_bi", l, "it")).toBe(
      "Tableaux de chiffres automatiques (Power BI, Excel…)",
    );
  });

  it("repli lisible : la rubrique et le nom du champ, jamais l'id brut seul", () => {
    expect(libelleDe("dat_firewall", AUCUN_LIBELLE)).toBe("Informatique et données : firewall");
    expect(libelleDe("pourquoi", l)).toBe("Champ « pourquoi »");
    expect(libelleDe("ent_cp", AUCUN_LIBELLE)).toBe("Entreprise : cp");
  });
});
