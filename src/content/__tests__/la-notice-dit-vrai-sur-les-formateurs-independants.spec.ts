// @vitest-environment node

/**
 * Lot L16b-1 (ADR 0066) — la politique de confidentialité décrit le traitement
 * des données des FORMATEURS INDÉPENDANTS, avant l'allumage du dossier en ligne
 * (dont le premier écran renvoie à cette section, par son ancre).
 *
 * Test ROUGE d'abord : la notice ne disait rien des formateurs indépendants.
 * Garde de FORME et de faits vérifiables, pas de rédaction.
 *
 * Lot L16b-2 : chaque phrase de la notice est prouvée par le code. Les fonctions
 * qui n'existaient pas au lot L16b-1 (antivirus des pièces, lien de 30 jours,
 * alerte interne sans nom, code de signature) existent désormais, livrées
 * éteintes : la notice les décrit au présent, telles qu'elles s'appliquent aux
 * données quand elles sont collectées. Les durées sont lues dans le code, pas
 * recopiées.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { conservationApresFin } from "@/server/qualiopi/formateurs-independants/fin-collaboration";
import { DUREE_LIEN_DOSSIER_JOURS } from "@/server/qualiopi/formateurs-independants/jeton-dossier";
import { FENETRE_STATS_MOIS } from "@/server/qualiopi/formateurs-proches/stats-formateurs";

import { LEGAL_PAGES } from "../legal";

function lire(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf-8");
}

/** Années pleines entre deux dates (règle `conservationApresFin`). */
function annees(depuis: Date, jusqua: Date): number {
  return jusqua.getUTCFullYear() - depuis.getUTCFullYear();
}

const ANCRE = "formateurs-independants";

function section(locale: "fr" | "en") {
  const page = LEGAL_PAGES.find((p) => p.slug === "politique-confidentialite");
  return page?.[locale].sections.find((s) => s.anchor === ANCRE);
}

const FR = () => section("fr")?.body ?? "";
const EN = () => section("en")?.body ?? "";

describe("la notice dit vrai sur les formateurs indépendants", () => {
  it("🔴 la section existe en français ET en anglais, à une ancre stable", () => {
    expect(section("fr"), "section FR absente").toBeDefined();
    expect(section("en"), "section EN absente").toBeDefined();
  });

  it("le miroir anglais porte les mêmes faits clés", () => {
    for (const fait of ["6.1.b", "6.1.c", "6.1.f", "L.8222-1", "IBAN", "Calendly"]) {
      expect(EN()).toContain(fait);
    }
    expect(EN()).toMatch(/five years/);
    for (const fait of [
      "antivirus",
      "Telegram",
      "ZeptoMail",
      "recherche-entreprises.api.gouv.fr",
    ]) {
      expect(EN()).toContain(fait);
    }
    expect(EN()).toMatch(/30 days/);
    expect(EN()).toMatch(/15 minutes/);
    expect(EN()).toMatch(/pseudonymis/);
    expect(EN()).not.toMatch(/chartered accountant|accounting firm|Tiime/i);
    expect(EN()).not.toMatch(/accounting software|e-invoicing platform/);
    // Le contrat suit la règle des 5 ans, jamais celle des 10 ans.
    expect(EN()).not.toMatch(/agreement[^.;]*ten years/);
  });

  it("nomme les bases légales (6.1.b, 6.1.c, 6.1.f) et l'obligation de vigilance", () => {
    for (const base of ["6.1.b", "6.1.c", "6.1.f"]) expect(FR()).toContain(base);
    expect(FR()).toMatch(/L\.?\s?8222-1/);
  });

  it("dit le registre public consulté et la preuve conservée", () => {
    expect(FR()).toMatch(/registre/i);
    expect(FR()).toMatch(/liste publique des organismes de formation/i);
  });

  it("dit que l'IBAN est enregistré chiffré, sans citer de cabinet ni de prestataire non branché", () => {
    expect(FR()).toMatch(/IBAN est enregistré chiffré/);
    expect(FR()).not.toMatch(/expert-comptable|cabinet|Tiime/i);
    // Aucun flux vers un logiciel de comptabilité ni une plateforme de facturation
    // électronique (l'adaptateur de facturation électronique n'est qu'une interface).
    expect(FR()).not.toMatch(/logiciel de comptabilité|plateforme de facturation électronique/);
  });

  it("dit le registre réellement interrogé", () => {
    expect(lire("src", "server", "registre-entreprises", "annuaire.ts")).toContain(
      "https://recherche-entreprises.api.gouv.fr/search",
    );
    expect(FR()).toContain("recherche-entreprises.api.gouv.fr");
  });

  it("dit le lien personnel : sa durée lue dans le code, et sa révocation", () => {
    expect(DUREE_LIEN_DOSSIER_JOURS).toBe(30);
    expect(FR()).toMatch(new RegExp(`lien personnel, valable ${DUREE_LIEN_DOSSIER_JOURS} jours`));
    expect(FR()).toMatch(/annule les précédents/);
  });

  it("dit l'antivirus et le chiffrement de chaque pièce déposée, comme le dépôt le fait", () => {
    const depot = lire("src", "server", "qualiopi", "formateurs-independants", "depot.ts");
    expect(depot).toMatch(/controlerPiece\(/);
    expect(depot).toMatch(/chiffrerPieceAuRepos\(/);
    expect(FR()).toMatch(/déposez une pièce, elle est analysée par un antivirus/);
    expect(FR()).toMatch(/stockée chiffrée/);
  });

  it("dit les déclarations datées et le code de signature, durée lue dans le code", () => {
    expect(FR()).toMatch(/déclarations[^.]*enregistrées avec leur date et leur heure/);
    const m = lire(
      "src",
      "server",
      "qualiopi",
      "documents",
      "signature",
      "code-signature.ts",
    ).match(/CODE_VALIDITE_MS = (\d+) \* 60 \* 1000/);
    expect(m, "durée du code introuvable").not.toBeNull();
    expect(FR()).toMatch(new RegExp(`code à usage unique, valable ${m![1]} minutes`));
  });

  it("nomme ZeptoMail et l'alerte interne Telegram sans nom, comme le formateur d'alertes", () => {
    expect(FR()).toMatch(/ZeptoMail/);
    expect(FR()).toMatch(/Telegram[^;]*identifiant court[^;]*sans votre nom/);
    const format = lire("src", "server", "notifications", "format.ts");
    const bloc = format.slice(format.indexOf('case "TRAINER_DOSSIER_RECU"'));
    expect(bloc.slice(0, bloc.indexOf("case ", 10))).toMatch(/trainerId\.slice\(0, 8\)/);
  });

  it("dit vrai sur les statistiques internes : satisfaction, commune et non adresse, usage interne", () => {
    expect(FENETRE_STATS_MOIS).toBe(36);
    expect(FR()).toMatch(/trois dernières années/);
    expect(FR()).toMatch(/satisfaction donnée par les stagiaires/);
    expect(FR()).toMatch(/centre de votre commune d'exercice \(jamais votre adresse\)/);
    expect(FR()).toMatch(/à partir de cinq avis/);
    expect(FR()).toMatch(/jamais publiée ni montrée aux formateurs/);
  });

  it("dit l'export art. 15 et l'effacement art. 17 tels que le module les fait", () => {
    expect(FR()).toMatch(/IBAN masqué/);
    expect(FR()).toMatch(/liste de vos pièces, sans leur contenu/);
    expect(FR()).toMatch(/pseudonymisation/);
    expect(FR()).toMatch(/pièces que la loi impose de conserver[^.]*restent intactes/);
  });

  it("dit la décision humaine (G1) et le fil interne sans nom (G2)", () => {
    expect(FR()).toMatch(/décidés par une personne/i);
    expect(FR()).toMatch(/ne concluent jamais seuls/);
  });

  it("dit la conservation par critères, contrat et vigilance 5 ans après la fin (G5), sans purge annoncée", () => {
    const fin = new Date("2030-06-01T00:00:00Z");
    const c = conservationApresFin(fin);
    expect(annees(fin, c.contratEtVigilance)).toBe(5);
    expect(annees(fin, c.piecesComptables)).toBe(10);
    expect(FR()).toMatch(/fin de notre collaboration/);
    expect(FR()).toMatch(/le contrat et les preuves de vigilance[^;]*cinq ans/);
    expect(FR()).toMatch(/les factures et les pièces comptables, dix ans/);
    // 🔴 L16b-1 disait le contrat conservé dix ans : le code dit cinq.
    expect(FR()).not.toMatch(/contrat[^.;]*dix ans/);
    // La candidature, elle, EST purgée à 2 ans (retention-purge-worker) : la notice le dit.
    expect(FR()).toMatch(/candidature[^.]*effacée automatiquement deux ans/);
    expect(FR()).toMatch(/Hors candidature, vos données ne sont pas supprimées automatiquement/);
  });

  it("dit « données personnelles » même en entreprise individuelle (G4)", () => {
    expect(FR()).toMatch(/données personnelles/);
    expect(FR()).toMatch(/entreprise individuelle/);
  });

  it("cite Calendly et la messagerie qui reçoit les réponses, comme les sections voisines", () => {
    expect(FR()).toMatch(/Calendly/);
    expect(FR()).toMatch(/Zoho Mail/);
  });

  it("aucun mot du contrat de travail ni du mandat d'agence", () => {
    const interdits =
      /\b(poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial|Grenoble)\b/i;
    expect(FR()).not.toMatch(interdits);
    expect(section("fr")?.title ?? "").not.toMatch(interdits);
  });
});
