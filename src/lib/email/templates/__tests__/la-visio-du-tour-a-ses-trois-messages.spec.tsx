/**
 * La visio du Tour France IA a ses trois messages propres (2026-10-25) :
 * confirmation, rappel la veille, rappel une heure avant. Modèle : l'appel de
 * découverte, ton chaleureux, vouvoiement. Ils passent par le gabarit existant
 * `appel-rappel` — donc par ses règles existantes (objet ≤ 45 caractères, liens
 * d'annulation et de report, pas de pièce jointe).
 */
import { describe, expect, it } from "vitest";

import { OBJET_MAX } from "../../objet-email";
import { renderEmailTemplate } from "../index";

const BASE = {
  prenom: "Camille",
  heure: "11:30",
  date: "vendredi 25 septembre",
  dureeMinutes: 30,
  lieu: "https://meet.google.com/abc-defg-hij",
  cancelUrl: "https://calendly.com/cancellations/zz",
  rescheduleUrl: "https://calendly.com/reschedulings/zz",
  typeRendezVous: "tour_de_france_ia",
};
const MOMENTS = ["confirmation", "j1", "h1"] as const;

const MOTS_INTERDITS = [/devis/i, /\bprix\b/i, /signature/i, /\bvente\b/i];

async function rendre(moment: (typeof MOMENTS)[number], extra: Record<string, unknown> = {}) {
  return renderEmailTemplate("appel-rappel", "fr", { ...BASE, moment, ...extra });
}

describe("objets", () => {
  it.each(MOMENTS)("%s : objet court, propre au Tour", async (moment) => {
    const { subject } = await rendre(moment);
    expect(subject.length).toBeLessThanOrEqual(OBJET_MAX);
    expect(subject).toMatch(/Tour France IA/);
  });

  it("sans date ni heure, l'objet de confirmation reste vrai", async () => {
    const { subject } = await renderEmailTemplate("appel-rappel", "fr", {
      prenom: "Camille",
      dureeMinutes: 30,
      moment: "confirmation",
      typeRendezVous: "tour_de_france_ia",
    });
    expect(subject).toBe("Votre visio Tour France IA est confirmée");
    expect(subject).not.toMatch(/undefined/);
  });

  it("l'objet du rappel garde l'heure", async () => {
    expect((await rendre("j1")).subject).toContain("11:30");
    expect((await rendre("h1")).subject).toContain("11:30");
  });
});

describe("corps", () => {
  it.each(MOMENTS)("%s : parle du Tour, vouvoie, garde annuler et reporter", async (moment) => {
    const rendu = await rendre(moment);
    const t = `${rendu.html} ${rendu.text ?? ""}`;
    expect(t).toMatch(/Tour France IA/);
    expect(t).toContain(BASE.cancelUrl);
    expect(t).toContain(BASE.rescheduleUrl);
    expect(t).not.toMatch(/\b(tu|ton|ta|tes)\b/i);
    for (const m of MOTS_INTERDITS) expect(t, String(m)).not.toMatch(m);
  });

  it("confirmation : dit ce que sera la visio, sans promettre de prestation", async () => {
    const t = (await rendre("confirmation")).html;
    expect(t).toMatch(/faisons connaissance/);
    expect(t).toMatch(/confirmez votre participation/);
  });

  it("rappels : titres propres au Tour", async () => {
    expect((await rendre("j1")).html).toMatch(/Votre visio Tour France IA a lieu demain/);
    expect((await rendre("h1")).html).toMatch(/Votre visio Tour France IA a lieu dans une heure/);
  });

  it("la ville du formulaire est reprise quand on la connaît", async () => {
    const t = (await rendre("confirmation", { besoin: "Lyon" })).html;
    expect(t).toMatch(/Votre ville/);
    expect(t).toMatch(/Lyon/);
  });

  it("sans ville, rien n'est inventé", async () => {
    const t = (await rendre("confirmation")).html;
    expect(t).not.toMatch(/Votre ville/);
    expect(t).not.toMatch(/undefined/);
  });

  it("jamais de pièce jointe .ics", async () => {
    const rendu = (await rendre("confirmation")) as unknown as { attachments?: unknown[] };
    expect(rendu.attachments ?? []).toHaveLength(0);
  });

  it("un autre type garde son message d'hier", async () => {
    const rendu = await renderEmailTemplate("appel-rappel", "fr", {
      ...BASE,
      typeRendezVous: "autre",
      moment: "confirmation",
    });
    expect(rendu.subject).not.toMatch(/Tour France IA/);
  });
});
