/**
 * CLIQUET — l'écran de groupe sert à chaque signataire SON texte.
 *
 * ## Pourquoi ce fichier existe séparément
 *
 * `mention-du-formateur-est-la-sienne.spec.ts` garde le **contenu** des deux
 * jeux de mentions. Il ne garde pas le **câblage** : rebrancher
 * `mentionsContresignature` sur `mentionComplete` — c'est-à-dire refaire
 * exactement le défaut du 2026-08-24 — le laissait entièrement vert. Mesuré, en
 * le rebranchant.
 *
 * 🔑 Une garde qui vérifie la bonne chose au mauvais endroit ne garde rien.
 *
 * ## Le second trou que ce fichier ferme
 *
 * `feuille-groupe-appartenance.spec.ts` force `findFirst` à rendre `null` dans
 * son `beforeEach`, pour ses trois cas. Conséquence mesurée : **le corps de
 * `lireFeuilleGroupe` n'est exécuté par aucun test** — ni le regroupement par
 * demi-journée, ni le filtre `parJour`, ni la construction des lignes. Ce
 * fichier est le premier à faire rendre une vraie session à la requête.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { trainingSession: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
}));

import { lireFeuilleGroupe } from "@/server/qualiopi/emargement/feuille-groupe";

const SESSION = "11111111-1111-1111-1111-111111111111";
const FORMATEUR = "22222222-2222-2222-2222-222222222222";
/** Après la matinée du 10 juin, pour que la demi-journée soit « commencée ». */
const MAINTENANT = new Date("2026-06-10T12:00:00Z");

/**
 * Une session minimale mais FIDÈLE au `select` de `lireFeuilleGroupe`.
 *
 * ⚠️ Recopier la signature de la requête, pas une approximation : un mock
 * incomplet est un contrat rompu, et il rend vert un code qui casserait en
 * production. Chaque champ ci-dessous est demandé par le `select` réel.
 */
function sessionMockee() {
  return {
    titreSession: "IA pour bien commencer",
    statut: "planifiee",
    formateurPrincipal: { nom: "Durand", prenom: "Claire" },
    jours: [
      {
        date: new Date("2026-06-10T00:00:00Z"),
        heureDebut: "09:00",
        heureFin: "17:00",
        trainer: null,
      },
    ],
    emargementContresignatures: [],
    enrollments: [
      {
        id: "e-1",
        statut: "inscrite",
        trainee: { nom: "Martin", prenom: "Jean" },
        presences: [
          {
            id: "c-1",
            date: new Date("2026-06-10T00:00:00Z"),
            demiJournee: "matin",
            emargementSignatures: [],
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  mockFindFirst.mockReset();
  mockFindFirst.mockResolvedValue(sessionMockee());
});

describe("l'écran de groupe sert à chaque signataire son texte", () => {
  it("le corps de la lecture est réellement exercé — sinon rien de ce qui suit ne vaut", async () => {
    // 🔑 CONTRE-TÉMOIN, et il n'est pas décoratif : la spec voisine mocke
    // `findFirst` sur `null`, et tout le corps de la fonction y est donc mort.
    // Si ce mock cessait de correspondre au `select` réel, la fonction rendrait
    // zéro groupe et les assertions suivantes passeraient au vert en
    // n'examinant rien.
    const feuille = await lireFeuilleGroupe(SESSION, MAINTENANT, "Axion-IA", FORMATEUR);

    expect(
      feuille,
      "la lecture a rendu null : le mock ne correspond plus au `select`",
    ).not.toBeNull();
    expect(
      feuille?.length,
      "aucune demi-journée n'a été construite : le regroupement n'est pas exercé, " +
        "et les assertions de texte ci-dessous ne mesureraient rien.",
    ).toBe(1);
    expect(feuille?.[0]?.lignes.length, "aucune ligne de stagiaire").toBe(1);
  });

  it("🔴 le FORMATEUR reçoit le texte de contresignature, pas celui du stagiaire", async () => {
    // Le défaut du 2026-08-24, à l'endroit exact où il vivait : un seul champ
    // `mentions` alimentait les deux écrans, et le dialogue de contresignature
    // affichait donc « J'atteste avoir suivi … » à quelqu'un qui a ANIMÉ.
    const feuille = await lireFeuilleGroupe(SESSION, MAINTENANT, "Axion-IA", FORMATEUR);
    const texte = feuille?.[0]?.mentionsContresignature.join(" ") ?? "";

    expect(
      texte,
      "le champ servi au dialogue de contresignature ne parle pas d'animation : " +
        "il est probablement rebranché sur `mentionComplete`, le texte du " +
        "stagiaire. C'est le défaut du 2026-08-24, et il est scellé dans le tuple " +
        "haché de la contresignature.",
    ).toMatch(/anim/i);
    expect(texte, "le formateur lit de nouveau « avoir suivi »").not.toMatch(/avoir suivi/i);
  });

  it("🔴 le STAGIAIRE qui signe sur le poste du formateur garde SON texte", async () => {
    // L'autre moitié, et elle compte autant : le même écran fait signer les
    // stagiaires sur l'appareil du formateur. Corriger le texte du formateur ne
    // doit pas revenir à servir « j'ai animé » à un stagiaire — ce serait le
    // défaut symétrique, et il serait scellé de la même façon.
    const feuille = await lireFeuilleGroupe(SESSION, MAINTENANT, "Axion-IA", FORMATEUR);
    const texte = feuille?.[0]?.mentions.join(" ") ?? "";

    expect(texte, "le stagiaire ne lit plus qu'il a SUIVI la demi-journée").toMatch(/avoir suivi/i);
    expect(
      texte,
      "le stagiaire lit qu'il a ANIMÉ la formation : le correctif du formateur a " +
        "été appliqué au mauvais champ.",
    ).not.toMatch(/avoir animé/i);
  });

  it("les deux champs ne sont pas le même objet", async () => {
    // Garde-fou contre la correction paresseuse : réaffecter le même tableau aux
    // deux champs ferait passer les deux tests ci-dessus dès lors que le texte
    // contiendrait les deux mots.
    const feuille = await lireFeuilleGroupe(SESSION, MAINTENANT, "Axion-IA", FORMATEUR);
    const dj = feuille?.[0];
    expect(
      dj?.mentions.join(" "),
      "le stagiaire et le formateur reçoivent le MÊME texte : l'un des deux lit " +
        "forcément une affirmation fausse sur ce qu'il a fait.",
    ).not.toBe(dj?.mentionsContresignature.join(" "));
  });
});
