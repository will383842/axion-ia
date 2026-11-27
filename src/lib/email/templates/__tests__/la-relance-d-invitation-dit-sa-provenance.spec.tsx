// Les rappels J+3 / J+7 d'une personne saisie à la main par Axion (provenance `indirecte`)
// ne disent JAMAIS « candidature retenue » : elle n'a pas candidaté. Une personne venue
// d'un formulaire (sans provenance) garde le texte d'origine.

import { beforeAll, describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";
import { apporteurInvitationRelanceSubject } from "../apporteur-invitation-relance";
import { provenanceDeLaFiche } from "@/lib/commercial-application/demarche-invitation";

const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur-affaires";

function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

async function rendu(locale: "fr" | "en", etape: "j3" | "j7", extra: Record<string, unknown> = {}) {
  const r = await renderEmailTemplate(
    "apporteur-invitation-relance",
    locale,
    { contactName: "Camille Martin", calendlyUrl: CALENDLY, etape, ...extra },
    { destinataire: "camille@exemple.fr" },
  );
  return { ...r, lu: texte(r.html) };
}

const INDIRECTE = { mode: "indirecte", libelle: "par une personne qui vous recommande" };

beforeAll(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

describe("relance — provenance indirecte", () => {
  it.each(["j3", "j7"] as const)(
    "fr %s : propose l'échange sans « candidature retenue »",
    async (etape) => {
      const { lu } = await rendu("fr", etape, { provenance: INDIRECTE });
      expect(lu).toContain("aimerions échanger avec vous sur le réseau d'apporteurs Axion IA");
      expect(lu).not.toMatch(/candidature|retenue/i);
      expect(lu).toContain("Réserver mon créneau");
    },
  );

  it.each(["j3", "j7"] as const)("en %s : same, without « selected »", async (etape) => {
    const { lu } = await rendu("en", etape, { provenance: INDIRECTE });
    expect(lu).toContain("Axion IA business introducer network");
    expect(lu).not.toMatch(/application|selected/i);
  });

  it("l'objet ne parle pas de candidature", () => {
    for (const etape of ["j3", "j7"]) {
      for (const locale of ["fr", "en"] as const) {
        const s = apporteurInvitationRelanceSubject(locale, { provenance: INDIRECTE, etape });
        expect(s).not.toMatch(/candidature|application/i);
      }
    }
  });

  it("j7 garde la promesse de ne plus relancer", async () => {
    const { lu } = await rendu("fr", "j7", { provenance: INDIRECTE });
    expect(lu).toContain("nous ne vous relancerons plus");
  });
});

describe("relance — autres provenances : texte d'origine", () => {
  it("sans provenance : « candidature … retenue »", async () => {
    const { lu } = await rendu("fr", "j3");
    expect(lu).toContain("candidature au réseau d'apporteurs d'affaires d'Axion-IA est retenue");
  });

  it("provenance directe : texte d'origine (variante `indirecte` seulement pour une adresse reçue d'ailleurs)", async () => {
    const { lu } = await rendu("fr", "j3", {
      provenance: { mode: "directe", libelle: "par e-mail" },
    });
    expect(lu).toContain("est retenue");
  });

  it("une provenance malformée rend le texte d'origine", async () => {
    const { lu } = await rendu("fr", "j3", { provenance: "indirecte" });
    expect(lu).toContain("est retenue");
  });
});

describe("provenanceDeLaFiche — l'appelant des rappels", () => {
  it("recommandation → indirecte, dans la langue de la fiche", () => {
    const d = { origine: "saisie-manuelle", origineSaisie: "recommandation" };
    expect(provenanceDeLaFiche(d, "fr")).toEqual({
      provenance: { mode: "indirecte", libelle: "par une personne qui vous recommande" },
    });
    expect(provenanceDeLaFiche(d, "en")).toEqual({
      provenance: { mode: "indirecte", libelle: "from someone who recommends you" },
    });
  });

  it("e-mail direct → directe", () => {
    expect(
      provenanceDeLaFiche({ origine: "saisie-manuelle", origineSaisie: "email-direct" }, "fr"),
    ).toEqual({ provenance: { mode: "directe", libelle: "par e-mail" } });
  });

  it("fiche non saisie à la main, ou details illisible → rien", () => {
    expect(provenanceDeLaFiche({ origine: "formulaire" }, "fr")).toEqual({});
    expect(provenanceDeLaFiche(null, "fr")).toEqual({});
    expect(provenanceDeLaFiche([], "fr")).toEqual({});
    expect(provenanceDeLaFiche({ origine: "saisie-manuelle" }, "fr")).toEqual({});
  });
});
