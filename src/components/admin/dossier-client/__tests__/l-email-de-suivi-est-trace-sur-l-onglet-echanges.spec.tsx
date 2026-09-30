/**
 * L'e-mail de suivi est tracé sur l'onglet Échanges (PR 7).
 *
 * L'état affiché est LU dans `email_outbox` (à valider, validé, envoyé,
 * écarté) ; sans e-mail, il distingue « en préparation », « rédaction
 * échouée » et « retiré de la file » (`etat-email-suivi.ts`, garde
 * `un-email-sans-file-dit-pourquoi.spec.ts`). Une seule table de libellés
 * (`LIBELLE_ETAT_EMAIL_SUIVI`), partagée avec la vue « E-mail de suivi ».
 *
 * Mutation qui rougit : afficher un libellé retapé au lieu de la table
 * unique, ou afficher « en préparation » pour une rédaction échouée.
 * Contre-témoin : un e-mail envoyé se lit « envoyé ».
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/features/dossier-client/actions", () => ({
  ajouterPersonneFormAction: vi.fn(),
  basculerOppositionIaFormAction: vi.fn(),
  creerProjetFormAction: vi.fn(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import { OngletEchanges } from "@/components/admin/dossier-client/Onglets";
import { LIBELLE_ETAT_EMAIL_SUIVI as L } from "@/features/dossier-client/etat-email-suivi";
import type { RencontreDuDossier } from "@/features/dossier-client/queries";

const rencontre = (emails: RencontreDuDossier["emailsSuivi"]): RencontreDuDossier => ({
  id: "r-1",
  titre: "Diagnostic fictif",
  type: "visio",
  debutPrevu: new Date("2026-10-06T08:00:00Z"),
  statut: null,
  projetId: null,
  estTestInterne: false,
  issue: "eu_lieu",
  compteRenduValide: null,
  compteRenduEnCours: false,
  emailsSuivi: emails,
});

describe("l'e-mail de suivi est tracé sur l'onglet Échanges", () => {
  it("en préparation, rédaction échouée, retiré, à valider, envoyé", () => {
    const { container } = render(
      <OngletEchanges
        rencontres={[
          rencontre([
            { creeLe: new Date("2026-10-06T09:00:00Z"), etat: "en_preparation" },
            { creeLe: new Date("2026-10-06T09:05:00Z"), etat: "a_valider" },
            { creeLe: new Date("2026-10-06T09:10:00Z"), etat: "envoye" },
          ]),
          rencontre([
            { creeLe: new Date("2026-10-06T10:00:00Z"), etat: "redaction_echouee" },
            { creeLe: new Date("2026-10-06T10:05:00Z"), etat: "retire_de_la_file" },
          ]),
        ]}
        projets={[]}
        rendezVousBase="/fr/adm/rendez-vous"
        maintenant={new Date("2026-10-07T09:00:00Z")}
      />,
    );
    const t = container.textContent ?? "";
    for (const e of [
      "en_preparation",
      "a_valider",
      "envoye",
      "redaction_echouee",
      "retire_de_la_file",
    ] as const) {
      expect(t).toContain(L[e]);
    }
  });
});
