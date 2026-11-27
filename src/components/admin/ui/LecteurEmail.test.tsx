import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LecteurEmail } from "./LecteurEmail";

const HTML = "<p>Bonjour</p><script>window.parent.document.title='x'</script>";

describe("LecteurEmail", () => {
  it("isole le corps : sandbox vide, pas de allow-same-origin, no-referrer, srcDoc", () => {
    const { container } = render(<LecteurEmail html={HTML} />);
    const cadre = container.querySelector("iframe");
    expect(cadre?.getAttribute("sandbox")).toBe("");
    expect(cadre?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(cadre?.getAttribute("srcdoc")).toContain(HTML);
    expect(container.innerHTML).not.toContain("allow-same-origin");
    expect(cadre?.getAttribute("sandbox")).not.toContain("allow-scripts");
    expect(cadre?.hasAttribute("allow")).toBe(false);
  });

  it("pose une CSP restrictive en tête du srcDoc : aucune image hors du site", () => {
    const { container } = render(<LecteurEmail html={HTML} />);
    const doc = new DOMParser().parseFromString(
      container.querySelector("iframe")?.getAttribute("srcdoc") ?? "",
      "text/html",
    );
    const csp = doc.querySelector("meta[http-equiv='Content-Security-Policy']");
    const regle = csp?.getAttribute("content") ?? "";
    expect(regle).toContain("default-src 'none'");
    expect(regle).toContain("img-src data: https://axion-ia.com");
    expect(regle).not.toMatch(/img-src[^;]*\shttps:(\s|;|$)/);
    expect(regle).not.toContain("script-src");
    // En tête : avant tout contenu de l'e-mail.
    expect(doc.head.firstElementChild).toBe(csp);
  });

  it("garde le doctype en première position (pas de mode quirks)", () => {
    const { container } = render(
      <LecteurEmail html={"<!DOCTYPE html><html><body>x</body></html>"} />,
    );
    expect(container.querySelector("iframe")?.getAttribute("srcdoc")).toMatch(
      /^<!DOCTYPE html><meta http-equiv="Content-Security-Policy"/,
    );
  });

  it("titre du cadre propre à l'e-mail, groupes de bascules en radiogroup", () => {
    const { container } = render(<LecteurEmail html={HTML} objet="Votre devis" />);
    expect(container.querySelector("iframe")?.getAttribute("title")).toBe("Aperçu : Votre devis");
    expect(container.querySelectorAll("[role='radiogroup']").length).toBe(2);
  });

  it("chaque valeur de bascule a son sélecteur :has() dans admin.css", () => {
    const tsx = readFileSync("src/components/admin/ui/LecteurEmail.tsx", "utf8");
    const css = readFileSync("src/app/admin.css", "utf8");
    const valeurs = [...tsx.matchAll(/valeur:\s*"([a-z]+)"/g)].map((m) => m[1]);
    expect(valeurs.length).toBeGreaterThanOrEqual(6);
    // Les valeurs par défaut (ordinateur, clair, html) sont l'état sans sélecteur.
    const defauts = new Set(["ordinateur", "clair", "html"]);
    for (const v of valeurs.filter((x) => !defauts.has(x as string))) {
      expect(css).toContain(`.admin-lecteur-email:has(input[value="${v}"]`);
    }
    expect(css).not.toMatch(/admin-lecteur-email[^{]*\{[^}]*invert\(/);
  });

  it("n'affiche que les lignes d'en-tête fournies", () => {
    const { container, rerender } = render(<LecteurEmail html={HTML} />);
    expect(container.querySelector("dl")).toBeNull();
    rerender(<LecteurEmail html={HTML} a="client@example.com" objet="Bonjour" />);
    expect(screen.getByText("À")).toBeDefined();
    expect(screen.getByText("Objet")).toBeDefined();
    expect(screen.queryByText("De")).toBeNull();
    expect(screen.queryByText("Répondre à")).toBeNull();
    expect(screen.queryByText("Pré-en-tête")).toBeNull();
    expect(screen.queryByText("Pièces jointes")).toBeNull();
  });

  it("affiche toutes les lignes quand tout est fourni", () => {
    render(
      <LecteurEmail
        html={HTML}
        de="Axion IA <contact@example.com>"
        a="client@example.com"
        repondreA="reponse@example.com"
        objet="Votre devis"
        preEntete="Le devis est joint"
        piecesJointes={["devis.pdf", "annexe.pdf"]}
      />,
    );
    for (const l of ["De", "À", "Répondre à", "Objet", "Pré-en-tête", "Pièces jointes"]) {
      expect(screen.getByText(l)).toBeDefined();
    }
    expect(screen.getByText("devis.pdf")).toBeDefined();
    expect(screen.getByText("annexe.pdf")).toBeDefined();
  });

  it("propose ordinateur / téléphone et clair / sombre, sans HTML / texte si pas de texte", () => {
    const { container } = render(<LecteurEmail html={HTML} />);
    const valeurs = [...container.querySelectorAll<HTMLInputElement>("input[type='radio']")].map(
      (r) => r.value,
    );
    expect(valeurs).toEqual(["ordinateur", "telephone", "clair", "sombre"]);
    expect(container.querySelector(".admin-lecteur-email-texte")).toBeNull();
    expect(screen.getByLabelText("Téléphone")).toBeDefined();
    expect(screen.getByLabelText("Sombre")).toBeDefined();
  });

  it("propose HTML / texte brut quand le texte est fourni, rendu comme du texte", () => {
    const { container } = render(<LecteurEmail html={HTML} texte="<b>brut</b>" />);
    expect(screen.getByLabelText("Texte brut")).toBeDefined();
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toBe("<b>brut</b>");
    expect(pre?.querySelector("b")).toBeNull();
  });

  it("garde les valeurs par défaut cochées et les radios hors de tout formulaire", () => {
    const { container } = render(
      <form>
        <LecteurEmail html={HTML} texte="t" />
      </form>,
    );
    const cochees = [...container.querySelectorAll<HTMLInputElement>("input:checked")].map(
      (r) => r.value,
    );
    expect(cochees).toEqual(["ordinateur", "clair", "html"]);
    const form = container.querySelector("form") as HTMLFormElement;
    expect([...new FormData(form).keys()]).toEqual([]);
  });

  it("liensInertes : le srcdoc contient pointer-events:none, absent sans la propriété", () => {
    const avec = render(<LecteurEmail html={HTML} liensInertes />);
    expect(avec.container.querySelector("iframe")?.getAttribute("srcdoc")).toContain(
      "pointer-events:none",
    );
    avec.unmount();
    const sans = render(<LecteurEmail html={HTML} />);
    expect(sans.container.querySelector("iframe")?.getAttribute("srcdoc")).not.toContain(
      "pointer-events:none",
    );
  });

  it("note des images : une image d'ailleurs l'affiche, une image du site non", () => {
    const ailleurs = render(
      <LecteurEmail html={'<img src="https://ailleurs.example/a.png" alt="">'} />,
    );
    expect(ailleurs.container.textContent).toContain("1 image hébergée ailleurs");
    ailleurs.unmount();
    const site = render(
      <LecteurEmail
        html={
          '<img src="https://axion-ia.com/logo.png" alt=""><img src="data:image/png;base64,AA" alt="">'
        }
      />,
    );
    expect(site.container.textContent).not.toContain("hébergée");
    expect(site.container.querySelector(".admin-lecteur-email-notes")).toBeNull();
  });

  it("pleinEcranHref : lien _blank avec noopener et noreferrer ; absent, aucun lien", () => {
    const avec = render(
      <LecteurEmail html={HTML} pleinEcranHref="/fr/x/emails/lecture/envoye/1" />,
    );
    const lien = avec.container.querySelector("a");
    expect(lien?.getAttribute("href")).toBe("/fr/x/emails/lecture/envoye/1");
    expect(lien?.getAttribute("target")).toBe("_blank");
    expect(lien?.getAttribute("rel")).toContain("noopener");
    expect(lien?.getAttribute("rel")).toContain("noreferrer");
    avec.unmount();
    const sans = render(<LecteurEmail html={HTML} />);
    expect(sans.container.querySelector("a")).toBeNull();
  });

  it('formatInitial="texte" coche la radio « Texte brut »', () => {
    render(<LecteurEmail html={HTML} texte="t" formatInitial="texte" />);
    expect((screen.getByLabelText("Texte brut") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("HTML") as HTMLInputElement).checked).toBe(false);
  });

  it("apercu étale les champs d'un ApercuLecteur", () => {
    render(<LecteurEmail apercu={{ html: HTML, objet: "Objet X", de: "d@example.com" }} />);
    expect(screen.getByText("Objet X")).toBeDefined();
    expect(screen.getByText("d@example.com")).toBeDefined();
  });

  describe("pièces jointes et liens de l'aperçu avant envoi", () => {
    const LIENS =
      '<a href="https://axion-ia.com/fr/tarifs" target="_blank">Voir les tarifs</a>' +
      '<a title="https://axion-ia.com/opposition?t=[masqué]">Me désinscrire</a>';

    it("pièces décrites : nom, poids et bouton « Ouvrir » vers un nouvel onglet", () => {
      render(
        <LecteurEmail
          html={HTML}
          piecesJointes={[
            { nom: "Contrat.pdf", taille: 348_160, href: "/fr/adm/emails/piece-jointe/x" },
          ]}
        />,
      );
      expect(screen.getByText("Pièces jointes")).toBeDefined();
      expect(screen.getByText("Contrat.pdf")).toBeDefined();
      expect(screen.getByText(/340 Ko/)).toBeDefined();
      const ouvrir = screen.getByRole("link", { name: "Ouvrir Contrat.pdf dans un nouvel onglet" });
      expect(ouvrir.getAttribute("href")).toBe("/fr/adm/emails/piece-jointe/x");
      expect(ouvrir.getAttribute("target")).toBe("_blank");
      expect(ouvrir.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("liste vide : « Aucune pièce jointe » ; liste absente : pas de ligne", () => {
      const { rerender } = render(<LecteurEmail html={HTML} piecesJointes={[]} />);
      expect(screen.getByText("Aucune pièce jointe")).toBeDefined();
      rerender(<LecteurEmail html={HTML} />);
      expect(screen.queryByText("Pièces jointes")).toBeNull();
    });

    it("liensOuvrables : base _blank, popups autorisés, jamais de script ni same-origin", () => {
      const { container } = render(<LecteurEmail html={LIENS} liensOuvrables />);
      const cadre = container.querySelector("iframe");
      expect(cadre?.getAttribute("sandbox")).toBe("allow-popups allow-popups-to-escape-sandbox");
      expect(cadre?.getAttribute("sandbox")).not.toMatch(/allow-scripts|allow-same-origin/);
      const doc = new DOMParser().parseFromString(cadre?.getAttribute("srcdoc") ?? "", "text/html");
      expect(doc.querySelector("base")?.getAttribute("target")).toBe("_blank");
      expect(doc.querySelector("style")).toBeNull();
    });

    it("liste « Liens de cet e-mail » : public cliquable, personnel non cliquable et signalé", () => {
      render(<LecteurEmail html={LIENS} liensOuvrables />);
      const liste = screen.getByRole("region", { name: "Liens de cet e-mail" });
      const public_ = screen.getByRole("link", { name: /Voir les tarifs/ });
      expect(liste.contains(public_)).toBe(true);
      expect(public_.getAttribute("href")).toBe("https://axion-ia.com/fr/tarifs");
      expect(public_.getAttribute("target")).toBe("_blank");
      expect(public_.getAttribute("rel")).toBe("noopener noreferrer");
      expect(screen.getByText("Me désinscrire")).toBeDefined();
      expect(screen.getByText(/lien personnel du destinataire/)).toBeDefined();
      expect(screen.getAllByRole("link")).toHaveLength(1);
    });

    it("sans liensOuvrables : cadre isolé comme avant, pas de liste", () => {
      const { container } = render(<LecteurEmail html={LIENS} liensInertes />);
      expect(container.querySelector("iframe")?.getAttribute("sandbox")).toBe("");
      expect(screen.queryByText("Liens de cet e-mail")).toBeNull();
    });
  });
});
