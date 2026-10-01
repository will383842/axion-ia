/**
 * 🔴 Lot L4 (2026-09-30), correction de revue — la 308 de la fiche 360° vers la
 * fiche session faisait perdre deux informations que seule la 360° montrait :
 * le CONFLIT de formateur (même formateur sur deux prestations qui se
 * chevauchent) et le téléphone et l'e-mail du CONTACT client. La fiche session
 * les reprend ; ce test le prouve sur la vraie lecture (seule la requête du
 * planning est doublée), le vrai composant et la vraie page.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { getTrainerConflicts } = vi.hoisted(() => ({ getTrainerConflicts: vi.fn() }));
vi.mock("@/features/admin-planning/queries", () => ({ getTrainerConflicts }));

import { conflitsFormateurSession } from "@/server/qualiopi/sessions/conflit-formateur";
import { ContactEtConflitSession } from "@/components/admin/qualiopi/ContactEtConflitSession";
import type { PlanningEvent } from "@/features/admin-planning/types";

const SESSION = {
  id: "s1",
  dateDebut: new Date("2026-10-05T07:00:00Z"),
  dateFin: new Date("2026-10-05T15:00:00Z"),
  statut: "planifiee" as const,
  formateurPrincipalId: "t1",
};

const AUTRE = {
  key: "formation:s2",
  type: "formation",
  id: "s2",
  titre: "IA pour les RH",
  debut: new Date("2026-10-05T08:00:00Z"),
  fin: new Date("2026-10-05T12:00:00Z"),
  statut: "planifiee",
} as unknown as PlanningEvent;

describe("conflitsFormateurSession — la lecture", () => {
  it("interroge le planning avec la clé de la session, ses dates et son statut", async () => {
    getTrainerConflicts.mockResolvedValue([AUTRE]);
    const r = await conflitsFormateurSession(SESSION);
    expect(r).toEqual({ conflits: [AUTRE], erreur: false });
    expect(getTrainerConflicts).toHaveBeenCalledWith("t1", {
      key: "formation:s1",
      debut: SESSION.dateDebut,
      fin: SESSION.dateFin,
      statut: "planifiee",
    });
  });

  it("sans formateur : aucun conflit, aucune requête", async () => {
    const avant = getTrainerConflicts.mock.calls.length;
    const r = await conflitsFormateurSession({ ...SESSION, formateurPrincipalId: null });
    expect(r).toEqual({ conflits: [], erreur: false });
    expect(getTrainerConflicts.mock.calls.length).toBe(avant);
  });

  it("une lecture en échec le DIT (jamais « aucun conflit » en silence)", async () => {
    getTrainerConflicts.mockRejectedValueOnce(new Error("db"));
    expect(await conflitsFormateurSession(SESSION)).toEqual({ conflits: [], erreur: true });
  });
});

describe("ContactEtConflitSession — l'écran", () => {
  const contact = {
    nom: "Claire Martin",
    fonction: "DRH",
    telephone: "+33 4 72 00 00 00",
    email: "claire.martin@exemple.fr",
  };

  it("rend le téléphone et l'e-mail du contact en liens cliquables", () => {
    const html = renderToStaticMarkup(
      <ContactEtConflitSession
        adminPrefix="p"
        contact={contact}
        formateurNom="Jean Dupont"
        conflits={{ conflits: [], erreur: false }}
      />,
    );
    expect(html).toContain("Claire Martin");
    expect(html).toContain('href="tel:+33 4 72 00 00 00"');
    expect(html).toContain('href="mailto:claire.martin@exemple.fr"');
    expect(html).not.toContain("Conflit de planning");
  });

  it("signale le conflit du formateur, avec un lien vers l'autre prestation", () => {
    const html = renderToStaticMarkup(
      <ContactEtConflitSession
        adminPrefix="p"
        contact={null}
        formateurNom="Jean Dupont"
        conflits={{ conflits: [AUTRE], erreur: false }}
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Conflit de planning");
    expect(html).toContain("Jean Dupont");
    expect(html).toContain("IA pour les RH");
    expect(html).toContain('href="/fr/p/qualiopi/sessions/s2"');
  });

  it("dit que la vérification n'a pas pu se faire quand la lecture a échoué", () => {
    const html = renderToStaticMarkup(
      <ContactEtConflitSession
        adminPrefix="p"
        contact={null}
        formateurNom="Jean Dupont"
        conflits={{ conflits: [], erreur: true }}
      />,
    );
    expect(html).toContain("n&#x27;a pas pu être vérifié");
  });
});

describe("la fiche session les affiche", () => {
  const page = readFileSync(
    resolve(
      process.cwd(),
      "src/app/[locale]/(admin)/[adminPrefix]/qualiopi/sessions/[id]/page.tsx",
    ),
    "utf8",
  );

  it("charge le téléphone et l'e-mail du contact client", () => {
    expect(page).toMatch(/contactTelephone:\s*true/);
    expect(page).toMatch(/contactEmail:\s*true/);
  });

  it("lit les conflits du formateur et rend le bloc", () => {
    expect(page).toContain("conflitsFormateurSession(");
    expect(page).toContain("<ContactEtConflitSession");
  });
});
