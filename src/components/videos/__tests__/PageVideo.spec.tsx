// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageVideo } from "../PageVideo";
import { uneVideo } from "@/app/[locale]/videos/__tests__/fixture";

const rendre = (video = uneVideo(), liees = [] as ReturnType<typeof uneVideo>[]) =>
  renderToStaticMarkup(<PageVideo video={video} liees={liees} />);

describe("PageVideo — une page jamais pauvre (§6.5)", () => {
  it("affiche le résumé, les 3 « À retenir » et les questions-réponses VISIBLES", () => {
    const h = rendre();
    expect(h).toContain("RESUME-VISIBLE");
    for (const p of ["POINT-UN", "POINT-DEUX", "POINT-TROIS"]) expect(h).toContain(p);
    for (const t of ["QUESTION-UNE", "REPONSE-UNE", "QUESTION-DEUX", "REPONSE-DEUX"]) {
      expect(h).toContain(t);
    }
  });

  it("les questions ne sont PAS dans un <details> fermé (visibles)", () => {
    const h = rendre();
    const avant = h.slice(0, h.indexOf("QUESTION-UNE"));
    expect(avant.lastIndexOf("<details")).toBeLessThanOrEqual(avant.lastIndexOf("</details>"));
  });

  it("aucun balisage FAQPage (réservé aux sites gouvernementaux et de santé)", () => {
    expect(rendre()).not.toMatch(/FAQPage/);
  });

  it("lien vers le service du contrat", () => {
    expect(rendre()).toMatch(/<a[^>]*href="\/fr\/implementation"/);
  });

  it("lien vers la formation quand le contrat en désigne une", () => {
    const h = rendre(uneVideo({ lien: { type: "formation", chemin: "/fr/formations/chatgpt" } }));
    expect(h).toMatch(/<a[^>]*href="\/fr\/formations\/chatgpt"/);
  });

  it("seule vidéo → AUCUN lien vers une autre vidéo", () => {
    expect(rendre(uneVideo(), [])).not.toMatch(/href="\/fr\/videos\//);
  });

  it("vidéos liées : cartes serveur (lien + titre + durée), sans lecteur ni JS", () => {
    const autre = uneVideo({ slug: "une-autre", titre: "Une autre vidéo du même thème" });
    const h = rendre(uneVideo(), [autre]);
    expect(h).toMatch(/<a[^>]*href="\/fr\/videos\/une-autre"/);
    expect(h).toContain("Une autre vidéo du même thème");
    // un seul <video> sur la page : celui de la vidéo courante
    expect(h.match(/<video/g)).toHaveLength(1);
  });

  it("transcription repliée quand elle existe, absente sinon", () => {
    expect(rendre()).not.toContain("transcription");
    const h = rendre(uneVideo({ transcription: "Bonjour.\n\nDeuxième paragraphe." }));
    expect(h).toMatch(/<details/);
    expect(h).toContain("Deuxième paragraphe.");
  });
});
