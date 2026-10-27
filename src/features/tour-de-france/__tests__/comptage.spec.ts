import { describe, expect, it } from "vitest";
import {
  SEUIL_AFFICHAGE_COMPTEUR,
  SEUIL_PAR_VILLE,
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
    const groupes: GroupeVille[] = [{ villeCle: "?saint-denis", villeNom: null, total: 40 }];
    expect(lignesCompteur(groupes)).toEqual([]);
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

describe("comptage : les clés qui font respecter « une demande par personne »", () => {
  const base = { villeCle: "lyon", telephoneFin: null } as const;

  it("la même adresse pro, un même domaine : la même clé domaine (donc une seule demande comptée)", () => {
    const a = clesDeComptage({ ...base, emailHash: "h1", email: "a@societe-exemple.fr" });
    const b = clesDeComptage({ ...base, emailHash: "h2", email: "b@societe-exemple.fr" });
    expect(a.domaine).not.toBeNull();
    expect(a.domaine).toBe(b.domaine);
    expect(a.personne).not.toBe(b.personne);
  });

  it("deux adresses gmail : pas de clé domaine, deux demandes comptées", () => {
    const a = clesDeComptage({ ...base, emailHash: "h1", email: "a@gmail.com" });
    const b = clesDeComptage({ ...base, emailHash: "h2", email: "b@gmail.com" });
    expect(a.domaine).toBeNull();
    expect(b.domaine).toBeNull();
    expect(a.personne).not.toBe(b.personne);
  });

  it("le même téléphone : la même clé téléphone, dans la même ville seulement", () => {
    const a = clesDeComptage({
      ...base,
      emailHash: "h1",
      email: "a@gmail.com",
      telephoneFin: "612345678",
    });
    const b = clesDeComptage({
      ...base,
      emailHash: "h2",
      email: "b@gmail.com",
      telephoneFin: "612345678",
    });
    const ailleurs = clesDeComptage({
      villeCle: "paris",
      emailHash: "h2",
      email: "b@gmail.com",
      telephoneFin: "612345678",
    });
    expect(a.telephone).toBe(b.telephone);
    expect(a.telephone).not.toBe(ailleurs.telephone);
  });

  it("sans téléphone ni empreinte, les clés absentes ne bloquent rien", () => {
    const c = clesDeComptage({ ...base, emailHash: null, email: "a@gmail.com" });
    expect(c.personne).toBeNull();
    expect(c.telephone).toBeNull();
  });
});
