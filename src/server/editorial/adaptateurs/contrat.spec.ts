/**
 * Console éditoriale — tests des adaptateurs de publication (lot 5).
 *
 * Deux choses se vérifient ici, et la seconde compte plus que la première :
 *
 *   1. le contrat du §10 est respecté — notamment l'IDEMPOTENCE, sa clause la
 *      plus importante et la plus facile à trahir ;
 *   2. les portes fermées le DISENT. Une porte fermée qui se tait est une
 *      porte qu'on croit ouverte, et TikTok en est l'exemple le plus coûteux.
 */

import { describe, it, expect } from "vitest";
import {
  adaptateurManuel,
  adaptateurPour,
  porteDe,
  disponibiliteAutomatique,
  PORTES,
  type PublicationAPublier,
  type AssetAPublier,
  type Plateforme,
} from "./contrat";

const publication: PublicationAPublier = {
  id: "p1",
  corps: "Automatiser une relance client.",
  premierCommentaire: "Le détail est ici.",
  lienUrl: null,
  tags: ["IAPourPME"],
};

const asset: AssetAPublier = {
  id: "a1",
  type: "image",
  cheminObjet: "ab/cd/xyz.png",
  dureeSec: null,
};

describe("l'adaptateur manuel", () => {
  it("est TOUJOURS disponible — il ne dépend d'aucune porte", async () => {
    const d = await adaptateurManuel.estDisponible({
      id: "c1",
      plateforme: "linkedin",
      identite: "perso",
      libelle: "Profil",
    });
    expect(d.ok).toBe(true);
  });

  it("valide une publication qui a un corps", async () => {
    const r = await adaptateurManuel.valider(publication, [asset]);
    expect(r.valide).toBe(true);
    expect(r.erreurs).toHaveLength(0);
  });

  it("🔴 REFUSE une publication sans corps — il n'y a rien à coller", async () => {
    const r = await adaptateurManuel.valider({ ...publication, corps: null }, []);
    expect(r.valide).toBe(false);
    expect(r.erreurs[0]).toContain("rien à coller");
  });

  it("AVERTIT sur un asset sans fichier, sans pour autant refuser", async () => {
    const r = await adaptateurManuel.valider(publication, [{ ...asset, cheminObjet: null }]);
    expect(r.valide).toBe(true);
    expect(r.avertissements[0]).toContain("archive");
  });

  it("🔴 est IDEMPOTENT : rejouer avec une référence ne republie pas", async () => {
    // La clause la plus importante du §10 : « rejouer ne publie JAMAIS deux
    // fois ». Un double clic, un rejeu après timeout, une reprise de file.
    const r = await adaptateurManuel.publier(publication, [], "https://linkedin.com/post/123");
    expect(r.dejaPublie).toBe(true);
    expect(r.refExterne).toBe("https://linkedin.com/post/123");
  });

  it("🔴 REFUSE de publier tout seul, et dit quoi faire à la place", async () => {
    // Il ne prétend pas envoyer : il enregistre ce que l'humain a fait.
    await expect(adaptateurManuel.publier(publication, [], null)).rejects.toThrow(
      /kit de publication|collez/i,
    );
  });
});

describe("le registre des portes", () => {
  it("🔴 n'annonce AUCUNE porte ouverte à ce jour", () => {
    // Ce test est le garde-fou contre l'optimisme : le jour où quelqu'un
    // ouvrira une porte, il devra le faire ici ET adapter ce test, donc y
    // réfléchir. Une porte qui s'ouvre par accident est un envoi sauvage.
    expect(PORTES.every((p) => !p.ouverte)).toBe(true);
  });

  it("donne à chaque porte son lot et son exigence, en clair", () => {
    for (const p of PORTES) {
      expect(p.lot, p.plateforme).toMatch(/^5[a-e]$/);
      expect(p.exigence.length, p.plateforme).toBeGreaterThan(30);
    }
  });

  it("couvre les cinq plateformes publiables", () => {
    const couvertes = PORTES.map((p) => p.plateforme).sort();
    expect(couvertes).toEqual(["facebook", "instagram", "linkedin", "tiktok", "youtube"]);
  });

  it("🔴 TikTok DIT que sans audit les publications partent en privé", () => {
    // Le pire mode d'échec possible : silencieux et durable. Un adaptateur
    // qui publierait quand même rendrait un statut « publié », une référence
    // externe, aucune erreur — et personne ne verrait jamais les vidéos.
    const tiktok = porteDe("tiktok");
    expect(tiktok?.sansLaPorte).toBeTruthy();
    expect(tiktok?.sansLaPorte).toMatch(/priv/i);
    expect(tiktok?.lot).toBe("5e");
  });
});

describe("adaptateurPour — le repli qui protège", () => {
  it("retombe sur MANUEL tant que la porte est fermée", () => {
    for (const plateforme of ["linkedin", "youtube", "tiktok", "facebook"] as Plateforme[]) {
      expect(adaptateurPour(plateforme).code, plateforme).toBe("manuel");
    }
  });

  it("retombe sur manuel pour une plateforme sans porte prévue", () => {
    expect(adaptateurPour("email").code).toBe("manuel");
    expect(adaptateurPour("site").code).toBe("manuel");
  });
});

describe("disponibiliteAutomatique — le refus qui explique", () => {
  it("🔴 REFUSE toutes les plateformes, en citant la porte et le lot", () => {
    for (const p of PORTES) {
      const d = disponibiliteAutomatique(p.plateforme);
      expect(d.ok, p.plateforme).toBe(false);
      expect(d.lot, p.plateforme).toBe(p.lot);
      expect(d.raison, p.plateforme).toContain("Porte fermée");
    }
  });

  it("dit qu'aucune automatisation n'est prévue pour l'e-mail et le site", () => {
    const d = disponibiliteAutomatique("email");
    expect(d.ok).toBe(false);
    expect(d.raison).toContain("kit de publication");
  });

  it("🔴 ne rend JAMAIS un refus sans raison", () => {
    // « Non disponible » tout seul laisse croire à une panne, et on
    // recommence trois fois.
    for (const plateforme of [
      "linkedin",
      "youtube",
      "facebook",
      "instagram",
      "tiktok",
      "email",
      "site",
    ] as Plateforme[]) {
      const d = disponibiliteAutomatique(plateforme);
      if (!d.ok) expect(d.raison?.length ?? 0, plateforme).toBeGreaterThan(30);
    }
  });
});
