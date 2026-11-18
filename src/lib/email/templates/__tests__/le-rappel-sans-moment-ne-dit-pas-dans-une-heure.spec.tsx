/**
 * 🔴 Un job `appel-rappel` posé avant que les émetteurs fournissent `moment` retombait sur
 * « h1 » : il annonçait « dans une heure » quel que soit l'instant réel. Sans moment, le
 * message est neutre ; avec un moment, rien ne change.
 */
import { render } from "@react-email/render";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AppelRappelEmail, appelRappelSubject } from "../appel-rappel";

const BASE = { prenom: "Camille", date: "vendredi 25 septembre", heure: "11:30" };

async function texte(locale: "fr" | "en", payload: Record<string, unknown>): Promise<string> {
  const html = await render(<AppelRappelEmail locale={locale} payload={payload} />);
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/© \d{4}/, "© ANNEE")
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

describe("rappel sans moment : seul ce qui est connu est dit", () => {
  const cas = [
    {
      nom: "heure seule",
      payload: { prenom: "Camille", heure: "11:30" },
      fr: "votre rendez-vous a lieu à 11:30 (heure de Paris)",
      en: "your meeting is at 11:30 (Paris time)",
    },
    {
      nom: "date seule",
      payload: { prenom: "Camille", date: "vendredi 25 septembre" },
      fr: "votre rendez-vous a lieu le vendredi 25 septembre.",
      en: "your meeting is on vendredi 25 septembre.",
    },
    {
      nom: "date et heure",
      payload: { prenom: "Camille", date: "vendredi 25 septembre", heure: "11:30" },
      fr: "votre rendez-vous a lieu le vendredi 25 septembre à 11:30 (heure de Paris)",
      en: "your meeting is on vendredi 25 septembre at 11:30 (Paris time)",
    },
    {
      nom: "ni date ni heure",
      payload: { prenom: "Camille" },
      fr: "Petit rappel de votre rendez-vous.",
      en: "A quick reminder of your meeting.",
    },
  ];
  for (const c of cas) {
    for (const locale of ["fr", "en"] as const) {
      it(`${locale} ${c.nom}`, async () => {
        const corps = await texte(locale, c.payload);
        expect(corps).toContain(c[locale]);
        expect(corps).not.toMatch(/undefined|le 11:30|on 11:30|dans une heure|in one hour/);
        if (c.nom === "date seule") {
          expect(corps).not.toMatch(/heure de Paris|Paris time|undefined/);
        }
      });
    }
  }
});

/**
 * Fiche L4b : « objet et corps identiques à avant pour chacun des trois moments ». Valeurs
 * calculées en rendant le gabarit de origin/main (avant ce correctif) : objet en clair,
 * corps complet (année du pied de page neutralisée) figé par son empreinte SHA-256.
 */
const AVANT: Record<string, { objet: string; sha: string }> = {
  "fr|confirmation|defaut": {
    objet: "Confirmé : vendredi 25 septembre à 11:30",
    sha: "a2d7c10beaaea88c5365994581611b170a608bb4277e367f8a3f08ddfbd79910",
  },
  "fr|confirmation|diagnostic": {
    objet: "Diagnostic IA : vendredi 25 septembre à 11:30",
    sha: "80d3de8b704f9d747a34b54ae2d0cfdcb6069a5071681b0d2507db5d2c8a4cfc",
  },
  "fr|confirmation|echange_projet": {
    objet: "Échange projet : vendredi 25 septembre à…",
    sha: "f2be8d10a3984110d337f49d1c071e1d29a776d2536742353d687f96ec5181bf",
  },
  "fr|j1|defaut": {
    objet: "Rappel : rendez-vous demain à 11:30",
    sha: "dd12ed0811b55f11c579b1c731c78723d826fd30371613ca070055b7a9e4ffd5",
  },
  "fr|j1|diagnostic": {
    objet: "Rappel : votre diagnostic IA demain à 11:30",
    sha: "666320f2acf5d539c6ec9821f2f080b3916cb1d0bb43c94872187c92af148e1b",
  },
  "fr|j1|echange_projet": {
    objet: "Rappel : votre échange projet demain à 11:30",
    sha: "4e3bc534cac5e79f5923db041da75bd75472c4b1a94db44c5cb8dc81b99166ff",
  },
  "fr|h1|defaut": {
    objet: "Rendez-vous dans une heure, à 11:30",
    sha: "bc9d9c4a4813e76e1d67223f9571e3e79f908da763aa35561222860d383ae547",
  },
  "fr|h1|diagnostic": {
    objet: "Votre diagnostic IA dans une heure, à 11:30",
    sha: "c4a1f8fa7e0dc862dc606c4919f64af8b68475a4f7efee43aaf6128635dc0811",
  },
  "fr|h1|echange_projet": {
    objet: "Votre échange projet dans une heure, à 11:30",
    sha: "e61f253cac1ce6d3cbb4770e21b837a5560f47adaf4efe57351072bf76cc92e5",
  },
  "en|confirmation|defaut": {
    objet: "Confirmed: vendredi 25 septembre at 11:30",
    sha: "a9cd7f8908cd4367e856fba29561cb8931d4999c79f3a351abe0664c3c57d1a1",
  },
  "en|confirmation|diagnostic": {
    objet: "Confirmed: vendredi 25 septembre at 11:30",
    sha: "a9cd7f8908cd4367e856fba29561cb8931d4999c79f3a351abe0664c3c57d1a1",
  },
  "en|confirmation|echange_projet": {
    objet: "Confirmed: vendredi 25 septembre at 11:30",
    sha: "a9cd7f8908cd4367e856fba29561cb8931d4999c79f3a351abe0664c3c57d1a1",
  },
  "en|j1|defaut": {
    objet: "Reminder: meeting tomorrow at 11:30",
    sha: "6631b47dc981b9d87f58cb536f5feefcccfd4f8f973836ee4c63ca253fcf2d6d",
  },
  "en|j1|diagnostic": {
    objet: "Reminder: meeting tomorrow at 11:30",
    sha: "6631b47dc981b9d87f58cb536f5feefcccfd4f8f973836ee4c63ca253fcf2d6d",
  },
  "en|j1|echange_projet": {
    objet: "Reminder: meeting tomorrow at 11:30",
    sha: "6631b47dc981b9d87f58cb536f5feefcccfd4f8f973836ee4c63ca253fcf2d6d",
  },
  "en|h1|defaut": {
    objet: "Meeting in one hour, at 11:30",
    sha: "87de3947c3645f1ff70d1e20b28945e061be6e900a2f56d5266ce16a9d691319",
  },
  "en|h1|diagnostic": {
    objet: "Meeting in one hour, at 11:30",
    sha: "87de3947c3645f1ff70d1e20b28945e061be6e900a2f56d5266ce16a9d691319",
  },
  "en|h1|echange_projet": {
    objet: "Meeting in one hour, at 11:30",
    sha: "87de3947c3645f1ff70d1e20b28945e061be6e900a2f56d5266ce16a9d691319",
  },
};

describe("rappel avec moment : identique à origin/main", () => {
  const DETAIL = {
    prenom: "Camille",
    date: "vendredi 25 septembre",
    heure: "11:30",
    dureeMinutes: 45,
    besoin: "automatiser mes devis",
  };
  for (const [cle, attendu] of Object.entries(AVANT)) {
    it(cle, async () => {
      const [locale, moment, type] = cle.split("|") as ["fr" | "en", string, string];
      const payload = { ...DETAIL, moment, ...(type === "defaut" ? {} : { typeRendezVous: type }) };
      expect(appelRappelSubject(locale, payload)).toBe(attendu.objet);
      const corps = await texte(locale, payload);
      expect(createHash("sha256").update(corps).digest("hex")).toBe(attendu.sha);
    });
  }
});
