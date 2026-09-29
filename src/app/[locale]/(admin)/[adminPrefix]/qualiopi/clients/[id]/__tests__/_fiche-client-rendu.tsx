/**
 * Rendu de la VRAIE page fiche client (`qualiopi/clients/[id]/page.tsx`) pour
 * un rôle donné, avec la VRAIE `gardePage` (seule la session est doublée) et
 * les lectures du dossier espionnées. Partagé par les deux gardes d'accès A2.
 *
 * ⚠️ Les `vi.mock` vivent dans chaque fichier de test (Vitest les remonte en
 * tête du fichier qui les déclare) ; ce module ne fournit que la fixture et le
 * rendu.
 */

import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

export const ID_CLIENT = "3f2a9c1e-8b7d-4e6f-a5c4-1b2d3e4f5a6b";

/** Une fiche 360° fictive, avec une facture et un devis. */
export const FICHE_360 = {
  id: ID_CLIENT,
  numero: "AXI-CLI-990",
  type: "entreprise",
  raisonSociale: "Atelier Fictif SARL",
  statut: "client_actif",
  siret: null,
  siren: "552100554",
  adresse: null,
  adresseRue: null,
  adresseCodePostal: null,
  adresseVille: null,
  contactNom: "Contact Fictif",
  contactEmail: "contact@atelier-fictif.example",
  contactTelephone: null,
  contactFonction: null,
  opcoIdentifie: null,
  opcoNumeroAdherent: null,
  penalitesRetardActives: false,
  caCents: 120_000,
  nbSessions: 1,
  nbStagiaires: 4,
  sessions: [],
  coachingContracts: [],
  auditMissions: [],
  devis: [
    {
      id: "d1",
      numero: "AXI-DEV-2026-001",
      statut: "accepte",
      montantTotalHtCents: 100_000,
      createdAt: new Date("2026-09-01T09:00:00Z"),
    },
  ],
  facturesFormation: [
    {
      id: "fa1",
      numero: "AXI-FACT-2026-001",
      statut: "emise",
      avoirDeId: null,
      montantHtCents: 100_000,
      montantTtcCents: 120_000,
      emiseAt: new Date("2026-09-15T09:00:00Z"),
      echeanceAt: null,
      createdAt: new Date("2026-09-15T09:00:00Z"),
      payments: [],
      avoirs: [],
    },
  ],
  documents: [],
  dossiersFinancement: [],
  _count: { emailsEnAttente: 0 },
};

export async function rendreFiche(
  Page: (p: {
    params: Promise<{ locale: "fr"; adminPrefix: string; id: string }>;
    searchParams?: Promise<{ onglet?: string }>;
  }) => Promise<ReactElement>,
  onglet?: string,
): Promise<string> {
  const element = await Page({
    params: Promise.resolve({ locale: "fr", adminPrefix: "console", id: ID_CLIENT }),
    searchParams: Promise.resolve(onglet !== undefined ? { onglet } : {}),
  });
  return renderToStaticMarkup(element);
}
