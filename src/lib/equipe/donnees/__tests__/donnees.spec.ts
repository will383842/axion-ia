import { describe, expect, it } from "vitest";
import {
  estCategorieEquipe,
  estSlugReserve,
  QUESTIONNAIRES,
  schemaReponse,
  TEAM_CATEGORIES,
  TEAM_CONSENT_KINDS,
  TEAM_CONSENT_VERSION_COURANTE,
  texteConsentementParVersion,
  type TeamCategory,
} from "../index";

const presentation = "p".repeat(300);
const commun = {
  prenom: "Julie",
  lieu: "Annecy",
  intitule: "Je forme les équipes à l'IA",
  presentation,
  apport: "Un exemple concret.",
};
const consentements = { publication: true, photo: false, linkedin: false };

describe("catégories", () => {
  it("six catégories, slugs uniques, ordre croissant", () => {
    const slugs = TEAM_CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(6);
    const ordres = TEAM_CATEGORIES.map((c) => c.ordre);
    expect([...ordres].sort((a, b) => a - b)).toEqual(ordres);
    expect(estCategorieEquipe("apporteur")).toBe(true);
    expect(estCategorieEquipe("nimporte")).toBe(false);
  });
  it("slugs réservés refusés, catégories comprises", () => {
    for (const s of ["williams", "Questionnaire", "retrait", "carte", "developpeur"]) {
      expect(estSlugReserve(s)).toBe(true);
    }
    expect(estSlugReserve("julie-annecy")).toBe(false);
  });
});

describe("consentements", () => {
  it("trois consentements séparés, chacun avec sa version, sa référence et son texte", () => {
    const refs = TEAM_CONSENT_KINDS.map((k) => TEAM_CONSENT_VERSION_COURANTE[k].formRef);
    expect(refs).toEqual([
      "team-profile-publication",
      "team-profile-photo",
      "team-profile-linkedin",
    ]);
    for (const k of TEAM_CONSENT_KINDS) {
      const v = TEAM_CONSENT_VERSION_COURANTE[k];
      expect(texteConsentementParVersion(k, v.version)).toBe(v.texte);
    }
    expect(texteConsentementParVersion("photo", "inconnue")).toBeNull();
  });
});

describe("questionnaires v1", () => {
  it("existent pour chaque catégorie, identifiants de question uniques", () => {
    for (const c of TEAM_CATEGORIES) {
      const qn = QUESTIONNAIRES[c.slug as TeamCategory].v1;
      expect(qn).toBeDefined();
      const ids = qn!.questions.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it("garde de vocabulaire : ni « interne », ni « externe », ni prix, ni ville interdite dans les libellés", () => {
    const tout = JSON.stringify(QUESTIONNAIRES) + JSON.stringify(TEAM_CONSENT_VERSION_COURANTE);
    expect(tout).not.toMatch(/\binterne|\bexterne|grenoble|\d\s?€|commission|tarif/i);
  });
  it("schéma : une réponse valide passe, version ou catégorie inconnue → null", () => {
    const s = schemaReponse("apporteur", "v1")!;
    const categorie = {
      metier_precedent: "Comptable, 10 ans",
      entreprises_connues: "PME du bâtiment",
      pourquoi_axion: "Parce que.",
      premier_echange: "Un café.",
      promesse: "Une mise en relation.",
    };
    expect(s.safeParse({ commun, categorie, consentements }).success).toBe(true);
    expect(schemaReponse("apporteur", "v99")).toBeNull();
  });
  it("schéma : refuse HTML, champ inconnu, présentation courte, accord de publication absent", () => {
    const s = schemaReponse("autres", "v1")!;
    const ok = { commun, categorie: {}, consentements };
    expect(s.safeParse(ok).success).toBe(true);
    expect(s.safeParse({ ...ok, commun: { ...commun, apport: "<b>x</b>" } }).success).toBe(false);
    expect(s.safeParse({ ...ok, commun: { ...commun, nomFamille: "Dupont" } }).success).toBe(false);
    expect(s.safeParse({ ...ok, commun: { ...commun, presentation: "court" } }).success).toBe(
      false,
    );
    expect(s.safeParse({ ...ok, commun: { ...commun, prenom: "Julie2" } }).success).toBe(false);
    expect(
      s.safeParse({ ...ok, consentements: { ...consentements, publication: false } }).success,
    ).toBe(false);
  });
  it("schéma : LinkedIn limité à linkedin.com en https", () => {
    const s = schemaReponse("autres", "v1")!;
    const avec = (linkedin: string) =>
      s.safeParse({ commun: { ...commun, linkedin }, categorie: {}, consentements }).success;
    expect(avec("https://www.linkedin.com/in/julie")).toBe(true);
    expect(avec("http://www.linkedin.com/in/julie")).toBe(false);
    expect(avec("https://linkedin.com.evil.fr/in/julie")).toBe(false);
    expect(avec("https://evil.fr/linkedin.com")).toBe(false);
    expect(avec("javascript:alert(1)")).toBe(false);
  });
});
