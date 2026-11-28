/** Gabarit Analyse (G1) — fonctions pures : numéros de section, relance, coupe du milieu, retours. */
import { describe, expect, it } from "vitest";
import { compterMots, preparerCorpsAnalyse, SEUIL_MOTS_RETOUR_SOMMAIRE } from "@/lib/blog/analyse";

const lib = {
  ancreLabel: (titre: string) => `Lien vers la section « ${titre} »`,
  relanceLibelle: "Dans la suite",
  retourLibelle: "Revenir au sommaire",
  ancreSommaire: "sommaire-article",
};
const h2 = (id: string, t = id) => `<h2 id="${id}">${t}</h2><p>texte ${id}</p>`;
const corps = (n: number) =>
  Array.from({ length: n }, (_, i) => h2(`s${i + 1}`, `Titre ${i + 1}`)).join("");

describe("preparerCorpsAnalyse", () => {
  it("numérote chaque H2 « 01 / 04 » avant le titre, ancre partageable comprise", () => {
    const { avant, apres } = preparerCorpsAnalyse(corps(4), lib);
    const tout = avant + apres;
    expect(tout).toContain('<span aria-hidden="true">01 / 04</span>');
    expect(tout).toContain('<span aria-hidden="true">04 / 04</span>');
    expect(tout).toContain('href="#s2"');
    expect(tout).toContain('aria-label="Lien vers la section « Titre 2 »"');
    expect(tout.indexOf("01 / 04")).toBeLessThan(tout.indexOf('<h2 id="s1"'));
  });

  it("ne touche pas au texte du H2 ni à son id", () => {
    const { avant, apres } = preparerCorpsAnalyse(corps(2), lib);
    expect(avant + apres).toContain('<h2 id="s1">Titre 1</h2>');
  });

  it("est idempotent", () => {
    const une = preparerCorpsAnalyse(corps(5), lib);
    const deux = preparerCorpsAnalyse(une.avant + une.apres, lib);
    expect((deux.avant + deux.apres).match(/num-section/g)).toHaveLength(5);
  });

  it("coupe avant la 4e section : trois sections avant, le reste après", () => {
    const { avant, apres } = preparerCorpsAnalyse(corps(6), lib);
    expect(avant).toContain('id="s3"');
    expect(avant).not.toContain('id="s4"');
    expect(apres.startsWith('<div class="num-section">')).toBe(true);
    expect(apres).toContain('id="s4"');
  });

  it("moins de quatre sections : tout est avant, rien après", () => {
    const r = preparerCorpsAnalyse(corps(3), lib);
    expect(r.apres).toBe("");
    expect(r.avant).toContain('id="s3"');
  });

  it("sans H2 : html rendu tel quel", () => {
    const r = preparerCorpsAnalyse("<p>Court</p>", lib);
    expect(r).toEqual({ avant: "<p>Court</p>", apres: "" });
  });

  it("une relance « Dans la suite » pointe vers un vrai H2, seulement avec 5 sections ou plus", () => {
    const six = preparerCorpsAnalyse(corps(6), lib);
    const tout = six.avant + six.apres;
    expect(tout.match(/class="relance"/g)).toHaveLength(1);
    expect(tout).toContain('<a href="#s4">Titre 4</a>');
    const quatre = preparerCorpsAnalyse(corps(4), lib);
    expect(quatre.avant + quatre.apres).not.toContain("relance");
  });

  it("échappe le titre dans la relance et le label", () => {
    const html = corps(3) + h2("s4", "A &lt;b&gt; &amp; <em>C</em>") + h2("s5");
    const r = preparerCorpsAnalyse(html, lib);
    const tout = r.avant + r.apres;
    expect(tout).toContain('<a href="#s4">A &lt;b&gt; &amp; C</a>');
    expect(tout).toContain('aria-label="Lien vers la section « A &lt;b&gt; &amp; C »"');
  });

  it("« Revenir au sommaire » seulement au-delà du seuil de mots, jamais avant la 1re section", () => {
    const court = preparerCorpsAnalyse(corps(5), lib);
    expect(court.avant + court.apres).not.toContain("retour-sommaire");
    const long = corps(5).replace(
      "texte s1",
      Array(SEUIL_MOTS_RETOUR_SOMMAIRE + 10)
        .fill("mot")
        .join(" "),
    );
    const r = preparerCorpsAnalyse(long, lib);
    const tout = r.avant + r.apres;
    expect(tout).toContain('href="#sommaire-article"');
    expect(tout.match(/retour-sommaire/g)!.length).toBe(4);
    expect(tout.indexOf("retour-sommaire")).toBeGreaterThan(tout.indexOf('id="s1"'));
  });
});

describe("compterMots", () => {
  it("ignore les balises", () => {
    expect(compterMots("<p>un <strong>deux</strong> trois</p>")).toBe(3);
    expect(compterMots("")).toBe(0);
  });
});
