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
import { SEUIL_FIABILITE } from "@/server/qualiopi/indicateurs/calcul";
import { masquerIbanFormateur } from "@/lib/rgpd-formateur-independant";

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

  it("dit le lien personnel : sa durée lue dans le code, et QUI le révoque vraiment", () => {
    expect(DUREE_LIEN_DOSSIER_JOURS).toBe(30);
    expect(FR()).toMatch(new RegExp(`lien personnel, valable ${DUREE_LIEN_DOSSIER_JOURS} jours`));
    expect(FR()).toMatch(
      /quand l'équipe vous renvoie un nouveau lien, ou quand vous envoyez votre dossier, les liens précédents cessent de fonctionner/,
    );
    expect(EN()).toMatch(
      /when the team sends you a new link, or when you send your file, the previous links stop working/,
    );
    // 🔴 Faux : les relances et « Retrouver mon lien » renvoient le lien COURANT, sans rien annuler.
    expect(FR()).not.toMatch(/chaque nouveau lien[^.;]*annule/);
    expect(EN()).not.toMatch(/each new link[^.;]*cancels/);

    // Le code : le renvoi par l'équipe et l'envoi du dossier incrémentent la version
    // d'accès ; la relance et « Retrouver mon lien » ne la touchent pas.
    const envois = lire(
      "src",
      "server",
      "qualiopi",
      "formateurs-independants",
      "envois-dossier.ts",
    );
    const renvoi = envois.slice(envois.indexOf("export async function renvoyerLienDossier"));
    expect(renvoi.slice(0, renvoi.indexOf("\n}\n"))).toMatch(/nouvelleVersion\(/);
    const nv = envois.slice(envois.indexOf("async function nouvelleVersion"));
    expect(nv.slice(0, nv.indexOf("\n}\n"))).toMatch(/accesVersion: \{ increment: 1 \}/);
    const dossier = lire("src", "server", "qualiopi", "formateurs-independants", "dossier.ts");
    const envoi = dossier.slice(dossier.indexOf("export async function envoyerDossier"));
    expect(envoi.slice(0, envoi.indexOf("\n}\n"))).toMatch(/accesVersion: \{ increment: 1 \}/);
    for (const sansRevocation of [
      ["src", "server", "qualiopi", "formateurs-independants", "relance-dossier.ts"],
      ["src", "app", "formateur", "dossier", "retrouver", "actions.ts"],
    ]) {
      expect(lire(...sansRevocation), sansRevocation.join("/")).not.toMatch(/increment/);
    }
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
    expect(SEUIL_FIABILITE).toBe(5);
    expect(FR()).toMatch(/trois dernières années/);
    expect(FR()).toMatch(/satisfaction donnée par les stagiaires/);
    expect(FR()).toMatch(/centre de votre commune d'exercice \(jamais votre adresse\)/);
    expect(FR()).toMatch(/à partir de cinq avis/);
    expect(FR()).toMatch(/jamais publiée ni montrée aux formateurs/);
  });

  it("dit l'export art. 15 et l'effacement art. 17 tels que le module les fait", () => {
    // IBAN : quatre premiers et quatre derniers caractères, lus dans le code.
    expect(masquerIbanFormateur("FR7612345678901234567890189")).toBe("FR76 •••• •••• 0189");
    expect(FR()).toMatch(
      /IBAN masqué \(seuls ses quatre premiers et ses quatre derniers caractères apparaissent\)/,
    );
    expect(EN()).toMatch(/IBAN masked \(only its first four and last four characters appear\)/);
    expect(FR()).toMatch(/liste de vos pièces, sans leur contenu/);
    expect(EN()).toMatch(/list of your documents, without their content/);
    // Export et effacement ne valent que derrière `formateurs.dossier_en_ligne` : la
    // notice les rattache aux données du dossier en ligne.
    const source = lire("src", "lib", "rgpd-formateur-independant.ts");
    expect(source).toMatch(/if \(!\(await droitsFormateurActifs\(\)\)\) return null;/);
    expect(source).toMatch(/if \(etat !== "actif"\) return \{ formateur: etat/);
    expect(FR()).toMatch(/la copie des données de votre dossier en ligne montre votre IBAN masqué/);
    expect(FR()).toMatch(/demande d'effacement des données de votre dossier en ligne/);
    expect(EN()).toMatch(/copy of your online file data/);
    expect(EN()).toMatch(/request to erase your online file data/);
    expect(FR()).toMatch(/pseudonymisation/);
    // Sans lien contractuel, IBAN et numéros de l'entreprise sont effacés.
    for (const champ of ["iban", "siret", "numeroTvaIntracom", "sousTraitantNda"]) {
      expect(source).toMatch(new RegExp(`\\b${champ}: null`));
    }
    expect(FR()).toMatch(/votre IBAN et les numéros de votre entreprise sont effacés/);
    expect(EN()).toMatch(/your IBAN and your company numbers are erased/);
    expect(FR()).toMatch(/pièces que la loi impose de conserver restent intactes/);
  });

  it("nomme chaque pièce que le module garde intacte (PIECES_LEGALES), en FR et en EN", () => {
    const source = lire("src", "lib", "rgpd-formateur-independant.ts");
    const types = (nom: string) => {
      const m = source.match(
        new RegExp(`const ${nom}: ReadonlySet<string> = new Set\\(\\[([^\\]]*)\\]`),
      );
      expect(m, nom).not.toBeNull();
      return [...m![1]!.matchAll(/"([a-z_]+)"/g)].map((x) => x[1]!);
    };
    // Pièces sans objet pour un indépendant (contrat de travail, déclaration d'embauche).
    const horsSujet = new Set(["contrat_travail", "dpae"]);
    const mots: Record<string, readonly [RegExp, RegExp]> = {
      contrat_sous_traitance: [/contrats/, /agreements/],
      attestation_vigilance_urssaf: [/preuves de vigilance/, /due-diligence proofs/],
      kbis_avis_sirene: [
        /extrait Kbis ou avis de situation Sirene/,
        /Kbis extract or Sirene status notice/,
      ],
      nda_sous_traitant: [
        /justificatif de votre numéro de déclaration d'activité/,
        /proof of your training declaration number/,
      ],
      recepisse_declaration_activite: [/récépissé de déclaration/, /declaration receipt/],
      attestation_qualiopi: [/attestation Qualiopi/, /Qualiopi certificate/],
      assurance_rc_pro: [/attestation d'assurance/, /insurance certificate/],
      diplome: [/justificatifs de compétences/, /proofs of skills/],
      certification: [/justificatifs de compétences/, /proofs of skills/],
      rib: [/RIB/, /bank details/],
    };
    const fr = FR().slice(FR().indexOf("Les pièces que la loi impose de conserver"));
    const en = EN().slice(EN().indexOf("Documents the law requires us to keep"));
    for (const t of [...types("PIECES_LEGALES"), ...types("PIECES_LEGALES_SI_LIEN")]) {
      if (horsSujet.has(t)) continue;
      expect(mots[t], `type ${t} non décrit par la notice`).toBeDefined();
      expect(fr, t).toMatch(mots[t]![0]);
      expect(en, t).toMatch(mots[t]![1]);
    }
  });

  it("le miroir anglais dit vrai sur les statistiques internes", () => {
    expect(EN()).toMatch(/centre of your town of practice \(never your address\)/);
    expect(EN()).toMatch(/last three years/);
    expect(EN()).toMatch(/from five reviews/);
    expect(EN()).toMatch(/never published nor shown to trainers/);
    expect(EN()).toMatch(/satisfaction score given by the trainees/);
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
