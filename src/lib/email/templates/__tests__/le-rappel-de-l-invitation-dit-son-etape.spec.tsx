// Les rappels J+3 / J+7 de l'invitation à l'échange (décision Will, 2026-09-27).
//
// Rendu RÉEL par le registre : objet de chaque étape, bouton de réservation,
// kit, mention de désinscription, famille B sans rangée sociale, budget de
// liens — et le vocabulaire anti-requalification (jamais « entretien »).

import { beforeAll, describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";
import { COPY_RELANCE_INVITATION } from "../apporteur-invitation-relance";
import { REGIME_FAMILLE } from "../_layout";
import { OBJET_MAX } from "../../objet-email";
import { DOCUMENT_APPORTEUR_CHEMIN } from "@/lib/commercial-application/kit-apporteur";

const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur";
const DESTINATAIRE = "camille@exemple.fr";

function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

async function rendu(locale: "fr" | "en", etape: "j3" | "j7") {
  return renderEmailTemplate(
    "apporteur-invitation-relance",
    locale,
    { contactName: "Camille Martin", calendlyUrl: CALENDLY, etape },
    { destinataire: DESTINATAIRE },
  );
}

beforeAll(() => {
  process.env["AUTH_SECRET"] = "secret-de-test-suffisamment-long-0123456789";
});

describe("rappel J+3", () => {
  it("objet, titre et corps du premier rappel (fr)", async () => {
    const r = await rendu("fr", "j3");
    expect(r.subject).toBe("Ton échange apporteur d'affaires t'attend");
    const t = texte(r.html);
    expect(t).toContain("Ton créneau t'attend");
    expect(t).toContain(
      "Bonjour Camille, ta candidature au réseau d'apporteurs d'affaires d'Axion-IA est retenue, et il ne te reste plus qu'à choisir le moment de notre échange de 15 minutes en visio.",
    );
    expect(t).toContain("Les créneaux sont limités : réserve le tien en un clic");
    expect(t).not.toContain("Dernier rappel");
  });

  it("anglais", async () => {
    const r = await rendu("en", "j3");
    expect(r.subject).toBe("Your business introducer call awaits");
    expect(texte(r.html)).toContain("Hello Camille, your application");
  });
});

describe("rappel J+7", () => {
  it("objet, titre et corps du dernier rappel (fr) — il dit qu'il n'y en aura plus", async () => {
    const r = await rendu("fr", "j7");
    expect(r.subject).toBe("Dernier rappel : ta candidature apporteur");
    const t = texte(r.html);
    expect(t).toContain("Dernier rappel");
    expect(t).toContain("Bonjour Camille, c'est notre dernier message à ce sujet");
    expect(t).toContain("sans réservation de ta part, on ne te relancera plus.");
  });

  it("anglais", async () => {
    const r = await rendu("en", "j7");
    expect(r.subject).toBe("Last reminder: your introducer application");
    expect(texte(r.html)).toContain("we will not remind you again");
  });
});

describe("les deux étapes, les deux langues", () => {
  const CAS = [
    ["fr", "j3"],
    ["fr", "j7"],
    ["en", "j3"],
    ["en", "j7"],
  ] as const;

  it.each(CAS)("%s %s : bouton de réservation, kit, désinscription, famille B", async (l, e) => {
    const r = await rendu(l, e);
    expect(r.html).toContain(CALENDLY);
    expect(r.html).toMatch(l === "fr" ? /Réserver mon créneau/ : /Book my slot/);
    expect(r.html).toContain(DOCUMENT_APPORTEUR_CHEMIN);
    expect(texte(r.html)).toMatch(l === "fr" ? /un clic suffit/ : /one click is enough/);
    // Le lien d'opposition du pied de page, porté par le châssis de famille B.
    expect(r.html).toMatch(/\/api\/unsubscribe\?token=op1\./);
    expect(r.famille).toBe("B");
    expect(r.html).not.toContain("facebook.com");
    const liens = new Set((r.html.match(/href="([^"]+)"/g) ?? []).map((x) => x.slice(6, -1)));
    expect(liens.size).toBeLessThanOrEqual(REGIME_FAMILLE.B.budgetLiens);
  });

  it.each(CAS)("%s %s : objet ≤ %s caractères, sans « ! » ni suffixe de marque", async (l, e) => {
    const { subject } = await rendu(l, e);
    expect(subject.length).toBeLessThanOrEqual(OBJET_MAX);
    expect(subject).not.toContain("!");
    expect(subject).not.toMatch(/[—·-]\s*Axion-IA\s*$/);
  });

  it.each(CAS)("%s %s : jamais « entretien » dans le message rendu", async (l, e) => {
    const r = await rendu(l, e);
    expect(r.html).not.toMatch(/entretien|interview/i);
    expect(r.subject).not.toMatch(/entretien|interview/i);
  });

  it("🔴 vocabulaire anti-requalification sur TOUT le texte propre au gabarit", () => {
    // Le pied de page commun dit « sollicitations commerciales » (lien
    // d'opposition) : on vérifie donc les textes du gabarit, pas le châssis.
    const tous = (["fr", "en"] as const).flatMap((l) => {
      const c = COPY_RELANCE_INVITATION[l];
      return [true, false].flatMap((d) => [
        c.subject(d),
        c.title(d),
        c.preview(d),
        c.j3("Camille"),
        c.j7("Camille"),
        c.kit,
        c.desinscription,
        c.cta,
      ]);
    });
    for (const s of tous) {
      expect(s, s).not.toMatch(
        /entretien|poste|recrutement|commercial|vendre|interview|job|hiring/i,
      );
    }
  });

  it("sans prénom, la salutation reste correcte", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-relance", "fr", {
      calendlyUrl: CALENDLY,
      etape: "j3",
    });
    expect(texte(r.html)).toContain("Bonjour, ta candidature");
  });

  it("une étape inattendue rend le premier rappel, pas le dernier", async () => {
    const r = await renderEmailTemplate("apporteur-invitation-relance", "fr", {
      calendlyUrl: CALENDLY,
      etape: "j2",
    });
    expect(r.subject).toBe("Ton échange apporteur d'affaires t'attend");
  });
});
