/**
 * L8b — LA LISTE « CANDIDATURES » À ONGLETS (maquette v2).
 */
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/features/admin-job-applications/actions-en-masse", () => ({
  changerStatutEnMasseAction: vi.fn(),
}));
vi.mock("@/features/admin-job-applications/actions-reponse-en-masse", () => ({
  repondreEnMasseAction: vi.fn(),
}));

import { ApplicationsV2 } from "../ApplicationsV2";
import type { JobApplicationListItem } from "@/features/admin-job-applications/reads";

const ITEM: JobApplicationListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  offerId: "o1",
  offerTitleSnap: "Formateur IA",
  contactName: "Sarah L.",
  contactEmail: "sarah@exemple.invalid",
  status: "interview",
  hasCv: true,
  needsAttention: false,
  submittedAt: new Date("2026-10-02T10:00:00Z"),
  ville: "Bordeaux",
  origine: "indeed",
};

function rendre(extra: Partial<Parameters<typeof ApplicationsV2>[0]> = {}): string {
  return renderToStaticMarkup(
    <ApplicationsV2
      adminPrefix="p"
      searchParams={{ vue: "formateurs" }}
      offres={[{ id: "o1", label: "Formateur IA", count: 1 }]}
      items={[ITEM]}
      total={1}
      page={1}
      totalPages={1}
      onglets={{
        courant: "formateurs",
        compte: { monteurs: 41, formateurs: 12, autres: 88, spontanees: 0, formulaire: 4 },
        hrefFormulaire: "/fr/p/contacts/autres",
      }}
      puces={[
        { statut: "new", compte: 3 },
        { statut: "interview", compte: 1 },
      ]}
      {...extra}
    />,
  );
}

describe("liste à onglets", () => {
  it("les cinq onglets de la maquette, avec leurs volumes, l'onglet courant marqué", () => {
    const html = rendre();
    for (const o of [
      "Monteurs &amp; vidéastes",
      "Formateurs",
      "Autres offres",
      "Spontanées",
      "Par le formulaire de contact",
    ]) {
      expect(html).toContain(o);
    }
    expect(html).toMatch(/aria-current="page"[^>]*>Formateurs/);
    expect(html).toContain('href="/fr/p/contacts/autres"');
  });

  it("colonnes de la maquette : Ville, Origine, Étape en pastille ; ligne cliquable", () => {
    const html = rendre();
    expect(html).toContain("Bordeaux");
    expect(html).toContain("indeed");
    expect(html).toContain("Échange prévu");
    expect(html).toContain(`/fr/p/contacts/candidatures/${ITEM.id}`);
    expect(html).toContain("Exporter");
  });

  it("puces d'étapes : un clic filtre l'étape en gardant l'onglet", () => {
    const html = rendre();
    expect(html).toContain("/fr/p/contacts/candidatures?vue=formateurs&amp;status=new");
  });

  it("onglet Monteurs : le panneau des prix remplace le tableau", () => {
    const html = rendre({
      searchParams: { vue: "monteurs" },
      onglets: { courant: "monteurs", compte: {}, hrefFormulaire: "/x" },
      panneauMonteurs: <p>panneau-prix</p>,
    });
    expect(html).toContain("panneau-prix");
    expect(html).not.toContain("Sarah L.");
  });

  it("onglet vide : une phrase et un geste", () => {
    const html = rendre({
      searchParams: { vue: "spontanees" },
      items: [],
      total: 0,
      onglets: { courant: "spontanees", compte: {}, hrefFormulaire: "/x" },
    });
    expect(html).toContain("Aucune candidature spontanée pour l");
    expect(html).toContain("Voir la page de candidature spontanée");
  });
});
