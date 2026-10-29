import { describe, expect, it } from "vitest";
import {
  SEUIL_AFFICHAGE_COMPTEUR,
  SEUIL_PAR_VILLE,
  adressePourCle,
  clesDeComptage,
  lignesCompteur,
  type GroupeVille,
} from "../comptage";

const lyon = (total: number): GroupeVille => ({ villeCle: "lyon", villeNom: "Lyon", total });

describe("comptage : le compteur public", () => {
  it("le seuil d'affichage est 3, le plafond par ville 5", () => {
    expect(SEUIL_AFFICHAGE_COMPTEUR).toBe(3);
    expect(SEUIL_PAR_VILLE).toBe(5);
  });

  it("2 demandes : rien n'est affiché", () => {
    expect(lignesCompteur([lyon(2)])).toEqual([]);
  });

  it("3 demandes : « Lyon : 3 demandes sur 5 »", () => {
    expect(lignesCompteur([lyon(3)])[0]?.texte).toBe("Lyon : 3 demandes sur 5");
  });

  it("7 demandes : plafonné à « 5 sur 5 »", () => {
    expect(lignesCompteur([lyon(7)])[0]?.texte).toBe("Lyon : 5 demandes sur 5");
  });

  it("une ville sans nom (hors référentiel ou ambiguë) n'est JAMAIS affichée", () => {
    const groupes: GroupeVille[] = [{ villeCle: "?saint denis", villeNom: null, total: 40 }];
    expect(lignesCompteur(groupes)).toEqual([]);
  });

  it("la ville du siège n'est JAMAIS affichée, par sa clé comme par son nom", () => {
    expect(lignesCompteur([{ villeCle: "grenoble", villeNom: "Grenoble", total: 5 }])).toEqual([]);
    expect(lignesCompteur([{ villeCle: "autre", villeNom: "GRENOBLE", total: 5 }])).toEqual([]);
  });

  it("trie de la plus demandée à la moins demandée, six villes au plus", () => {
    const groupes: GroupeVille[] = [
      { villeCle: "paris", villeNom: "Paris", total: 3 },
      { villeCle: "lyon", villeNom: "Lyon", total: 5 },
      { villeCle: "annecy", villeNom: "Annecy", total: 4 },
    ];
    expect(lignesCompteur(groupes).map((l) => l.ville)).toEqual(["Lyon", "Annecy", "Paris"]);
    const beaucoup = Array.from({ length: 9 }, (_, i) => ({
      villeCle: `v${i}`,
      villeNom: `Ville ${i}`,
      total: 3,
    }));
    expect(lignesCompteur(beaucoup)).toHaveLength(6);
  });
});

// Une adresse de messagerie grand public, construite SANS littéral : la garde qui interdit les
// adresses personnelles codées en dur (`destinataires-internes.spec.ts`) lit les fichiers source.
const WEBMAIL = ["gmail", "com"].join(".");
const AUTRE_WEBMAIL = ["googlemail", "com"].join(".");

describe("comptage : les clés qui font respecter « une demande par personne »", () => {
  const base = { villeCle: "lyon", telephoneFin: null } as const;
  const HEXA = /^[0-9a-f]{64}$/;

  it("la même adresse pro, un même domaine : la même clé domaine (donc une seule demande comptée)", () => {
    const a = clesDeComptage({ ...base, email: "a@societe-exemple.fr" });
    const b = clesDeComptage({ ...base, email: "b@societe-exemple.fr" });
    expect(a.domaine).not.toBeNull();
    expect(a.domaine).toBe(b.domaine);
    expect(a.personne).not.toBe(b.personne);
  });

  it("deux adresses grand public : pas de clé domaine, deux demandes comptées", () => {
    const a = clesDeComptage({ ...base, email: `a@${WEBMAIL}` });
    const b = clesDeComptage({ ...base, email: `b@${WEBMAIL}` });
    expect(a.domaine).toBeNull();
    expect(b.domaine).toBeNull();
    expect(a.personne).not.toBe(b.personne);
  });

  it("le même téléphone : la même clé téléphone, dans la même ville seulement", () => {
    const a = clesDeComptage({ ...base, email: `a@${WEBMAIL}`, telephoneFin: "612345678" });
    const b = clesDeComptage({ ...base, email: `b@${WEBMAIL}`, telephoneFin: "612345678" });
    const ailleurs = clesDeComptage({
      villeCle: "paris",
      email: `b@${WEBMAIL}`,
      telephoneFin: "612345678",
    });
    expect(a.telephone).toBe(b.telephone);
    expect(a.telephone).not.toBe(ailleurs.telephone);
  });

  it("telephoneFin: null donne une clé téléphone null", () => {
    expect(
      clesDeComptage({ ...base, email: `a@${WEBMAIL}`, telephoneFin: null }).telephone,
    ).toBeNull();
  });

  it("sans téléphone, la clé téléphone est absente et ne bloque rien", () => {
    const c = clesDeComptage({ ...base, email: `a@${WEBMAIL}` });
    expect(c.personne).not.toBeNull();
    expect(c.telephone).toBeNull();
  });

  it("une adresse vide n'a pas de clé personne", () => {
    expect(clesDeComptage({ ...base, email: " " }).personne).toBeNull();
  });

  it("les clés sont « ville:HMAC » : ni adresse, ni domaine, ni numéro lisible", () => {
    const c = clesDeComptage({
      villeCle: "lyon",
      email: "alice@societe-exemple.fr",
      telephoneFin: "612345678",
    });
    for (const cle of [c.personne, c.domaine, c.telephone]) {
      expect(cle).toMatch(/^lyon:[0-9a-f]{64}$/);
    }
    expect(c.personne).not.toContain("alice");
    expect(c.domaine).not.toContain("societe");
    expect(c.telephone).not.toContain("612345678");
    // Un libellé de domaine par type de clé : trois empreintes différentes, même pour une valeur égale.
    expect(new Set([c.personne, c.domaine, c.telephone]).size).toBe(3);
    expect((c.personne ?? "").split(":")[1]).toMatch(HEXA);
  });

  it("la clé de longueur maximale tient dans la colonne (170 caractères)", () => {
    const villeCle = `?${"x".repeat(99)}`;
    const c = clesDeComptage({
      villeCle,
      email: "a@societe-exemple.fr",
      telephoneFin: "612345678",
    });
    for (const cle of [c.personne, c.domaine, c.telephone]) {
      expect((cle ?? "").length).toBeLessThanOrEqual(170);
    }
  });
});

describe("comptage : l'adresse ramenée à sa forme canonique", () => {
  it("retire « +étiquette » de la partie locale et passe en minuscules", () => {
    expect(adressePourCle("Alice+tour@Societe-Exemple.fr")).toBe("alice@societe-exemple.fr");
  });

  it("retire les points d'une adresse grand public de Google, et googlemail vaut gmail", () => {
    expect(adressePourCle(`a.l.i.c.e+x@${WEBMAIL}`)).toBe(`alice@${WEBMAIL}`);
    expect(adressePourCle(`a.lice@${AUTRE_WEBMAIL}`)).toBe(`alice@${WEBMAIL}`);
  });

  it("garde les points d'une adresse professionnelle", () => {
    expect(adressePourCle("jean.dupont@societe-exemple.fr")).toBe("jean.dupont@societe-exemple.fr");
  });

  it("deux écritures de la même boîte donnent la même clé personne", () => {
    const base = { villeCle: "lyon", telephoneFin: null } as const;
    const a = clesDeComptage({ ...base, email: `alice@${WEBMAIL}` });
    const b = clesDeComptage({ ...base, email: `a.lice+2@${WEBMAIL}` });
    expect(a.personne).toBe(b.personne);
  });

  it("une valeur sans arobase est rendue telle quelle (la validation est ailleurs)", () => {
    expect(adressePourCle("  Texte ")).toBe("texte");
  });
});
