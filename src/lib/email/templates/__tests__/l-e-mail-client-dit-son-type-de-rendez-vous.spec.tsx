/**
 * L'e-mail client dit SON type de rendez-vous (2026-10-04).
 *
 * Chantier « Types de rendez-vous », lot L3. Un diagnostic IA et un échange
 * projet partent du même gabarit (`appel-rappel.tsx`), mais leur surtitre, leur
 * objet et leur texte diffèrent :
 *   · diagnostic : « votre diagnostic IA gratuit », on arrive avec des pistes ;
 *   · échange projet : le service choisi est rappelé ;
 *   · sans type (charge d'avant, déjà en file) : le message d'hier, intact.
 * La durée vient de la charge (bornes du rendez-vous), le lien de visio ne
 * change pas, on vouvoie, et rien n'est promis au-delà de l'échange.
 */

import { describe, expect, it } from "vitest";

import { renderEmailTemplate } from "../index";

const LIEN_VISIO = "https://meet.google.com/abc-defg-hij";

const BASE = {
  prenom: "Camille",
  heure: "11:30",
  date: "vendredi 9 octobre",
  dureeMinutes: 30,
  lieu: LIEN_VISIO,
  format: "visio",
  cancelUrl: "https://calendly.com/cancellations/zz",
  rescheduleUrl: "https://calendly.com/reschedulings/zz",
};

type Job = "appel-confirme" | "appel-rappel-j1" | "appel-rappel";

async function rendre(job: Job, extra: Record<string, unknown>) {
  const moment =
    job === "appel-confirme" ? "confirmation" : job === "appel-rappel-j1" ? "j1" : "h1";
  const r = await renderEmailTemplate(job, "fr", { ...BASE, moment, ...extra });
  return { subject: r.subject, html: r.html, text: r.text ?? "" };
}

describe("diagnostic IA", () => {
  it("confirmation : objet, surtitre « Diagnostic IA gratuit », réponses utiles", async () => {
    const r = await rendre("appel-confirme", { typeRendezVous: "diagnostic" });
    expect(r.subject).toBe("Diagnostic IA : vendredi 9 octobre à 11:30");
    expect(r.text).toContain("Diagnostic IA gratuit");
    expect(r.text).toContain("votre diagnostic IA gratuit");
    expect(r.text).toContain("Vos réponses nous aident à préparer l'échange");
    expect(r.text).not.toContain("Rendez-vous de découverte");
    // Vu en réel le 04/10 : la phrase figurait deux fois (intro + puce).
    expect(r.text.split("nous aident à préparer l'échange").length - 1).toBe(1);
  });

  it("rappels J-1 et H-1 : objets et titres propres au diagnostic", async () => {
    const j1 = await rendre("appel-rappel-j1", { typeRendezVous: "diagnostic" });
    expect(j1.subject).toBe("Rappel : votre diagnostic IA demain à 11:30");
    expect(j1.html).toContain("Votre diagnostic IA a lieu demain");
    const h1 = await rendre("appel-rappel", { typeRendezVous: "diagnostic" });
    expect(h1.subject).toBe("Votre diagnostic IA dans une heure, à 11:30");
    expect(h1.html).toContain("Votre diagnostic IA a lieu dans une heure");
    expect(h1.text).toContain("Vos réponses nous aident à préparer l'échange");
  });

  it("la durée vient du rendez-vous, le lien de visio est intact", async () => {
    const r = await rendre("appel-confirme", { typeRendezVous: "diagnostic" });
    expect(r.text).toContain("30 minutes");
    expect(r.html).toContain(`href="${LIEN_VISIO}"`);
  });
});

describe("échange projet", () => {
  it("confirmation : surtitre « Échange projet » et service choisi rappelé", async () => {
    const r = await rendre("appel-confirme", {
      typeRendezVous: "echange_projet",
      besoin: "Formation",
      dureeMinutes: 45,
    });
    expect(r.subject).toBe("Échange projet : vendredi 9 octobre à 11:30");
    expect(r.text).toContain("Échange projet");
    expect(r.text).toContain("Service choisi");
    expect(r.text).toContain("Formation");
    expect(r.text).toContain("45 minutes");
  });

  it("rappel H-1 : le service choisi est rappelé", async () => {
    const r = await rendre("appel-rappel", { typeRendezVous: "echange_projet", besoin: "Audit" });
    expect(r.subject).toBe("Votre échange projet dans une heure, à 11:30");
    expect(r.text).toContain("service choisi : Audit");
  });

  it("sans besoin connu : aucune ligne « Service choisi » vide", async () => {
    const r = await rendre("appel-confirme", { typeRendezVous: "echange_projet" });
    expect(r.text).not.toContain("Service choisi");
    expect(r.text).not.toContain("undefined");
  });
});

describe("sans type (charge d'avant) ou type « autre » : le message d'hier", () => {
  it.each([{}, { typeRendezVous: "autre" }, { typeRendezVous: "inconnu" }])(
    "%o garde l'objet et le surtitre génériques",
    async (extra) => {
      const r = await rendre("appel-confirme", extra);
      expect(r.subject).toBe("Confirmé : vendredi 9 octobre à 11:30");
      expect(r.text).toContain("Rendez-vous de découverte");
    },
  );
});

describe("ton et engagements", () => {
  it.each(["diagnostic", "echange_projet"])(
    "%s : vouvoiement, rien de non tenable",
    async (typeRendezVous) => {
      for (const job of ["appel-confirme", "appel-rappel-j1", "appel-rappel"] as const) {
        const r = await rendre(job, { typeRendezVous, besoin: "Coaching" });
        expect(r.text, job).not.toMatch(/\b(tu|ton|ta|tes|toi)\b/i);
        expect(r.text, job).not.toMatch(/chaque semaine|compte rendu|garanti/i);
      }
    },
  );
});

describe("relecture L3 : objets bornés, rien de non tenable (L5b)", () => {
  it.each(["diagnostic", "echange_projet"])(
    "%s : objets J-1 et H-1 ≤ 45 caractères, même sans heure",
    async (typeRendezVous) => {
      for (const job of ["appel-rappel-j1", "appel-rappel"] as const) {
        for (const heure of ["11:30", undefined]) {
          const r = await rendre(job, { typeRendezVous, heure });
          expect(r.subject.length, `${job} ${heure}: ${r.subject}`).toBeLessThanOrEqual(45);
          expect(r.subject).not.toContain("undefined");
        }
      }
    },
  );

  it("🔴 le diagnostic ne promet plus d'arriver avec des pistes préparées", async () => {
    for (const job of ["appel-confirme", "appel-rappel-j1", "appel-rappel"] as const) {
      const r = await rendre(job, { typeRendezVous: "diagnostic" });
      expect(r.text, job).not.toMatch(/nous arrivons avec|arriver avec des pistes/i);
    }
  });
});
