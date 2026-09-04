// Le constructeur de liens de campagne.
//
// Ce que ces tests protègent, et pourquoi ça vaut un fichier : une faute dans
// un `utm_content` ne CASSE RIEN. La page s'affiche, le visiteur candidate, et
// la seule chose détruite est la comparaison entre deux visuels — c'est-à-dire
// la décision de remettre ou non de l'argent dans une publicité. Un défaut
// silencieux qui ne se voit qu'au moment de décider.

import { describe, expect, it } from "vitest";
import {
  CANAUX_CAMPAGNE,
  DESTINATIONS_CAMPAGNE,
  construireLienCampagne,
  mediumDuCanal,
  normaliserValeurUtm,
} from "../lien-campagne";

const ORIGINE = "https://axion-ia.com";

describe("normalisation d'une valeur d'UTM", () => {
  it("met en minuscules et remplace les espaces par des tirets", () => {
    expect(normaliserValeurUtm("Apporteurs Septembre")).toBe("apporteurs-septembre");
  });

  it("retire les ACCENTS — sinon la même campagne produit deux clés", () => {
    // 🔑 Le piège que ce test existe pour tenir : si les accents sont retirés
    // APRÈS le remplacement des caractères non alphanumériques, « Été » donne
    // `-t-` au lieu de `ete`. Deux personnes saisissant la même campagne
    // obtiennent alors deux lignes de statistiques qui ne s'additionnent jamais.
    expect(normaliserValeurUtm("Été 2026")).toBe("ete-2026");
    expect(normaliserValeurUtm("Rentrée — Île-de-France")).toBe("rentree-ile-de-france");
    expect(normaliserValeurUtm("Ça marche")).toBe("ca-marche");
  });

  it("ne laisse jamais de tiret en tête ni en queue", () => {
    expect(normaliserValeurUtm("  — visuel A —  ")).toBe("visuel-a");
    expect(normaliserValeurUtm("!!!")).toBe("");
  });

  it("borne la longueur — un paramètre d'URL n'est pas un champ de texte libre", () => {
    expect(normaliserValeurUtm("a".repeat(200)).length).toBe(60);
  });

  it("est IDEMPOTENTE — normaliser deux fois ne change rien", () => {
    // Sans ça, un aller-retour par l'écran modifierait la clé et scinderait la
    // campagne en deux.
    const une = normaliserValeurUtm("Apporteurs — Été 2026");
    expect(normaliserValeurUtm(une)).toBe(une);
  });
});

describe("construction du lien", () => {
  it("produit une URL complète et valide", () => {
    const { url } = construireLienCampagne(ORIGINE, {
      destination: "apporteur-affaires",
      canal: "facebook",
      campagne: "Apporteurs Septembre",
      visuel: "Vidéo A",
    });
    expect(() => new URL(url)).not.toThrow();
    const u = new URL(url);
    expect(u.pathname).toBe("/fr/apporteur-affaires");
    expect(u.searchParams.get("utm_source")).toBe("facebook");
    expect(u.searchParams.get("utm_medium")).toBe("paid");
    expect(u.searchParams.get("utm_campaign")).toBe("apporteurs-septembre");
    expect(u.searchParams.get("utm_content")).toBe("video-a");
  });

  it("le `medium` vient du CANAL, il n'est jamais saisi", () => {
    // Un `utm_medium` saisi à la main dérive : `paid`, `cpc`, `Paid`, `ads`…
    // et le regroupement par medium cesse de vouloir dire quelque chose.
    expect(mediumDuCanal("facebook")).toBe("paid");
    expect(mediumDuCanal("leboncoin")).toBe("referral");
    expect(mediumDuCanal("email")).toBe("email");
  });

  it("tolère une barre finale dans l'origine sans doubler le séparateur", () => {
    const { url } = construireLienCampagne("https://axion-ia.com/", {
      destination: "apporteur-affaires",
      canal: "facebook",
      campagne: "test",
    });
    expect(url).not.toContain("com//");
  });

  it("AVERTIT au lieu de refuser quand la campagne ou le visuel manque", () => {
    // Un écran qui refuse fait recommencer ; un écran qui avertit laisse
    // avancer et dit ce qu'on perd. Le lien reste valide dans les deux cas.
    const r = construireLienCampagne(ORIGINE, {
      destination: "apporteur-affaires",
      canal: "facebook",
      campagne: "",
    });
    expect(r.avertissements).toHaveLength(2);
    expect(() => new URL(r.url)).not.toThrow();
    expect(r.url).not.toContain("utm_campaign");
    expect(r.url).not.toContain("utm_content");
  });

  it("deux fois les mêmes choix donnent DEUX FOIS LE MÊME LIEN", () => {
    // 🔑 C'est la propriété qui remplace une table de stockage : on ne
    // « retrouve » pas un lien, on le refait à l'identique.
    const choix = {
      destination: "apporteur-affaires" as const,
      canal: "linkedin" as const,
      campagne: "Apporteurs Septembre",
      visuel: "Carrousel B",
    };
    expect(construireLienCampagne(ORIGINE, choix).url).toBe(
      construireLienCampagne(ORIGINE, choix).url,
    );
  });

  it("deux visuels DIFFÉRENTS donnent deux liens différents — témoin négatif", () => {
    const base = {
      destination: "apporteur-affaires" as const,
      canal: "facebook" as const,
      campagne: "c",
    };
    expect(construireLienCampagne(ORIGINE, { ...base, visuel: "a" }).url).not.toBe(
      construireLienCampagne(ORIGINE, { ...base, visuel: "b" }).url,
    );
  });
});

describe("les listes fermées", () => {
  it("chaque canal a un identifiant déjà normalisé", () => {
    // Sinon la valeur écrite dans l'URL différerait de l'identifiant, et le
    // regroupement des statistiques porterait sur deux choses distinctes.
    for (const c of CANAUX_CAMPAGNE) {
      expect(normaliserValeurUtm(c.id), `canal ${c.id}`).toBe(c.id);
    }
  });

  it("chaque destination pointe une route existante du site, préfixe de langue compris", () => {
    for (const d of DESTINATIONS_CAMPAGNE) {
      expect(d.chemin, `destination ${d.id}`).toMatch(/^\/fr\/[a-z0-9-]+$/);
    }
  });

  it("la destination du tunnel court porte la NOUVELLE URL, jamais l'ancienne", () => {
    // `/facebook` a été renommée `/apporteur-affaires` le 2026-09-04 et ne rend
    // plus aucune page. Un lien de publicité qui la nommerait ajouterait une
    // redirection à chaque clic, sur mobile, au moment le plus coûteux.
    const chemins = DESTINATIONS_CAMPAGNE.map((d) => d.chemin);
    expect(chemins).toContain("/fr/apporteur-affaires");
    expect(chemins.some((c) => c.includes("facebook"))).toBe(false);
  });
});
