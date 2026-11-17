/**
 * 🔴 Un job `appel-rappel` posé avant que les émetteurs fournissent `moment` retombait sur
 * « h1 » : il annonçait « dans une heure » quel que soit l'instant réel. Sans moment, le
 * message est neutre ; avec un moment, rien ne change.
 */
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { AppelRappelEmail, appelRappelSubject } from "../appel-rappel";

const BASE = { prenom: "Camille", date: "vendredi 25 septembre", heure: "11:30" };

async function texte(locale: "fr" | "en", payload: Record<string, unknown>): Promise<string> {
  const html = await render(<AppelRappelEmail locale={locale} payload={payload} />);
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");
}

describe("rappel sans moment", () => {
  for (const [locale, interdit] of [
    ["fr", /dans une heure|dans 1 h|demain/i],
    ["en", /in one hour|in an hour|tomorrow/i],
  ] as const) {
    for (const extra of [
      {},
      { typeRendezVous: "diagnostic" },
      { typeRendezVous: "echange_projet" },
    ]) {
      it(`${locale} ${JSON.stringify(extra)} : ni « dans une heure » ni « demain »`, async () => {
        const payload = { ...BASE, ...extra };
        const objet = appelRappelSubject(locale, payload);
        const corps = await texte(locale, payload);
        expect(objet).not.toMatch(interdit);
        expect(corps).not.toMatch(interdit);
        expect(objet).toMatch(/Rappel de votre rendez-vous|Reminder of your meeting/);
        expect(objet.length).toBeLessThanOrEqual(80);
      });
    }
  }

  it("sans date ni heure : variante neutre sans « undefined »", async () => {
    const objet = appelRappelSubject("fr", {});
    const corps = await texte("fr", {});
    expect(objet).toBe("Rappel de votre rendez-vous");
    expect(corps).toContain("Rappel de votre rendez-vous");
    expect(corps).not.toMatch(/undefined|dans une heure/);
  });

  it("une valeur de moment inconnue est traitée comme absente", () => {
    expect(appelRappelSubject("fr", { ...BASE, moment: "bientot" })).not.toMatch(/une heure/);
  });
});

describe("rappel avec moment : inchangé", () => {
  it("objets", () => {
    expect(appelRappelSubject("fr", { ...BASE, moment: "h1" })).toBe(
      "Rendez-vous dans une heure, à 11:30",
    );
    expect(appelRappelSubject("fr", { ...BASE, moment: "j1" })).toBe(
      "Rappel : rendez-vous demain à 11:30",
    );
    expect(appelRappelSubject("fr", { ...BASE, moment: "confirmation" })).toBe(
      "Confirmé : vendredi 25 septembre à 11:30",
    );
    expect(appelRappelSubject("en", { ...BASE, moment: "h1" })).toBe(
      "Meeting in one hour, at 11:30",
    );
  });

  it("corps", async () => {
    expect(await texte("fr", { ...BASE, moment: "h1" })).toContain(
      "Votre rendez-vous a lieu dans une heure",
    );
    expect(await texte("fr", { ...BASE, moment: "h1" })).toContain(
      "nous nous retrouvons à 11:30 (heure de Paris)",
    );
    expect(await texte("fr", { ...BASE, moment: "j1" })).toContain(
      "nous nous retrouvons demain à 11:30",
    );
    expect(await texte("fr", { ...BASE, moment: "confirmation" })).toContain("C'est confirmé");
  });
});
