/**
 * Console éditoriale — tests du jeu initial des règles de conformité (§8).
 *
 * Le protocole exige, pour CHAQUE règle, « deux cas : passe et refuse ». Une
 * règle sans cas négatif ne garde rien : elle resterait verte si on la
 * supprimait.
 *
 * Ces tests portent sur le REGISTRE D'AMORÇAGE, pas sur l'évaluateur — qui
 * arrive au lot 1 avec la validation. Les tenir dès maintenant a un intérêt
 * précis : un motif fautif se découvre ici, en une seconde, plutôt qu'au lot 1
 * sur une publication qu'on croyait conforme.
 */

import { describe, it, expect } from "vitest";
import {
  ED_REGLES_CONFORMITE,
  ED_REGLES_CONFORMITE_ATTENDUES,
  TAGS_AUTORISES,
  UTM_REQUIS,
  TOPONYMES_REFUSES,
} from "./conformite";

/** Les règles sont évaluées en `i`, jamais en `u` — cf. l'en-tête du registre. */
function motif(code: string): RegExp {
  const regle = ED_REGLES_CONFORMITE.find((r) => r.code === code);
  if (!regle) throw new Error(`Règle « ${code} » absente du registre.`);
  if (!regle.motifRegex) throw new Error(`Règle « ${code} » est structurelle, sans motif.`);
  return new RegExp(regle.motifRegex, "i");
}

function parametres(code: string): Record<string, unknown> {
  const regle = ED_REGLES_CONFORMITE.find((r) => r.code === code);
  if (!regle) throw new Error(`Règle « ${code} » absente du registre.`);
  return (regle.parametres ?? {}) as Record<string, unknown>;
}

describe("le registre lui-même", () => {
  it("porte les douze règles du §8", () => {
    expect(ED_REGLES_CONFORMITE).toHaveLength(ED_REGLES_CONFORMITE_ATTENDUES);
  });

  it("n'a aucun code en double", () => {
    const codes = ED_REGLES_CONFORMITE.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("🔴 compile TOUS ses motifs — un motif fautif casserait l'évaluateur", () => {
    for (const regle of ED_REGLES_CONFORMITE) {
      if (!regle.motifRegex) continue;
      expect(() => new RegExp(regle.motifRegex, "i"), `règle ${regle.code}`).not.toThrow();
    }
  });

  it("donne à chaque règle un message qui la CITE — un refus muet est un échec", () => {
    for (const regle of ED_REGLES_CONFORMITE) {
      expect(regle.message, `règle ${regle.code}`).toContain(`« ${regle.code} »`);
      expect(regle.motif.length, `règle ${regle.code}`).toBeGreaterThan(20);
    }
  });

  it("donne des paramètres à toute règle structurelle, sinon elle ne garde rien", () => {
    for (const regle of ED_REGLES_CONFORMITE) {
      if (regle.motifRegex) continue;
      expect(regle.parametres, `règle ${regle.code}`).not.toBeNull();
      expect(Object.keys(regle.parametres ?? {}).length, `règle ${regle.code}`).toBeGreaterThan(0);
    }
  });

  it("porte exactement 17 tags autorisés et 4 UTM requis", () => {
    expect(TAGS_AUTORISES).toHaveLength(17);
    expect(new Set(TAGS_AUTORISES).size).toBe(17);
    expect(UTM_REQUIS).toHaveLength(4);
  });

  it("n'autorise aucun tag accentué — la liste se contredirait elle-même", () => {
    for (const tag of TAGS_AUTORISES) {
      expect(/[À-ÿ]/.test(tag), `tag ${tag}`).toBe(false);
    }
  });
});

describe("règle « geo »", () => {
  const re = motif("geo");

  it("REFUSE une mention de ville, de département ou de région", () => {
    expect(re.test("Nos ateliers se tiennent à Grenoble.")).toBe(true);
    expect(re.test("Une PME de l'Isère nous a appelés.")).toBe(true);
    expect(re.test("Partout en Auvergne-Rhône-Alpes.")).toBe(true);
    expect(re.test("grenoble en minuscules compte aussi")).toBe(true);
  });

  it("laisse passer un texte sans toponyme", () => {
    expect(re.test("Trois signaux qu'un processus vous coûte plus qu'il ne rapporte.")).toBe(false);
  });

  it("🔴 ne rougit PAS sur un mot qui contient un toponyme", () => {
    // Le protocole avertit : « un détecteur qui signale 53 défauts sur 61 se
    // trompe ». Les bornes de mot sont donc testées explicitement.
    expect(re.test("Le lyonnaisme n'est pas un mot, mais il ne doit pas matcher.")).toBe(false);
    expect(re.test("parisienne")).toBe(false);
  });

  it("🔴 ne rougit PAS sur les homographes volontairement écartés", () => {
    // « Vienne » est un subjonctif, « Ain » et « Metz » sont écartés pour la
    // même raison : un faux positif apprend à passer outre la règle.
    expect(re.test("Il faudrait qu'il vienne nous voir.")).toBe(false);
    expect(TOPONYMES_REFUSES).not.toContain("Vienne");
    expect(TOPONYMES_REFUSES).not.toContain("Ain");
  });
});

describe("règle « financier »", () => {
  const re = motif("financier");

  it("REFUSE les formulations du §8", () => {
    expect(re.test("Formation financée jusqu'à 100 % par votre OPCO.")).toBe(true);
    expect(re.test("Sans avance de frais.")).toBe(true);
    expect(re.test("Prise en charge à 100 %.")).toBe(true);
    expect(re.test("100% financé")).toBe(true);
  });

  it("accepte l'apostrophe typographique comme l'apostrophe droite", () => {
    expect(re.test("jusqu’à 100 %")).toBe(true);
    expect(re.test("jusqu'à 100 %")).toBe(true);
  });

  it("laisse passer un propos financier neutre", () => {
    expect(re.test("Le coût se mesure en heures, pas en licences.")).toBe(false);
    expect(re.test("Un financement est possible selon votre situation.")).toBe(false);
  });
});

describe("règle « ai-act »", () => {
  const re = motif("ai-act");

  it("REFUSE une affirmation de sanction et ses variantes", () => {
    expect(re.test("Un manquement vous expose à une sanction.")).toBe(true);
    expect(re.test("Vous risquez une amende.")).toBe(true);
    expect(re.test("Sous peine de sanction.")).toBe(true);
    expect(re.test("Vous êtes passible d'une amende.")).toBe(true);
  });

  it("laisse passer l'énoncé de l'obligation, qui est le propos autorisé", () => {
    expect(re.test("L'AI Act impose de documenter les usages à risque.")).toBe(false);
    expect(re.test("La conformité se prépare en amont.")).toBe(false);
  });
});

describe("règle « sujets »", () => {
  const re = motif("sujets");

  it("REFUSE les quatre sujets non délivrés", () => {
    expect(re.test("Notre chatbot répond à vos clients.")).toBe(true);
    expect(re.test("Le paiement en ligne arrive bientôt.")).toBe(true);
    expect(re.test("La version anglaise du site.")).toBe(true);
    expect(re.test("Le volume de base est configurable.")).toBe(true);
  });

  it("laisse passer un texte qui n'y touche pas", () => {
    expect(re.test("Automatiser une relance client, sans y passer la journée.")).toBe(false);
  });
});

describe("règle « tags-accent »", () => {
  const re = motif("tags-accent");

  it("REFUSE un tag accentué, que LinkedIn tronquerait", () => {
    expect(re.test("ConformitéIA")).toBe(true);
    expect(re.test("ProcédéMetier")).toBe(true);
  });

  it("laisse passer les 17 tags autorisés", () => {
    for (const tag of TAGS_AUTORISES) {
      expect(re.test(tag), `tag ${tag}`).toBe(false);
    }
  });

  it("ne s'applique qu'aux tags — un accent dans le corps est légitime", () => {
    expect(parametres("tags-accent").champs).toEqual(["tags"]);
  });
});

describe("règle « lien-corps »", () => {
  const re = motif("lien-corps");

  it("REFUSE un lien", () => {
    expect(re.test("Tout est là : https://axion-ia.com/fr/appel")).toBe(true);
    expect(re.test("http://exemple.fr")).toBe(true);
  });

  it("laisse passer une mention de domaine sans protocole", () => {
    expect(re.test("Rendez-vous sur axion-ia.com, rubrique Appel.")).toBe(false);
  });

  it("🔴 n'inspecte QUE le corps — un lien en premier commentaire est la pratique", () => {
    // L'appliquer au premier commentaire serait un bug : c'est précisément là
    // qu'un lien doit se trouver pour ne pas casser la portée organique.
    expect(parametres("lien-corps").champs).toEqual(["corps"]);
  });
});

describe("règles structurelles", () => {
  it("« tags-nombre » porte la fourchette 3–4 EN BASE, pas dans le code", () => {
    const p = parametres("tags-nombre");
    expect(p.min).toBe(3);
    expect(p.max).toBe(4);
  });

  it("« tags-liste » porte les 17 valeurs autorisées", () => {
    const p = parametres("tags-liste");
    expect(p.valeurs).toHaveLength(17);
  });

  it("« utm » exige les quatre marqueurs et n'inspecte que le lien", () => {
    const p = parametres("utm");
    expect(p.utm).toEqual(UTM_REQUIS);
    expect(p.champs).toEqual(["lienUrl"]);
  });

  it("🔴 « utm » se déclenche sur l'ABSENCE, pas sur la présence", () => {
    // `interdit: false` est le seul de tout le registre. Inversé, la règle
    // refuserait les liens correctement marqués et accepterait les autres.
    const regle = ED_REGLES_CONFORMITE.find((r) => r.code === "utm");
    expect(regle?.interdit).toBe(false);
    const autres = ED_REGLES_CONFORMITE.filter((r) => r.code !== "utm");
    for (const r of autres) {
      expect(r.interdit, `règle ${r.code}`).toBe(true);
    }
  });

  it("« mentions » plafonne à 2", () => {
    expect(parametres("mentions").max).toBe(2);
  });

  it("« droit-image » exige la signature, et non l'envoi", () => {
    // Une autorisation « envoyee » ne vaut pas consentement : c'est une règle
    // de droit, et le §7 du lot 2 la rejoue explicitement.
    expect(parametres("droit-image").statutRequis).toBe("signee");
  });

  it("« spec-plateforme » lit le référentiel des specs", () => {
    expect(parametres("spec-plateforme").source).toBe("ed_specs_plateforme");
  });
});

describe("gravités", () => {
  it("ne laisse en avertissement que ce qui ne bloque pas une publication", () => {
    const parCode = new Map(ED_REGLES_CONFORMITE.map((r) => [r.code, r.gravite]));
    // Les règles de droit et de mesure bloquent ; le confort avertit.
    expect(parCode.get("geo")).toBe("bloquant");
    expect(parCode.get("droit-image")).toBe("bloquant");
    expect(parCode.get("utm")).toBe("bloquant");
    expect(parCode.get("mentions")).toBe("avertissement");
  });
});
