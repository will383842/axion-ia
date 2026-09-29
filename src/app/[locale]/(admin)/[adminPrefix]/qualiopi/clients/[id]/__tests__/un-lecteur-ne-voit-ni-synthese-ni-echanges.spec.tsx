/**
 * ⛔ UN LECTEUR NE VOIT NI SYNTHÈSE NI ÉCHANGES (décision A2 de Will, 28/09 :
 * « seuls Will et les administrateurs lisent les comptes rendus ») — régime
 * FILTRE de la fiche client.
 *
 * Rendu de la VRAIE page, avec la VRAIE `gardePage` (seule la session est
 * doublée), pour chacun des quatre rôles exclus : `editor`, `reader`,
 * `secretaire`, `responsable_qualite`. Pour chacun, même en demandant
 * explicitement l'onglet Échanges :
 *   · AUCUNE lecture du dossier n'est faite (pas seulement aucun rendu) ;
 *   · aucun onglet du dossier n'est rendu ;
 *   · un message NOMME le rôle et la raison.
 *
 * Mutation qui fait rougir : dans la page, remplacer `peutVoirLesEchanges(acces.role)`
 * par `true`, ou ajouter « editor » à `ROLES_DOSSIER_ECHANGES`.
 * Contre-témoin : `admin` et `super_admin` voient les onglets, et la lecture a
 * lieu.
 * Angle mort : les pages dédiées (projet, préparer) sont couvertes par la garde
 * dérivée `la-lecture-est-gardee-comme-l-ecriture`, pas par ce rendu.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  session: null as unknown,
  lectures: {
    lireFaitsDuClient: vi.fn(),
    lireProjetsDuClient: vi.fn(),
    lireFaitsARanger: vi.fn(),
    lireRencontresDuClient: vi.fn(),
    lirePersonnesDuClient: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({ auth: () => Promise.resolve(d.session) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/server/qualiopi/crm/clients", async (orig) => {
  const { FICHE_360 } = await import("./_fiche-client-rendu");
  return {
    ...(await orig<typeof import("@/server/qualiopi/crm/clients")>()),
    getClient360: () => Promise.resolve(FICHE_360),
  };
});
vi.mock("@/features/dossier-client/queries", () => ({
  lireFaitsDuClient: (...a: unknown[]) => d.lectures.lireFaitsDuClient(...a),
  lireProjetsDuClient: (...a: unknown[]) => d.lectures.lireProjetsDuClient(...a),
  lireFaitsARanger: (...a: unknown[]) => d.lectures.lireFaitsARanger(...a),
  lireRencontresDuClient: (...a: unknown[]) => d.lectures.lireRencontresDuClient(...a),
  lirePersonnesDuClient: (...a: unknown[]) => d.lectures.lirePersonnesDuClient(...a),
}));
vi.mock("@/features/dossier-client/actions", () => ({
  ajouterPersonneFormAction: vi.fn(),
  basculerOppositionIaFormAction: vi.fn(),
  creerProjetFormAction: vi.fn(),
  confirmerSirenFormAction: vi.fn(),
}));
vi.mock("@/server/actions/qualiopi/clients", () => ({ updateClientAction: vi.fn() }));

import Page from "@/app/[locale]/(admin)/[adminPrefix]/qualiopi/clients/[id]/page";
import { rendreFiche } from "./_fiche-client-rendu";

beforeEach(() => {
  vi.clearAllMocks();
  for (const f of Object.values(d.lectures)) f.mockResolvedValue([]);
});

const LIBELLES: Record<string, string> = {
  editor: "rédacteur",
  reader: "lecteur",
  secretaire: "secrétaire",
  responsable_qualite: "responsable qualité",
};

describe("⛔ un lecteur ne voit ni synthèse ni échanges", () => {
  it.each(Object.keys(LIBELLES))(
    "rôle « %s » : aucun onglet du dossier, aucune lecture, message nommé",
    async (role) => {
      d.session = { user: { id: "u1", role } };
      for (const onglet of [undefined, "synthese", "echanges", "personnes", "projets"]) {
        const html = await rendreFiche(Page, onglet);
        for (const f of Object.values(d.lectures)) expect(f).not.toHaveBeenCalled();
        expect(html).not.toContain("Ce que fait la société");
        expect(html).not.toContain("?onglet=echanges");
        expect(html).toContain(`votre rôle : ${LIBELLES[role]}`);
        expect(html).toContain("réservés à Williams et aux administrateurs");
      }
    },
  );

  it.each(["admin", "super_admin"])(
    "contre-témoin : « %s » voit les onglets, et la lecture a lieu",
    async (role) => {
      d.session = { user: { id: "u1", role } };
      const html = await rendreFiche(Page, "synthese");
      expect(d.lectures.lireFaitsDuClient).toHaveBeenCalled();
      expect(html).toContain("?onglet=echanges");
      expect(html).toContain("Ce que fait la société");
      expect(html).not.toContain("réservés à Williams et aux administrateurs");
    },
  );
});
