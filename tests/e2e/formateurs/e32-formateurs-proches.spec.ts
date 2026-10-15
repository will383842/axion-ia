// @formateurs E32 — « Formateurs proches » sur une fiche client : rangés par
// distance (même département, même région, ailleurs), satisfaction MASQUÉE sous
// 5 avis, et jamais montrés au formateur.
//
// Lecture réelle : `lireFormateursProches` (le service que la fiche client appelle,
// derrière `formateurs.proches_bloc` et l'acte `habiliter_formateur`). Points posés
// au référentiel des communes (créées par le banc seulement si absentes).
//
// « Jamais montré au formateur » : le service est `server-only`, et le banc vérifie
// qu'aucun module de l'espace formateur (pages, routes, serveur) ne l'importe, ni lui
// ni son composant d'écran — seule la console d'administration le lit.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import {
  creerFormateurPret,
  poserAvisSatisfaction,
  poserCommune,
} from "../fixtures/formateurs/missions-donnees";
import { cadreScenario } from "../fixtures/formateurs/missions-scenario";

const sc = cadreScenario("e32");
const PROCHES = "@/server/qualiopi/formateurs-proches/formateurs-proches-service";

const COMMUNES = {
  lyon3: {
    codeInsee: "69383",
    nom: "Lyon 3e Arrondissement",
    codePostal: "69003",
    lat: 45.7597,
    lng: 4.8422,
    departement: "69",
  },
  villeurbanne: {
    codeInsee: "69266",
    nom: "Villeurbanne",
    codePostal: "69100",
    lat: 45.7719,
    lng: 4.8902,
    departement: "69",
  },
  vienne: {
    codeInsee: "38544",
    nom: "Vienne",
    codePostal: "38200",
    lat: 45.5255,
    lng: 4.8743,
    departement: "38",
  },
  grenoble: {
    codeInsee: "38185",
    nom: "Grenoble",
    codePostal: "38000",
    lat: 45.1885,
    lng: 5.7245,
    departement: "38",
  },
  paris11: {
    codeInsee: "75111",
    nom: "Paris 11e Arrondissement",
    codePostal: "75011",
    lat: 48.8592,
    lng: 2.3798,
    departement: "75",
  },
} as const;

interface Classe {
  readonly id: string;
  readonly distanceKm?: number | null;
  readonly stats: {
    readonly satisfaction: { readonly moyenne: number; readonly avis: number } | null;
    readonly formationsRealisees: number;
  };
}

async function fichiers(dossier: string): Promise<string[]> {
  const sortie: string[] = [];
  for (const e of await readdir(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...(await fichiers(p)));
    else if (/\.(ts|tsx)$/.test(e.name)) sortie.push(p);
  }
  return sortie;
}

test.describe("@formateurs E32 — formateurs proches sur une fiche client", () => {
  test.setTimeout(240_000);

  test("rangés par distance, satisfaction masquée sous 5 avis", async () => {
    const { pilote, monde } = sc;
    for (const c of Object.values(COMMUNES)) await poserCommune(monde, c);
    const pres = await creerFormateurPret(monde, {
      prenom: "Quentin",
      communeInsee: "69266",
      codePostalPro: "69100",
    });
    const vienne = await creerFormateurPret(monde, {
      prenom: "Rose",
      communeInsee: "38544",
      codePostalPro: "38200",
    });
    const grenoble = await creerFormateurPret(monde, {
      prenom: "Sacha",
      communeInsee: "38185",
      codePostalPro: "38000",
    });
    const paris = await creerFormateurPret(monde, {
      prenom: "Tess",
      communeInsee: "75111",
      codePostalPro: "75011",
    });
    await poserAvisSatisfaction(monde, pres.id, [5, 4, 5, 4, 5]); // 5 avis : affichée
    await poserAvisSatisfaction(monde, vienne.id, [5, 5, 5, 5]); // 4 avis : masquée

    const r = await pilote.appeler<{
      depart: { sorte: string };
      groupes: Array<{ cle: string; formateurs: Classe[] }>;
    } | null>(PROCHES, "lireFormateursProches", [monde.clientId, new Date()]);
    expect(r).not.toBeNull();
    expect(r!.depart.sorte).toBe("lieu");

    const miens = new Set([pres.id, vienne.id, grenoble.id, paris.id]);
    const groupes = Object.fromEntries(
      r!.groupes.map((g) => [g.cle, g.formateurs.filter((f) => miens.has(f.id))]),
    );
    expect(groupes["meme_departement"]?.map((f) => f.id)).toEqual([pres.id]);
    expect(groupes["meme_region"]?.map((f) => f.id)).toEqual([vienne.id, grenoble.id]);
    expect(groupes["ailleurs"]?.map((f) => f.id)).toEqual([paris.id]);
    // L'ordre des groupes : même département, puis région, puis ailleurs.
    const ordre = r!.groupes.map((g) => g.cle).filter((c) => c !== "lieu_inconnu");
    expect(ordre).toEqual(["meme_departement", "meme_region", "ailleurs"]);

    const [p] = groupes["meme_departement"]!;
    const [v] = groupes["meme_region"]!;
    expect(p!.stats.satisfaction).toEqual({ moyenne: 4.6, avis: 5 }); // 5 avis : affichée
    expect(v!.stats.satisfaction).toBeNull(); // 4 avis : masquée
    expect(v!.stats.formationsRealisees).toBe(1);
  });

  test("jamais montré au formateur : seule la console lit le service", async () => {
    const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const service = await readFile(
      path.join(racine, "src/server/qualiopi/formateurs-proches/formateurs-proches-service.ts"),
      "utf8",
    );
    expect(service).toMatch(/^import "server-only";/m);
    const importeurs: string[] = [];
    for (const f of await fichiers(path.join(racine, "src"))) {
      const texte = await readFile(f, "utf8");
      if (/formateurs-proches-service|components\/admin\/qualiopi\/FormateursProches/.test(texte)) {
        importeurs.push(path.relative(racine, f));
      }
    }
    const horsConsole = importeurs.filter(
      (f) =>
        !f.startsWith("src/app/[locale]/(admin)/") &&
        !f.startsWith("src/server/qualiopi/formateurs-proches/") &&
        !f.startsWith("src/components/admin/"),
    );
    expect(horsConsole).toEqual([]);
    for (const espace of [
      "src/app/[locale]/espace-formateur",
      "src/app/formateur",
      "src/server/formateur",
    ]) {
      expect(importeurs.filter((f) => f.startsWith(espace))).toEqual([]);
    }
  });
});
