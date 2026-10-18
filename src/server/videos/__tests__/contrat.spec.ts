import { describe, it, expect } from "vitest";
import { analyserPublication, analyserRetrait } from "../contrat";
import { publicationValide } from "./fixtures";

function champsFautifs(entree: unknown): string[] {
  const r = analyserPublication(entree);
  return r.ok ? [] : r.champs;
}

describe("analyserPublication — schemaVersion 1", () => {
  it("une publication valide passe", () => {
    expect(analyserPublication(publicationValide()).ok).toBe(true);
  });

  it("champ inconnu → refusé (strict)", () => {
    expect(champsFautifs({ ...publicationValide(), surprise: 1 }).join(" ")).toMatch(/surprise/);
  });

  it("champ inconnu dans un objet imbriqué → refusé", () => {
    const v = publicationValide();
    expect(champsFautifs({ ...v, ia: { ...v.ia, autre: true } }).length).toBeGreaterThan(0);
  });

  it("schemaVersion ≠ 1 → refusé", () => {
    expect(champsFautifs({ ...publicationValide(), schemaVersion: 2 })).toContain("schemaVersion");
  });

  it.each([2, 4])("aRetenir à %i éléments → refusé", (n) => {
    const aRetenir = Array.from(
      { length: n },
      (_, i) => `Un point à retenir numéro ${i} bien rédigé.`,
    );
    expect(champsFautifs(publicationValide({ aRetenir }))).toContain("aRetenir");
  });

  it.each([1, 4])("%i question(s) → refusé", (n) => {
    const questions = Array.from({ length: n }, (_, i) => ({
      question: `Une question suffisamment longue numéro ${i} ?`,
      reponse:
        "Une réponse suffisamment développée pour passer la borne minimale de quarante caractères.",
    }));
    expect(champsFautifs(publicationValide({ questions }))).toContain("questions");
  });

  it("chapitres sur une vidéo de 29 s → refusé", () => {
    expect(
      champsFautifs(
        publicationValide({
          dureeSecondes: 29,
          chapitres: [
            { titre: "Un", debutSecondes: 0 },
            { titre: "Deux", debutSecondes: 10 },
          ],
        }),
      ),
    ).toContain("chapitres");
  });

  it("vidéo de 29 s sans chapitre → acceptée", () => {
    expect(analyserPublication(publicationValide({ dureeSecondes: 29, chapitres: [] })).ok).toBe(
      true,
    );
  });

  it("deux chapitres au même début → refusé", () => {
    expect(
      champsFautifs(
        publicationValide({
          chapitres: [
            { titre: "A", debutSecondes: 10 },
            { titre: "B", debutSecondes: 10 },
          ],
        }),
      ),
    ).toContain("chapitres");
  });

  it("chapitres non croissants → refusé", () => {
    expect(
      champsFautifs(
        publicationValide({
          chapitres: [
            { titre: "A", debutSecondes: 50 },
            { titre: "B", debutSecondes: 10 },
          ],
        }),
      ),
    ).toContain("chapitres");
  });

  it("chapitre débutant à la durée ou après → refusé", () => {
    expect(
      champsFautifs(
        publicationValide({
          chapitres: [
            { titre: "A", debutSecondes: 0 },
            { titre: "B", debutSecondes: 184 },
          ],
        }),
      ),
    ).toContain("chapitres");
  });

  it("chemin de fichier d'une autre vidéo → refusé", () => {
    const v = publicationValide();
    const fichiers = {
      ...v.fichiers,
      video: { ...v.fichiers.video, chemin: "/medias/videos/autre-video/v3/video-1080p.mp4" },
    };
    expect(champsFautifs({ ...v, fichiers })).toContain("fichiers.video.chemin");
  });

  it("chemin de fichier d'une autre version → refusé", () => {
    const v = publicationValide();
    const fichiers = {
      ...v.fichiers,
      affiche169: {
        ...v.fichiers.affiche169,
        chemin: "/medias/videos/automatiser-ses-relances/v2/affiche-16x9.avif",
      },
    };
    expect(champsFautifs({ ...v, fichiers })).toContain("fichiers.affiche169.chemin");
  });

  it("chemin avec remontée de répertoire → refusé", () => {
    const v = publicationValide();
    const fichiers = {
      ...v.fichiers,
      video: {
        ...v.fichiers.video,
        chemin: "/medias/videos/automatiser-ses-relances/v3/../../secret.mp4",
      },
    };
    expect(champsFautifs({ ...v, fichiers }).length).toBeGreaterThan(0);
  });

  it("sous-titres obligatoires (D8)", () => {
    const v = publicationValide();
    expect(
      champsFautifs({ ...v, fichiers: { ...v.fichiers, sousTitres: null } }).length,
    ).toBeGreaterThan(0);
  });

  it("attestation aucunNomNiLogoDeClient à false → refusé", () => {
    expect(
      champsFautifs(publicationValide({ attestations: { aucunNomNiLogoDeClient: false } })),
    ).toContain("attestations.aucunNomNiLogoDeClient");
  });

  it("langue ≠ fr → refusé", () => {
    expect(champsFautifs(publicationValide({ langue: "en" }))).toContain("langue");
  });

  it("slug non conforme ou > 80 car. → refusé", () => {
    expect(champsFautifs(publicationValide({ slug: "Mauvais Slug" }))).toContain("slug");
    expect(champsFautifs(publicationValide({ slug: "a".repeat(81) }))).toContain("slug");
  });

  it("titre trop court / résumé trop court → refusé", () => {
    expect(champsFautifs(publicationValide({ titre: "Court" }))).toContain("titre");
    expect(champsFautifs(publicationValide({ resume: "Trop court." }))).toContain("resume");
  });

  it("durée hors 5..3600 → refusé", () => {
    expect(champsFautifs(publicationValide({ dureeSecondes: 4, chapitres: [] }))).toContain(
      "dureeSecondes",
    );
    expect(champsFautifs(publicationValide({ dureeSecondes: 3601 }))).toContain("dureeSecondes");
  });

  it("série : rang entier ≥ 1, ou null accepté", () => {
    expect(analyserPublication(publicationValide({ serie: null })).ok).toBe(true);
    expect(
      champsFautifs(publicationValide({ serie: { slug: "s-s", titre: "Série", rang: 0 } })),
    ).toContain("serie.rang");
  });

  it("thème hors de la liste fermée → refusé (W3.1)", () => {
    expect(champsFautifs(publicationValide({ theme: "cuisine" }))).toContain("theme");
  });

  it("lien de type inconnu → refusé", () => {
    expect(
      champsFautifs(publicationValide({ lien: { type: "externe", chemin: "/fr/x" } })),
    ).toContain("lien.type");
  });

  it("lien hors /fr/ (domaine externe) → refusé", () => {
    expect(
      champsFautifs(
        publicationValide({ lien: { type: "service", chemin: "https://exemple.invalid/x" } }),
      ),
    ).toContain("lien.chemin");
  });
});

describe("analyserRetrait", () => {
  const ok = { schemaVersion: 1, studioVideoId: "vs_01j9abcdefgh", motif: "obsolete" };
  it("valide", () => {
    expect(analyserRetrait(ok).ok).toBe(true);
  });
  it("motif inconnu → refusé", () => {
    expect(analyserRetrait({ ...ok, motif: "caprice" }).ok).toBe(false);
  });
  it("champ inconnu → refusé", () => {
    expect(analyserRetrait({ ...ok, x: 1 }).ok).toBe(false);
  });
});
