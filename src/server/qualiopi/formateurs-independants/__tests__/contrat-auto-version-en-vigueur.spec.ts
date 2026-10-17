/**
 * `contrat_auto` — la VERSION EN VIGUEUR du contrat-cadre, lisible par le serveur.
 *
 * Une seule source : la plus haute version ARRÊTÉE (`versions-arretees.ts`), jamais en
 * dessous de la version minimale d'un nouvel indépendant. Elle sert à la fois :
 *   · au préalable d'allumage de `contrat_auto` (fait `version_contrat_arretee`) ;
 *   · à la préparation du contrat (`versionContratAEmettre`), donc au contrat du dossier.
 * Les deux ne peuvent plus diverger.
 *
 * Et `activation_auto`, qui dépend de `contrat_auto`, reste derrière la garde d'activation.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/server/qualiopi/documents/documents-service", () => ({ generateDocument: vi.fn() }));
vi.mock("@/server/qualiopi/config/site-settings", () => ({ getQualiopiConfig: vi.fn() }));
vi.mock("@/server/qualiopi/documents/organisme", () => ({ getOrganismeIdentite: vi.fn() }));
vi.mock("@/server/registre-entreprises/annuaire", () => ({ lireEtablissementParSiret: vi.fn() }));

import { VERSIONS_ARRETEES } from "@/server/qualiopi/documents/templates/versions-arretees";

import { versionContratAEmettre } from "../contrat-cadre-emission";
import {
  VERSION_MINIMALE_CONTRAT_INDEPENDANT,
  regleActivationApplicable,
} from "../garde-activation-complete";
import {
  CLES_INTERRUPTEURS,
  INTERRUPTEURS,
  etatsParDefaut,
  prealablesManquants,
  type EtatsInterrupteurs,
} from "../interrupteurs";
import {
  libelleVersionContratCadreEnVigueur,
  lireFaitsPrealables,
  versionContratCadreEnVigueur,
} from "../prealables-faits";

const Composant = (() => null) as never;

describe("la version en vigueur du contrat-cadre", () => {
  it("se lit dans le registre : version, date d'arrêt et texte (fichier, composant)", () => {
    const v = versionContratCadreEnVigueur();
    expect(v).not.toBeNull();
    const arretee = VERSIONS_ARRETEES.contrat_sous_traitance?.[v!.version];
    expect(v).toMatchObject({
      version: v!.version,
      arreteeLe: arretee?.arreteeLe,
      fichier: arretee?.fichier,
    });
    expect(v!.Composant).toBe(arretee?.Composant);
    const versions = Object.keys(VERSIONS_ARRETEES.contrat_sous_traitance ?? {}).map(Number);
    expect(v!.version).toBe(Math.max(...versions));
  });

  it("aucune version arrêtée : rien n'est en vigueur", () => {
    expect(versionContratCadreEnVigueur({})).toBeNull();
  });

  it("une version sous la version minimale d'un indépendant n'est pas en vigueur", () => {
    const sous = VERSION_MINIMALE_CONTRAT_INDEPENDANT - 1;
    expect(
      versionContratCadreEnVigueur({
        [sous]: { arreteeLe: "2026-01-01", fichier: "x.tsx", Composant },
      }),
    ).toBeNull();
  });

  it("une date d'arrêt illisible : version écartée (lecture prudente)", () => {
    const v = VERSION_MINIMALE_CONTRAT_INDEPENDANT;
    expect(
      versionContratCadreEnVigueur({
        [v]: { arreteeLe: "2026-01-01", fichier: "a.tsx", Composant },
        [v + 1]: { arreteeLe: "bientôt", fichier: "b.tsx", Composant },
      })?.version,
    ).toBe(v);
  });

  it("la préparation du contrat émet CETTE version", () => {
    expect(versionContratAEmettre()).toBe(versionContratCadreEnVigueur()?.version);
  });

  it("le préalable d'allumage lit CETTE version", () => {
    expect(lireFaitsPrealables()).toEqual({ version_contrat_arretee: true });
  });

  it("la console la nomme en clair (version et date d'arrêt)", () => {
    const v = versionContratCadreEnVigueur()!;
    const l = libelleVersionContratCadreEnVigueur();
    expect(l).toContain(`v${v.version}`);
    expect(l).toMatch(/arrêtée le \d{1,2} \S+ \d{4}/);
  });
});

function etats(partiel: Partial<EtatsInterrupteurs> = {}): EtatsInterrupteurs {
  return { ...etatsParDefaut(), ...partiel };
}

describe("contrat_auto allumable, l'activation reste gardée", () => {
  const MERES = { dossier_en_ligne: true, textes_valides: true } as const;

  it("version en vigueur et mères allumées : allumage permis", () => {
    expect(prealablesManquants("contrat_auto", true, etats(MERES), lireFaitsPrealables())).toEqual(
      [],
    );
  });

  it("sans version : refusé avec un message qui dit quoi faire", () => {
    const m = prealablesManquants("contrat_auto", true, etats(MERES), {
      version_contrat_arretee: false,
    });
    expect(m).toHaveLength(1);
    expect(m[0]).toMatch(/version/i);
    expect(m[0]).toMatch(/arrêt/i);
  });

  it("tout allumé : la garde d'activation ne se lève toujours pas", () => {
    const tout = etats(
      Object.fromEntries(
        CLES_INTERRUPTEURS.filter((c) => typeof INTERRUPTEURS[c].positionSure === "boolean").map(
          (c) => [c, true],
        ),
      ) as Partial<EtatsInterrupteurs>,
    );
    expect(
      prealablesManquants("garde_activation", false, tout, lireFaitsPrealables()).length,
    ).toBeGreaterThan(0);
  });

  it("activation_auto allumé avec la garde par défaut : règle COMPLÈTE (pièces probantes)", () => {
    const e = etats({ ...MERES, contrat_auto: true, activation_auto: true });
    expect(e.garde_activation).toBe(true);
    expect(regleActivationApplicable(e)).toBe("complete");
  });
});
