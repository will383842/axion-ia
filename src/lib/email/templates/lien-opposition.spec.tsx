// Le lien « Ne plus recevoir de sollicitations commerciales » — lot 1b (2026-09-02).
//
// Gardé ici, sur les 44 gabarits rendus AVEC un destinataire, comme le worker
// le fait :
//   - famille A : jamais de lien d'opposition (une facture, un lien de
//     connexion ne se « désabonnent » pas) ;
//   - familles B, C, D : le lien est là, il porte un jeton VALIDE pour ce
//     destinataire, et il tient dans le budget de liens du régime ;
//   - la famille est estampillée dans le HTML (`data-famille`), c'est ce que
//     le worker lit pour décider de l'en-tête RFC 8058 ;
//   - sans destinataire (aperçus, tests), aucun lien, aucun jeton fantôme ;
//   - (audit S2) l'attente ne se déduit PAS des attributs `data-*` que le châssis pose lui-même
//     (un test qui se valide tout seul) : elle vient d'une liste figée et nommée de gabarits
//     autorisés à ne pas porter le lien. Et la famille D comme la nature « marketing » gardent
//     le lien quoi que le gabarit déclare.

import { describe, it, expect, beforeAll, vi } from "vitest";

import { render } from "@react-email/render";
import { Text } from "@react-email/components";
import { renderEmailTemplate, EMAIL_TEMPLATE_NAMES, familleDuHtml } from "./index";
import {
  EmailLayout,
  REGIME_FAMILLE,
  avecDonneesRendu,
  type DestinataireEmail,
  type NatureEmail,
} from "./_layout";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { lireJetonOpposition } from "@/server/email/opposition-jeton";

const DESTINATAIRE = "jean.dupont@client-test.fr";

function liensDistincts(html: string): Set<string> {
  return new Set((html.match(/href="([^"]+)"/g) ?? []).map((h) => h.slice(6, -1)));
}

/** Valeur d'un attribut `data-*` estampillé sur le <body> par le châssis, ou null. */
function estampille(html: string, attribut: string): string | null {
  const m = new RegExp(`data-${attribut}="([^"]*)"`).exec(html);
  return m ? (m[1] as string) : null;
}

/**
 * Liste FIGÉE et NOMMÉE des gabarits (hors famille A) autorisés à ne PAS porter le lien
 * d'opposition. État de main au 2026-11-17, relevé par le rendu de chacun des gabarits : aucun.
 * Tout ajout se voit en relecture : un gabarit qui perd son lien sans figurer ici rougit, même
 * si le châssis a été trompé par une mauvaise déclaration de `destinataire` ou de `nature`
 * (audit de sécurité S2, constat 2). La famille A n'a jamais le lien (une facture ne se
 * « désabonne » pas) : elle n'a pas besoin d'être listée.
 */
const GABARITS_SANS_LIEN_HORS_A: ReadonlySet<string> = new Set<string>([]);
function lienAttendu(nom: string, famille: string | null): boolean {
  if (famille === "A") return false;
  return !GABARITS_SANS_LIEN_HORS_A.has(nom);
}

function lienOpposition(html: string): string | null {
  const m = /href="([^"]*\/api\/unsubscribe\?token=op1\.[^"]+)"/.exec(html);
  return m ? m[1]!.replace(/&amp;/g, "&") : null;
}

beforeAll(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
  process.env["NEXT_PUBLIC_SITE_URL"] = "https://axion-ia.com";
});

describe("lien d'opposition — 44 gabarits rendus avec un destinataire", () => {
  for (const name of EMAIL_TEMPLATE_NAMES) {
    it(`${name} : famille estampillée, lien selon le régime, jeton valide`, async () => {
      const { html, famille } = await renderEmailTemplate(name, "fr", PAYLOAD_EXEMPLE, {
        destinataire: DESTINATAIRE,
      });
      expect(famille, `${name} : famille introuvable dans le HTML`).not.toBeNull();
      expect(familleDuHtml(html)).toBe(famille);

      const lien = lienOpposition(html);
      if (!lienAttendu(name, famille)) {
        expect(
          lien,
          `${name} (${famille}, ${estampille(html, "nature") ?? "nature non déclarée"}) ne doit ` +
            `porter aucun lien d'opposition`,
        ).toBeNull();
        return;
      }
      expect(lien, `${name} (${famille}) doit porter le lien d'opposition`).not.toBeNull();
      const jeton = decodeURIComponent(new URL(lien!).searchParams.get("token") ?? "");
      expect(lireJetonOpposition(jeton)).toBe(DESTINATAIRE);
      expect(liensDistincts(html).size).toBeLessThanOrEqual(REGIME_FAMILLE[famille!].budgetLiens);
    });
  }

  // ⚠️ TIMEOUT EXPLICITE, et ce n'est pas un contournement.
  //
  // Ce témoin-ci rend TOUS les gabarits dans UN seul `it`, là où le bloc
  // ci-dessus en fait un `it` par gabarit. Il consomme donc à lui seul le
  // budget de 5 s par défaut de Vitest, et ce budget se consomme à mesure que
  // le parc grandit : il a expiré au 51ᵉ gabarit (rappel de la veille,
  // 2026-09-05), après avoir tenu de justesse au 50ᵉ. Le seuil n'exprimait
  // aucune exigence — personne n'a jamais décidé que rendre le parc entier
  // devait tenir en cinq secondes — et l'assertion, elle, est inchangée.
  it("sans destinataire, aucun lien d'opposition n'est rendu — sur aucun gabarit", async () => {
    for (const name of EMAIL_TEMPLATE_NAMES) {
      const { html } = await renderEmailTemplate(name, "fr", PAYLOAD_EXEMPLE);
      expect(lienOpposition(html), `${name} : lien fantôme sans destinataire`).toBeNull();
    }
  }, 30_000);

  it("le libellé dit la portée : les sollicitations COMMERCIALES", async () => {
    const { html } = await renderEmailTemplate("roi-report", "fr", PAYLOAD_EXEMPLE, {
      destinataire: DESTINATAIRE,
    });
    expect(html).toContain("Ne plus recevoir de sollicitations commerciales");
  });
});

describe("lien d'opposition — une déclaration fausse ne le retire jamais d'une campagne", () => {
  const HREF = "https://axion-ia.com/api/unsubscribe?token=op1.jeton-de-test";

  async function rendreFactice(
    famille: "B" | "C" | "D",
    declaration: { destinataire: DestinataireEmail; nature?: NatureEmail },
  ): Promise<string> {
    const element = (
      <EmailLayout
        famille={famille}
        preview="Un pré-en-tête neutre qui prolonge l'objet sans le répéter."
        title="Titre"
        locale="fr"
        destinataire={declaration.destinataire}
        {...(declaration.nature !== undefined ? { nature: declaration.nature } : {})}
        {...(declaration.destinataire === "interne"
          ? {}
          : {
              ouverture: {
                identite: { prenom: "Camille" },
                information: "nous avons bien reçu votre demande et revenons vers vous.",
              },
            })}
      >
        <Text>corps</Text>
      </EmailLayout>
    );
    return avecDonneesRendu({ oppositionHref: HREF, lienEspace: null }, () =>
      render(element, { pretty: false }),
    );
  }

  it.each(["recouvrement", "droits", "reclamation", "alerte-interne"] as const)(
    "famille D déclarée nature « %s » : le lien est PRÉSENT (et l'erreur est signalée hors production)",
    async (nature) => {
      const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const html = await rendreFactice("D", { destinataire: "client", nature });
        expect(lienOpposition(html)).not.toBeNull();
        expect(erreur).toHaveBeenCalledWith(expect.stringContaining("[email/D]"));
        // Ni jeton ni donnée de personne dans le journal.
        expect(JSON.stringify(erreur.mock.calls)).not.toMatch(/op1\.|Camille/);
      } finally {
        erreur.mockRestore();
      }
    },
  );

  it("famille D déclarée destinataire « interne » : le lien est PRÉSENT (et signalé)", async () => {
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const html = await rendreFactice("D", { destinataire: "interne", nature: "alerte-interne" });
      expect(lienOpposition(html)).not.toBeNull();
      expect(erreur).toHaveBeenCalledWith(expect.stringContaining("[email/D]"));
    } finally {
      erreur.mockRestore();
    }
  });

  it("nature « marketing » en famille B ou C déclarée interne : le lien est PRÉSENT", async () => {
    for (const famille of ["B", "C"] as const) {
      const html = await rendreFactice(famille, { destinataire: "interne", nature: "marketing" });
      expect(lienOpposition(html), famille).not.toBeNull();
    }
  });

  it("hors famille D et hors marketing, les natures sans opposition restent sans lien", async () => {
    for (const nature of ["recouvrement", "droits", "reclamation", "alerte-interne"] as const) {
      const html = await rendreFactice("B", { destinataire: "client", nature });
      expect(lienOpposition(html), nature).toBeNull();
    }
    expect(lienOpposition(await rendreFactice("B", { destinataire: "interne" }))).toBeNull();
  });
});
