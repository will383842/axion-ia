/**
 * La visio du Tour de France IA a ses propres e-mails (2026-10-25).
 *
 * Confirmation, rappel la veille, rappel une heure avant : surtitre, objets
 * (45 caractères au plus, `objetCompose`) et textes propres au Tour, au
 * vouvoiement, sans prix ni promesse. Sans type, le message d'hier reste intact.
 */

import { describe, expect, it } from "vitest";

import { OBJET_MAX } from "../../objet-email";
import { renderEmailTemplate } from "../index";

const BASE = {
  prenom: "Camille",
  heure: "11:30",
  date: "vendredi 9 octobre",
  dureeMinutes: 30,
  lieu: "https://meet.google.com/abc-defg-hij",
  format: "visio",
  cancelUrl: "https://calendly.com/cancellations/zz",
  rescheduleUrl: "https://calendly.com/reschedulings/zz",
};

type Job = "appel-confirme" | "appel-rappel-j1" | "appel-rappel";

async function rendre(job: Job, extra: Record<string, unknown> = {}) {
  const moment =
    job === "appel-confirme" ? "confirmation" : job === "appel-rappel-j1" ? "j1" : "h1";
  const r = await renderEmailTemplate(job, "fr", {
    ...BASE,
    moment,
    typeRendezVous: "tour_de_france_ia",
    ...extra,
  });
  return { subject: r.subject, html: r.html, text: r.text ?? "" };
}

// « Grenoble » n'est pas testé : il figure dans le pied légal commun (RCS, `legal-footer.ts`),
// pas dans le texte propre au Tour.
const INTERDITS =
  /qualiopi|obligatoire|devis|\bprix\b|signature|candidater|réserver|\btarif|\b(tu|ton|ta|tes|toi)\b/i;

describe("Tour de France IA — confirmation", () => {
  it("objet court avec l'horaire, surtitre et texte propres au Tour", async () => {
    const r = await rendre("appel-confirme");
    expect(r.subject.startsWith("Tour de France IA")).toBe(true);
    expect(r.subject.length).toBeLessThanOrEqual(OBJET_MAX);
    expect(r.text).toContain("Tour de France IA");
    expect(r.text).toContain("30 minutes");
    expect(r.text).toContain("participer");
    expect(r.text).not.toContain("Rendez-vous de découverte");
  });

  it("sans horaire : objet de repli, jamais « undefined »", async () => {
    const r = await rendre("appel-confirme", { date: undefined, heure: undefined });
    expect(r.subject).toBe("Votre visio Tour de France IA est confirmée");
    expect(r.subject.length).toBeLessThanOrEqual(OBJET_MAX);
  });
});

describe("Tour de France IA — rappels", () => {
  it("J-1 : objet et titre propres", async () => {
    const r = await rendre("appel-rappel-j1");
    expect(r.subject).toBe("Rappel : Tour de France IA demain, 11:30");
    expect(r.html).toContain("Votre visio Tour de France IA a lieu demain");
  });

  it("H-1 : objet et titre propres", async () => {
    const r = await rendre("appel-rappel");
    expect(r.subject).toBe("Tour de France IA : dans une heure, à 11:30");
    expect(r.html).toContain("Votre visio Tour de France IA a lieu dans une heure");
  });

  it("sans heure : objets courts et sans « undefined »", async () => {
    for (const job of ["appel-rappel-j1", "appel-rappel"] as const) {
      const r = await rendre(job, { heure: undefined });
      expect(r.subject).not.toMatch(/undefined|null/);
      expect(r.subject.length).toBeLessThanOrEqual(OBJET_MAX);
    }
  });
});

describe("Tour de France IA — ton et garde-fous", () => {
  it.each(["appel-confirme", "appel-rappel-j1", "appel-rappel"] as const)(
    "%s : vouvoiement, aucun mot interdit, lien de visio intact",
    async (job) => {
      const r = await rendre(job);
      const tout = `${r.subject}\n${r.text}`;
      expect(tout).not.toMatch(INTERDITS);
      expect(r.html).toContain(`href="${BASE.lieu}"`);
    },
  );

  it("l'anglais et l'absence de type gardent le message générique", async () => {
    const sans = await rendre("appel-confirme", { typeRendezVous: undefined });
    expect(sans.text).not.toContain("Tour de France IA");
    const en = await renderEmailTemplate("appel-confirme", "en", {
      ...BASE,
      moment: "confirmation",
      typeRendezVous: "tour_de_france_ia",
    });
    expect(en.subject).toBe(
      "Confirmed: Friday 9 October at 11:30".replace("Friday 9 October", BASE.date),
    );
  });
});
