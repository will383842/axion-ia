/**
 * Page « Tunnel apporteurs » : refuse un non-admin, dit « non mesuré » (jamais 0)
 * quand rien n'est mesuré, ne calcule jamais de moyenne sur peu de cas, et ne
 * montre le formulaire de dépense qu'à qui peut écrire.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

class Redirection extends Error {}
let acces: unknown = { autorise: true, role: "admin", peutEcrire: true };

vi.mock("@/server/auth/garde-page", () => ({
  gardePage: async () => acces,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...r }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...r}>
      {children}
    </a>
  ),
}));
vi.mock("@/features/admin-tunnels/depenses-actions", () => ({
  ajouterDepenseAction: async () => undefined,
  supprimerDepenseAction: async () => undefined,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const charger = vi.fn();
vi.mock("@/features/admin-tunnels/apporteurs", async (importOriginal) => {
  const reel = await importOriginal<typeof import("@/features/admin-tunnels/apporteurs")>();
  return { ...reel, chargerTableauApporteurs: (...a: unknown[]) => charger(...a) };
});

import { chargerTableauApporteurs as _ignore } from "@/features/admin-tunnels/apporteurs";
import {
  coutParApporteurActif,
  construireEntonnoir,
} from "@/features/admin-tunnels/apporteurs-entonnoir";
import type { TableauApporteurs } from "@/features/admin-tunnels/apporteurs";
import Page from "../page";

void _ignore;
void Redirection;

function tableau(o: Partial<TableauApporteurs> = {}): TableauApporteurs {
  const depuis = new Date("2026-09-14T00:00:00Z");
  const jusqua = new Date("2026-10-06T12:00:00Z");
  const ok = { balises: true, fiches: true, reservations: true, reseau: true };
  return {
    periode: "4s",
    depuis,
    jusqua,
    entonnoir: construireEntonnoir({
      lignes: [],
      leads: [],
      depenses: [],
      sources: ok,
      depuis,
      jusqua,
    }),
    comparaison: [],
    parCampagne: [],
    parAnnonce: [],
    actifs: coutParApporteurActif(0, 0),
    depenseTotale: 0,
    dernieresDepenses: [],
    sources: ok,
    tronquee: false,
    ...o,
  };
}

async function rendre(sp: Record<string, string> = {}): Promise<string> {
  const el = await Page({
    params: Promise.resolve({ adminPrefix: "console" }),
    searchParams: Promise.resolve(sp),
  });
  return renderToStaticMarkup(el);
}

beforeEach(() => {
  acces = { autorise: true, role: "admin", peutEcrire: true };
  charger.mockReset();
  charger.mockResolvedValue(tableau());
});

describe("la page « Tunnel apporteurs »", () => {
  it("refuse un compte sans rôle reconnu : le refus est nommé, rien n'est lu", async () => {
    acces = { autorise: false, role: null, motif: "Votre compte n'a pas de rôle reconnu." };
    const html = await rendre();
    expect(html).toContain("Votre compte n&#x27;a pas de rôle reconnu.");
    expect(charger).not.toHaveBeenCalled();
    expect(html).not.toContain("Entonnoir par semaine");
  });

  it("sans aucune donnée : « non mesuré » partout, et AUCUN 0 dans la colonne Total", async () => {
    const html = await rendre();
    expect(html).toContain("non mesuré");
    expect(html).toContain("Entonnoir par semaine");
    expect(html).toContain("Aucune dépense saisie");
    // Aucune cellule de total ne vaut 0 : un zéro ici serait une panne prise pour un résultat.
    const total = html.match(/>0<\/td>/g) ?? [];
    expect(total).toHaveLength(0);
  });

  it("dit en clair que le coût par apporteur actif ne se lit qu'à 45-60 jours", async () => {
    const html = await rendre();
    expect(html).toContain("45-60 jours");
    expect(html).toContain("lisez les marches du haut");
  });

  it("1 ou 2 apporteurs actifs : « trop peu de cas pour conclure », aucun coût moyen", async () => {
    charger.mockResolvedValue(
      tableau({ actifs: coutParApporteurActif(500_00, 2), depenseTotale: 500_00 }),
    );
    const html = await rendre();
    expect(html).toContain("trop peu de cas pour conclure");
    expect(html).not.toMatch(/coût moyen\s*<strong>/);
  });

  it("le sélecteur de période est fait de liens, sans JavaScript", async () => {
    const html = await rendre();
    expect(html).toContain("?periode=4s");
    expect(html).toContain("?periode=semaine");
    expect(html).toContain("?periode=tout");
  });

  it("le formulaire de dépense n'apparaît que pour un rôle qui peut écrire", async () => {
    expect(await rendre()).toContain('name="montantEuros"');
    acces = { autorise: true, role: "reader", peutEcrire: false };
    const html = await rendre();
    expect(html).not.toContain('name="montantEuros"');
    expect(html).toContain("sans pouvoir les saisir");
  });

  it("affiche le message ou l'erreur de la dernière saisie", async () => {
    expect(await rendre({ depense: "ok" })).toContain("Dépense enregistrée.");
    expect(await rendre({ erreur: "Montant invalide." })).toContain("Montant invalide.");
  });

  it("une dépense saisie apparaît avec un bouton Supprimer", async () => {
    charger.mockResolvedValue(
      tableau({
        dernieresDepenses: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            spentOn: new Date("2026-10-01T00:00:00Z"),
            canal: "facebook",
            campagne: "apporteurs-video",
            montantCentimes: 1250,
            note: null,
          },
        ],
      }),
    );
    const html = await rendre();
    expect(html).toContain("apporteurs-video");
    expect(html).toContain("Supprimer");
  });

  it("P4 — par annonce : chaque marche, « non mesuré » pour les visites, déjà connus à part", async () => {
    charger.mockResolvedValue(
      tableau({
        parAnnonce: [
          {
            cle: "annonce-42",
            genre: "annonce",
            visites: null,
            etape1: 3,
            etape2: 2,
            reserves: 1,
            tenus: 1,
            retenus: 1,
            contrats: 1,
            coutParEtape1: null,
            coutParReservation: null,
          },
          {
            cle: "Déjà connus (revenus par la publicité)",
            genre: "deja-connus",
            visites: null,
            etape1: 1,
            etape2: 1,
            reserves: null,
            tenus: null,
            retenus: null,
            contrats: null,
            coutParEtape1: null,
            coutParReservation: null,
          },
        ],
      }),
    );
    const html = await rendre();
    expect(html).toContain("Par annonce");
    expect(html).toContain("annonce-42");
    expect(html).toContain("Créneaux réservés");
    expect(html).toContain("Contrats signés");
    expect(html).toContain("Déjà connus (revenus par la publicité)");
    const ligneDejaConnus = html.slice(html.indexOf("Déjà connus (revenus"));
    expect(ligneDejaConnus.slice(0, ligneDejaConnus.indexOf("</tr>"))).toContain("non mesuré");
  });
});
