/**
 * Tests — le chantier AFEST N'A PAS touché au cœur collectif.
 *
 * ## Pourquoi ce fichier existe
 *
 * La tentation, en construisant une seconde chaîne de preuve, est de « juste »
 * généraliser la première : ajouter un champ au tuple V1, bumper
 * `MENTION_VERSION` parce que le texte AFEST est différent, rendre
 * `reconstruction.ts` générique. Chacun de ces gestes est invisible en revue de
 * diff et catastrophique en production : les empreintes déjà émises sur les
 * sessions collectives cesseraient d'être recalculables, et `verifierChaine`
 * rendrait `empreinte_invalide` sur des feuilles parfaitement intactes — soit,
 * dans un dossier de contrôle, le verdict « ces feuilles ont été modifiées
 * après coup ».
 *
 * Les VECTEURS D'OR ci-dessous sont figés en dur. Ils ne se « mettent pas à
 * jour » : si l'un d'eux tombe, la bonne réaction est de restaurer le
 * sérialiseur, pas de recopier la nouvelle valeur.
 */

import { describe, it, expect } from "vitest";
import {
  tupleCanonique,
  calculerSelfHash,
  HASH_VERSION_COURANTE,
  type TupleSignatureV1,
} from "@/server/qualiopi/emargement/hash";
import { MENTION_VERSION } from "@/server/qualiopi/emargement/mentions";
import { COLONNES_SCELLEES } from "@/server/qualiopi/emargement/reconstruction";
import {
  HASH_VERSION_CONTRESIGNATURE,
  calculerSelfHashContresignature,
  type TupleContresignatureV1,
} from "@/server/qualiopi/emargement/contresignature-hash";
import { MENTION_VERSION_AFEST } from "./mentions-afest";
import { HASH_VERSION_SEANCE } from "./seance-signature-hash";

const TUPLE_COLLECTIF: TupleSignatureV1 = {
  contexteType: "collectif",
  enrollmentId: "22222222-2222-4222-8222-222222222222",
  creneauId: "11111111-1111-4111-8111-111111111111",
  coachingId: null,
  date: "2026-06-10",
  demiJournee: "matin",
  heureDebut: "09:00",
  heureFin: "12:30",
  formationIntitule: "Bien démarrer avec l'IA",
  modules: ["Module 1"],
  formateurNom: "Williams Jullin",
  signataireNom: "Alice Dupont",
  signataireEmail: "alice@example.com",
  methode: "canvas",
  signatureSha256: "a".repeat(64),
  signeAtIso: "2026-06-10T10:15:30.123Z",
  ipHash: "0123456789abcdef",
  userAgentSha256: "b".repeat(64),
  mentionVersion: "v1",
  prevHash: null,
};

const TUPLE_CONTRESIGNATURE: TupleContresignatureV1 = {
  contexteType: "collectif",
  sessionId: "33333333-3333-4333-8333-333333333333",
  coachingId: null,
  trainerId: "44444444-4444-4444-8444-444444444444",
  formateurNom: "Williams Jullin",
  date: "2026-06-10",
  demiJournee: "matin",
  heureDebut: "09:00",
  heureFin: "12:30",
  formationIntitule: "Bien démarrer avec l'IA",
  modules: ["Module 1"],
  methode: "canvas",
  signatureSha256: "a".repeat(64),
  signeAtIso: "2026-06-10T10:15:30.123Z",
  ipHash: "0123456789abcdef",
  userAgentSha256: "b".repeat(64),
  mentionVersion: "v1",
  prevHash: null,
};

describe("non-régression du chemin collectif", () => {
  it("🔴 la forme canonique V1 des signatures stagiaires est INCHANGÉE", () => {
    expect(tupleCanonique(TUPLE_COLLECTIF)).toBe(
      '{"coachingId":null,"contexteType":"collectif","creneauId":"11111111-1111-4111-8111-111111111111","date":"2026-06-10","demiJournee":"matin","enrollmentId":"22222222-2222-4222-8222-222222222222","formateurNom":"Williams Jullin","formationIntitule":"Bien démarrer avec l\'IA","heureDebut":"09:00","heureFin":"12:30","ipHash":"0123456789abcdef","mentionVersion":"v1","methode":"canvas","modules":["Module 1"],"prevHash":null,"signataireEmail":"alice@example.com","signataireNom":"Alice Dupont","signatureSha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","signeAt":"2026-06-10T10:15:30.123Z","userAgentSha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","v":1}',
    );
  });

  it("🔴 l'empreinte collective de référence est INCHANGÉE", () => {
    // Vecteur d'or FIGÉ. S'il tombe, une empreinte déjà émise en production
    // vient de devenir irrecalculable — restaurer le sérialiseur, ne PAS
    // recopier la nouvelle valeur.
    expect(calculerSelfHash(TUPLE_COLLECTIF)).toBe(
      "8906fd93529c5088720fc154d29aa2d391beaa30e925b2b2439f3fcbd60bfa8e",
    );
  });

  it("🔴 l'empreinte de contresignature de référence est INCHANGÉE", () => {
    expect(calculerSelfHashContresignature(TUPLE_CONTRESIGNATURE)).toBe(
      "3a7d2fbe74fdba27628ed5054f748381a8b7677434f1dd6dd53cb16b23c28b39",
    );
  });

  it("🔴 `MENTION_VERSION` (collectif) n'a PAS été bumpée pour l'AFEST", () => {
    // Le texte AFEST est différent, et c'est précisément pour cela qu'il a SA
    // propre version. Toucher celle du collectif rendrait invérifiable ce qui a
    // été présenté aux stagiaires des sessions déjà signées.
    expect(MENTION_VERSION).toBe("v1");
    expect(MENTION_VERSION_AFEST).not.toBe(MENTION_VERSION);
  });

  it("🔴 les versions de tuple sont INDÉPENDANTES entre contextes", () => {
    expect(HASH_VERSION_COURANTE).toBe(1);
    expect(HASH_VERSION_CONTRESIGNATURE).toBe(1);
    expect(HASH_VERSION_SEANCE).toBe(1);
    // Elles valent toutes 1 aujourd'hui, mais elles sont TROIS constantes
    // distinctes : le jour où l'une bouge, les deux autres ne doivent pas.
  });

  it("🔴 `COLONNES_SCELLEES` (collectif) n'a pas été amputée ni étendue", () => {
    expect([...COLONNES_SCELLEES].sort()).toStrictEqual(
      [
        "contexteType",
        "enrollmentId",
        "coachingId",
        "creneauId",
        "signataireNom",
        "signataireEmail",
        "date",
        "demiJournee",
        "heureDebut",
        "heureFin",
        "formateurNom",
        "formationIntitule",
        "modulesSnapshot",
        "methode",
        "signatureSha256",
        "signeAt",
        "ipHash",
        "userAgentSha256",
        "mentionVersion",
        "prevHash",
      ].sort(),
    );
  });
});
