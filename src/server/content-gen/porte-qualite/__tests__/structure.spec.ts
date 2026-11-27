import { describe, expect, it } from "vitest";
import { liens } from "../html";
import { evaluerPorte } from "../porte";
import { contenuValide, contexteValide, corpsValide, mots, REPONSE_DIRECTE } from "./fixtures";

function statut(id: string, html: string) {
  const v = evaluerPorte(contenuValide({ corpsHtml: html }), contexteValide());
  return v.criteres.find((c) => c.id === id)!;
}

describe("B11a : un seul H1", () => {
  it("accepte exactement un H1", () => {
    expect(statut("B11a", corpsValide()).statut).toBe("ok");
  });
  it("refuse l'absence de H1", () => {
    const html = corpsValide().replace(/<h1>.*?<\/h1>/, "");
    expect(statut("B11a", html).statut).toBe("echec");
  });
  it("refuse deux H1, même avec attributs et majuscules", () => {
    const html = corpsValide() + '<H1 class="x">Second titre</H1>';
    const r = statut("B11a", html);
    expect(r.statut).toBe("echec");
    expect(r.raison).toMatch(/2/);
  });
  it("ignore un H1 écrit dans un script JSON-LD ou un commentaire", () => {
    const html =
      corpsValide() + '<script type="application/ld+json">"<h1>x</h1>"</script><!-- <h1>y</h1> -->';
    expect(statut("B11a", html).statut).toBe("ok");
  });
});

describe("B11b : aucun saut de niveau de titre", () => {
  it("accepte h1 → h2 → h3 → h2", () => {
    const html = `<h1>T</h1><p>${mots(30)}</p><h2>A</h2><h3>B</h3><h2>C</h2>`;
    expect(statut("B11b", html).statut).toBe("ok");
  });
  it("accepte une remontée de h4 à h2", () => {
    const html = `<h1>T</h1><h2>A</h2><h3>B</h3><h4>C</h4><h2>D</h2>`;
    expect(statut("B11b", html).statut).toBe("ok");
  });
  it("refuse h2 → h4", () => {
    const html = `<h1>T</h1><h2>A</h2><h4>C</h4>`;
    const r = statut("B11b", html);
    expect(r.statut).toBe("echec");
    expect(r.raison).toMatch(/h4.*h2/i);
  });
  it("refuse un contenu qui commence par un h2 (pas de h1 au-dessus)", () => {
    expect(statut("B11b", `<h2>A</h2><h3>B</h3>`).statut).toBe("echec");
  });
});

describe("B11c : réponse directe sous le H1", () => {
  it("accepte un paragraphe de réponse juste sous le H1", () => {
    expect(statut("B11c", corpsValide()).statut).toBe("ok");
  });
  it("refuse quand un H2 suit directement le H1", () => {
    const html = `<h1>T</h1><h2>A</h2><p>${mots(60)}</p>`;
    expect(statut("B11c", html).statut).toBe("echec");
  });
  it("permet une image d'en-tête entre le H1 et la réponse", () => {
    const html = `<h1>T</h1><img src="/a.png" alt="x"><figure><img src="/b.png" alt="y"></figure><p>${REPONSE_DIRECTE}</p>`;
    expect(statut("B11c", html).statut).toBe("ok");
  });
  it("refuse quand une liste ou un tableau précède le paragraphe", () => {
    const html = `<h1>T</h1><ul><li>a</li></ul><p>${REPONSE_DIRECTE}</p>`;
    expect(statut("B11c", html).statut).toBe("echec");
  });
  it("refuse un paragraphe trop court (moins de 20 mots)", () => {
    const html = `<h1>T</h1><p>${mots(8)}</p><h2>A</h2>`;
    expect(statut("B11c", html).statut).toBe("echec");
  });
  it("refuse quand la réponse finit après les 150 premiers mots", () => {
    const html = `<h1>T</h1><p>${mots(200)}</p>`;
    expect(statut("B11c", html).statut).toBe("echec");
  });
  it("refuse sans H1 (rien sous lequel chercher)", () => {
    expect(statut("B11c", `<p>${REPONSE_DIRECTE}</p>`).statut).toBe("echec");
  });
});

describe("lecture des liens", () => {
  it("ne confond pas data-href avec href", () => {
    expect(liens('<a data-href="/x" href="/y">z</a>').map((l) => l.href)).toEqual(["/y"]);
  });
});
