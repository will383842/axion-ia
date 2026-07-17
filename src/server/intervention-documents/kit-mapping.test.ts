import { describe, it, expect } from "vitest";
import {
  classifyEntry,
  resolveSlug,
  resolveSlugs,
  slugifyFolder,
  buildKitR2Key,
  FILE_TO_SLOT,
  UN_A_UN_FOLDER_TO_SLUGS,
  DIAPORAMA_SLOT_KEY,
  resolveAxionSlug,
  isKnownTopFolder,
} from "./kit-mapping";
import { getSlot, getInterventionBySlug } from "@/content/intervention-documents-catalog";

describe("kit-mapping — formation", () => {
  it("classe un livret PDF → slug + slot + pdf", () => {
    const c = classifyEntry("Formation_IA_Express/Documents_PDF/01_Livret_Apprenant.pdf");
    expect(c).toMatchObject({
      slugs: ["ia-express"],
      slot: "livret_apprenant",
      kind: "pdf",
      ext: "pdf",
    });
  });

  it("classe un livret DOCX → source", () => {
    const c = classifyEntry("Formation_IA_Express/Documents_DOCX/01_Livret_Apprenant.docx");
    expect(c).toMatchObject({ slot: "livret_apprenant", kind: "source", ext: "docx" });
  });

  it("mappe les préfixes vers les clés de slot du catalogue", () => {
    expect(FILE_TO_SLOT["01"]).toBe("livret_apprenant");
    expect(FILE_TO_SLOT["06"]).toBe("programme");
    expect(FILE_TO_SLOT["07"]).toBe("scenario_pedagogique");
    // 08/09/10 absents (générés par la plateforme).
    expect(FILE_TO_SLOT["08"]).toBeUndefined();
  });

  it("ignore les slots générés par la plateforme (08/09/10)", () => {
    expect(classifyEntry("IA_Securite/Documents_PDF/08_Test_Positionnement.pdf")).toBeNull();
    expect(classifyEntry("IA_Securite/Documents_PDF/09_Evaluation_Satisfaction.pdf")).toBeNull();
    expect(classifyEntry("IA_Securite/Documents_PDF/10_Attestation_Emargement.pdf")).toBeNull();
  });

  it("classe le diaporama (.pptx source + slides .pdf)", () => {
    expect(classifyEntry("Art_du_Prompt/00_Presentation/Formation.pptx")).toMatchObject({
      slot: "diaporama",
      kind: "source",
      ext: "pptx",
    });
    expect(classifyEntry("Art_du_Prompt/00_Presentation/Formation_SLIDES.pdf")).toMatchObject({
      slot: "diaporama",
      kind: "pdf",
    });
  });

  it("résout les 7 slugs connus", () => {
    expect(resolveSlug("Formation_IA_Express")).toBe("ia-express");
    expect(resolveSlug("IA_Commercial")).toBe("ia-commercial");
    expect(resolveSlug("IA_Bureau_Rapide")).toBe("ia-au-bureau");
  });

  it("slugifie en fallback un dossier inconnu (tolérance d'évolution)", () => {
    expect(slugifyFolder("Formation_Nouvelle_Formation")).toBe("nouvelle-formation");
    expect(resolveSlug("IA_Toute_Nouvelle")).toBe("ia-toute-nouvelle");
  });

  it("construit la clé R2 canonique", () => {
    expect(buildKitR2Key("ia-express", "livret_apprenant", 2, "source", "docx")).toBe(
      "interventions/ia-express/livret_apprenant/v2/source.docx",
    );
  });

  // Verrou de cohérence : chaque slot du kit DOIT exister dans le catalogue
  // (SSOT) et ne pas être generatedOnly — sinon l'import écrirait une visibilité
  // / catégorie incohérente avec l'UI manuelle.
  it("chaque slot importé existe dans le catalogue formation (non généré)", () => {
    const slots = [...Object.values(FILE_TO_SLOT), DIAPORAMA_SLOT_KEY];
    for (const slotKey of slots) {
      const def = getSlot("formation", slotKey);
      expect(def, `slot ${slotKey} absent du catalogue`).toBeDefined();
      expect(def?.generatedOnly ?? false, `slot ${slotKey} est generatedOnly`).toBe(false);
    }
  });

  it("ignore les chemins non pertinents", () => {
    expect(classifyEntry("Formation_IA_Express/README.txt")).toBeNull();
    expect(classifyEntry("Formation_IA_Express/Documents_PDF/06_Programme.txt")).toBeNull();
  });
});

describe("kit-mapping — 1-to-1 (un_a_un, kits AXION 16/17)", () => {
  // Chemins RÉELS du catalogue AXION livré le 2026-07-17.
  it("classe le kit 16 (dirigeant) vers les bons slots", () => {
    const f = "16_Coaching_Vision_IA_Strategique_dirigeant";
    const slug = "dirigeant-vision-strategique";
    const cases: ReadonlyArray<[string, string, "source" | "pdf"]> = [
      [`${f}/00_Cadre/01_Vision_IA_Strategique_dirigeant_1j.docx`, "programme", "source"],
      [`${f}/00_Cadre/Methode_AXION.docx`, "ressources", "source"],
      [
        `${f}/01_Support_de_la_journee/Axion-IA_Support_Vision_IA_Strategique.pptx`,
        "support_journee",
        "source",
      ],
      [
        `${f}/02_Guide_intervenant/Axion-IA_Guide_intervenant_Vision_IA_Strategique.docx`,
        "guide_intervenant",
        "source",
      ],
      [
        `${f}/03_Livrable_client/Axion-IA_Modele_Note_de_cadrage_strategique.docx`,
        "livrable_client",
        "source",
      ],
    ];
    for (const [path, slot, kind] of cases) {
      expect(classifyEntry(path, "un_a_un"), path).toMatchObject({ slugs: [slug], slot, kind });
    }
  });

  it("classe le kit 17 (collaborateur) vers les bons slots", () => {
    const f = "17_Coaching_Decouverte_collaborateur";
    const slug = "coaching-decouverte";
    const cases: ReadonlyArray<[string, string]> = [
      [`${f}/00_Cadre/02_Coaching_Decouverte_collaborateur_1j.docx`, "programme"],
      [
        `${f}/01_Support_de_la_journee/Axion-IA_Support_Coaching_Decouverte.pptx`,
        "support_journee",
      ],
      [`${f}/02_Guide_coach/Axion-IA_Guide_coach_Decouverte.docx`, "guide_intervenant"],
      [`${f}/03_Livrable_client/Axion-IA_Memo_AXION.docx`, "memo_methode"],
      [
        `${f}/03_Livrable_client/Axion-IA_Modele_Cahier_de_prompts_et_plan_action.docx`,
        "livrable_client",
      ],
    ];
    for (const [path, slot] of cases) {
      expect(classifyEntry(path, "un_a_un"), path).toMatchObject({ slugs: [slug], slot });
    }
  });

  it("le support .pptx du 1-to-1 a un slot qui accepte le pptx", () => {
    const slot = getSlot("un_a_un", "support_journee");
    expect(slot).toBeTruthy();
    expect(slot!.formats).toContain("pptx");
  });

  it("résout les dossiers 16/17 par NUMÉRO (1 slug 1 jour, jamais les 2j retirés)", () => {
    expect(resolveSlugs("16_Coaching_Vision_IA_Strategique_dirigeant", "un_a_un")).toEqual([
      "dirigeant-vision-strategique",
    ]);
    expect(resolveSlugs("17_Coaching_Decouverte_collaborateur", "un_a_un")).toEqual([
      "coaching-decouverte",
    ]);
    // Tolérance au renommage : seul le numéro compte.
    expect(resolveSlugs("16_Peu_importe", "un_a_un")).toEqual(["dirigeant-vision-strategique"]);
    expect(resolveSlugs("Formation_IA_Express", "formation")).toEqual(["ia-express"]);
    expect(resolveSlugs("Quoi", "audit")).toEqual([]);
  });

  it("l'ancien kit AFEST (Dirigeant/Documents_DOCX/NN_) n'est PLUS importable", () => {
    // Doctrine abandonnée (kits 16/17 = conseil, « aucune attestation ») : ses
    // slots n'existent plus au catalogue, l'import doit ignorer ces fichiers.
    expect(
      classifyEntry("Dirigeant/Documents_DOCX/04_Guide_Coach_Deroule_AFEST.docx", "un_a_un"),
    ).toBeNull();
    expect(
      classifyEntry("Collaborateur/Documents_DOCX/01_Cadrage_Convention_AFEST.docx", "un_a_un"),
    ).toBeNull();
  });

  it("ignore les placeholders PDF en .html (Documents_PDF non-.pdf)", () => {
    expect(
      classifyEntry("Dirigeant/Documents_PDF/04_Guide_Coach_Deroule_AFEST.html", "un_a_un"),
    ).toBeNull();
  });

  it("ignore les dossiers annexes du kit (_apercu_html, _build…)", () => {
    expect(classifyEntry("Autre/Documents_DOCX/01_Cadrage.docx", "un_a_un")).toBeNull();
    // un dossier de FORMATION passé en un_a_un n'est pas mal classé
    expect(
      classifyEntry("Formation_IA_Express/Documents_DOCX/01_Livret.docx", "un_a_un"),
    ).toBeNull();
  });

  it("ne traite pas 00_Presentation en un_a_un (diaporama = formation seulement)", () => {
    expect(classifyEntry("Dirigeant/00_Presentation/Slides.pptx", "un_a_un")).toBeNull();
  });

  // Verrou de cohérence SSOT : les slots ciblés par les kits 16/17 existent tous
  // au catalogue un_a_un, aucun n'est généré par le Formation Engine, et aucun
  // n'est marqué Qualiopi (les kits sont du CONSEIL — « aucune attestation »).
  it("chaque slot importé existe au catalogue un_a_un et n'est PAS Qualiopi-généré", () => {
    const slots = [
      "programme",
      "support_journee",
      "guide_intervenant",
      "livrable_client",
      "memo_methode",
      "ressources",
    ];
    for (const slotKey of slots) {
      const def = getSlot("un_a_un", slotKey);
      expect(def, `slot ${slotKey} absent du catalogue un_a_un`).toBeDefined();
      expect(def?.generatedOnly ?? false, `slot ${slotKey} est generatedOnly`).toBe(false);
      expect(
        def?.qualiopiDocType,
        `slot ${slotKey} est Qualiopi-généré → interdit pour du conseil`,
      ).toBeUndefined();
    }
  });

  // Verrou anti-fantôme : un slug de destination erroné rangerait les documents
  // sur une prestation inexistante (invisible en console).
  it("les slugs destinataires sont de vraies interventions de la famille un_a_un", () => {
    const slugs = Object.values(UN_A_UN_FOLDER_TO_SLUGS).flatMap((s) => [...s]);
    expect(slugs).toEqual(["dirigeant-vision-strategique", "coaching-decouverte"]);
    for (const slug of slugs) {
      const intervention = getInterventionBySlug(slug);
      expect(intervention, `slug ${slug} introuvable au catalogue`).toBeDefined();
      expect(intervention?.famille, `slug ${slug} hors famille un_a_un`).toBe("un_a_un");
    }
  });

  // Les 2 jours ont été RETIRÉS de la vente (2026-07-17, aucun kit) : le hub ne
  // doit plus les lister — sinon des slots vides et une promesse sans documents.
  it("le hub un_a_un ne liste plus les variantes 2 jours retirées", () => {
    expect(getInterventionBySlug("dirigeant-vision-strategique-2j")).toBeUndefined();
    expect(getInterventionBySlug("coaching-optimisation-2j")).toBeUndefined();
    expect(getInterventionBySlug("un-a-un-recurrent")).toBeDefined();
  });
});

// ============================ KIT AXION 2026 =================================
// Cas réels du catalogue livré le 2026-07-17 (`AXION-IA_Catalogue_complet`).
// Le format legacy (Documents_DOCX/NN_) reste couvert par les tests ci-dessus :
// les deux arborescences doivent coexister.

describe("kit-mapping — kit AXION 2026 (arborescence par type)", () => {
  it("résout le dossier vers le slug V2 via le NUMÉRO du catalogue", () => {
    expect(resolveAxionSlug("01_Formation_Bien_demarrer_avec_lIA_4h")).toBe(
      "bien-demarrer-avec-l-ia-4h",
    );
    expect(resolveAxionSlug("07_Formation_Claude_Code_Creer_un_projet_3j")).toBe(
      "claude-code-creer-un-projet-3j",
    );
    expect(resolveAxionSlug("15_Seminaire_IA_Toute_lentreprise_50pers")).toBe(
      "seminaire-ia-toute-l-entreprise-1j",
    );
  });

  it("résout les 15 dossiers du catalogue réel vers un slug EXISTANT", () => {
    // Le lien est le numéro : chaque dossier 01→15 doit tomber sur une formation.
    for (let n = 1; n <= 15; n++) {
      const folder = `${String(n).padStart(2, "0")}_Formation_Peu_importe_le_nom`;
      const slug = resolveAxionSlug(folder);
      expect(slug, `dossier ${folder}`).toBeTruthy();
      expect(getInterventionBySlug(slug!), `slug ${slug} absent du hub`).toBeTruthy();
    }
  });

  it("ne résout pas un dossier hors catalogue", () => {
    expect(resolveAxionSlug("16_Coaching_Vision_IA_Strategique_dirigeant")).toBeNull();
    expect(resolveAxionSlug("Formation_IA_Express")).toBeNull();
  });

  it("classe les documents d'une formation réelle vers les bons slots", () => {
    const f = "04_Formation_Gagner_du_temps_au_quotidien_7h";
    const slug = "gagner-du-temps-au-quotidien-avec-l-ia-7h";
    const cases: ReadonlyArray<[string, string, "source" | "pdf"]> = [
      [`${f}/00_Programme/04_Gagner_du_temps_au_quotidien_7h.docx`, "programme", "source"],
      [`${f}/00_Programme/Methode_AXION.docx`, "ressources", "source"],
      [
        `${f}/01_Support_de_presentation/Axion-IA_Support_04_Gagner_du_temps_au_quotidien_7h.pptx`,
        "diaporama",
        "source",
      ],
      [`${f}/02_Documents_formateur/Axion-IA_Guide_formateur_04.docx`, "guide_animation", "source"],
      [
        `${f}/02_Documents_formateur/Axion-IA_Conducteur_de_session_04.docx`,
        "scenario_pedagogique",
        "source",
      ],
      [`${f}/02_Documents_formateur/Axion-IA_Exercices_et_corriges_04.docx`, "corriges", "source"],
      [
        `${f}/03_Documents_stagiaire/Axion-IA_Livret_stagiaire_04_Gagner_du_temps_au_quotidien.docx`,
        "livret_apprenant",
        "source",
      ],
      [`${f}/03_Documents_stagiaire/Axion-IA_Memo_AXION.docx`, "memo_methode", "source"],
    ];
    for (const [path, slot, kind] of cases) {
      expect(classifyEntry(path), path).toMatchObject({ slugs: [slug], slot, kind });
    }
  });

  it("classe le carnet participant du séminaire comme un livret", () => {
    expect(
      classifyEntry(
        "15_Seminaire_IA_Toute_lentreprise_50pers/03_Documents_participant/Axion-IA_Carnet_participant_Seminaire.docx",
      ),
    ).toMatchObject({ slugs: ["seminaire-ia-toute-l-entreprise-1j"], slot: "livret_apprenant" });
  });

  it("les corrigés ne partent JAMAIS vers un slot exposé au stagiaire", () => {
    const c = classifyEntry(
      "01_Formation_Bien_demarrer_avec_lIA_4h/02_Documents_formateur/Axion-IA_Exercices_et_corriges_01.docx",
    );
    expect(c?.slot).toBe("corriges");
    expect(getSlot("formation", c!.slot)?.visibilite).toBe("formateur");
  });

  it("ignore la grille d'évaluation (générée par le Formation Engine)", () => {
    expect(
      classifyEntry(
        "01_Formation_Bien_demarrer_avec_lIA_4h/02_Documents_formateur/Axion-IA_Grille_evaluation_01.docx",
      ),
    ).toBeNull();
  });

  it("ignore le LISEZ-MOI et les fichiers non pertinents", () => {
    expect(classifyEntry("01_Formation_Bien_demarrer_avec_lIA_4h/LISEZ-MOI.md")).toBeNull();
    expect(
      classifyEntry("01_Formation_Bien_demarrer_avec_lIA_4h/00_Programme/notes.txt"),
    ).toBeNull();
  });

  it("tous les slots visés existent dans le catalogue du hub", () => {
    const slots = [
      "programme",
      "ressources",
      "diaporama",
      "guide_animation",
      "scenario_pedagogique",
      "corriges",
      "livret_apprenant",
      "memo_methode",
    ];
    for (const s of slots) {
      expect(getSlot("formation", s), `slot ${s}`).toBeTruthy();
    }
  });

  it("un dossier AXION est reconnu (pas signalé « non mappé »)", () => {
    expect(isKnownTopFolder("01_Formation_Bien_demarrer_avec_lIA_4h", "formation")).toBe(true);
    expect(isKnownTopFolder("Formation_IA_Express", "formation")).toBe(true); // legacy
    expect(isKnownTopFolder("Dossier_Inconnu", "formation")).toBe(false);
  });
});

describe("kit-mapping — livrables partagés (kit AXION)", () => {
  const F = "04_Formation_Gagner_du_temps_au_quotidien_7h/03_Documents_stagiaire";
  it("classe les 4 livrables universels vers leurs slots", () => {
    const cases: ReadonlyArray<[string, string]> = [
      [`${F}/Axion-IA_Charte_IA_et_guide_securite.docx`, "charte_ia"],
      [`${F}/Axion-IA_Bibliotheque_prompts_AXION.docx`, "bibliotheque_prompts"],
      [`${F}/Axion-IA_Kits_assistants_IA.docx`, "kits_assistants"],
      [`${F}/Axion-IA_Guide_cas_usage_et_roadmap.docx`, "guide_cas_usage"],
    ];
    for (const [path, slot] of cases) {
      expect(classifyEntry(path), path).toMatchObject({
        slugs: ["gagner-du-temps-au-quotidien-avec-l-ia-7h"],
        slot,
      });
    }
  });

  it("la bibliothèque MARKETING (formation 12) prime sur la générale", () => {
    expect(
      classifyEntry(
        "12_Formation_IA_Marketing_Contenus_SEO_7h/03_Documents_stagiaire/Axion-IA_Bibliotheque_prompts_marketing.docx",
      ),
    ).toMatchObject({
      slugs: ["ia-marketing-contenus-seo-image-de-marque-7h"],
      slot: "bibliotheque_prompts",
    });
  });

  it("classe les livrables spécialisés (Skills 05, connecteurs 13, diagnostic 08)", () => {
    expect(
      classifyEntry(
        "05_Formation_Claude_Prise_en_main_complete_7h/03_Documents_stagiaire/Axion-IA_Pack_Skills_Claude.docx",
      ),
    ).toMatchObject({ slot: "pack_skills" });
    expect(
      classifyEntry(
        "13_Formation_IA_Vente_Prospection_7h/03_Documents_stagiaire/Axion-IA_Guide_des_connecteurs.docx",
      ),
    ).toMatchObject({ slot: "guide_connecteurs" });
    expect(
      classifyEntry(
        "08_Formation_IA_Act_Conformite_et_securite_7h/03_Documents_stagiaire/Axion-IA_Diagnostic_conformite_AI_Act.docx",
      ),
    ).toMatchObject({ slot: "diagnostic_ai_act" });
  });

  it("les 3 nouveaux slots existent au catalogue et acceptent le docx", () => {
    for (const key of ["pack_skills", "guide_connecteurs", "diagnostic_ai_act"]) {
      const def = getSlot("formation", key);
      expect(def, key).toBeTruthy();
      expect(def!.formats).toContain("docx");
      expect(def!.generatedOnly ?? false).toBe(false);
    }
  });
});
