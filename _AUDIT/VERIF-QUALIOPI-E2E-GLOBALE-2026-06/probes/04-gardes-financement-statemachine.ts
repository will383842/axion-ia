/**
 * PROBE 04 — Gardes financement (validation-service) + machine à états (RUNTIME, S5/S10).
 * Fonctions PURES (pas d'auth, pas de DB) : on force chaque violation et on prouve
 * le blocage (gravite critique) ou le throw de transition interdite.
 */
import {
  validateOpcoAccord,
  validateOpcoConventionTripartite,
  validateCpfEdof,
  validateFranceTravail,
  validateCpfEligibilite,
} from "@/server/qualiopi/financements/validation-service";
import {
  assertSessionTransition,
  SESSION_TRANSITIONS,
} from "@/server/qualiopi/formations/state-machine";

function show(
  label: string,
  r: { ok: boolean; gravite?: string; message?: string; alerte?: string },
) {
  console.log(
    `${r.ok ? "OK✅" : "BLOQUE🔴"} [${label}] ok=${r.ok} gravite=${r.gravite ?? "-"} ${r.ok ? "" : "→ " + (r.alerte ?? r.message ?? "")}`,
  );
}

function main() {
  console.log("=== GARDES FINANCEMENT (violation forcée → doit bloquer en 'critique') ===");

  // OPCO subrogation sans n° dossier (planifiee)
  show(
    "OPCO accord (subrogation, planifiee, sans n° dossier)",
    validateOpcoAccord({
      financementType: "opco",
      statut: "planifiee",
      opcoSubrogation: true,
      numeroDossierOpco: null,
    } as never),
  );

  // OPCO tripartite manquante (subrogation, planifiee)
  show(
    "OPCO tripartite (subrogation, planifiee, conventionTripartiteSigneeAt null)",
    validateOpcoConventionTripartite({
      financementType: "opco",
      statut: "planifiee",
      opcoSubrogation: true,
      conventionTripartiteSigneeAt: null,
    } as never),
  );

  // CPF sans EDOF (planifiee) — validateCpfEdof(session, formation)
  show(
    "CPF EDOF (planifiee, edofVerifieAt null des deux côtés)",
    validateCpfEdof(
      { financementType: "cpf", statut: "planifiee", edofVerifieAt: null } as never,
      { edofVerifieAt: null } as never,
    ),
  );

  // France Travail POEI sans les 3 preuves (planifiee)
  show(
    "FT POEI (planifiee, 3 preuves nulles)",
    validateFranceTravail({
      financementType: "france_travail",
      statut: "planifiee",
      ftDispositif: "poei",
      ftPoeiOffreEmploiNumero: null,
      ftPoeiAccordFinancementAt: null,
      ftPoeiEngagementSigneAt: null,
    } as never),
  );

  console.log("\n=== MACHINE À ÉTATS SESSION : transitions autorisées + interdites ===");
  console.log("Whitelist:", JSON.stringify(SESSION_TRANSITIONS));
  const interdites: Array<[string, string]> = [
    ["planifiee", "realisee"], // saut interdit (doit passer par en_cours)
    ["realisee", "en_cours"], // terminal → rien
    ["annulee", "en_cours"], // terminal
    ["en_cours", "planifiee"], // marche arrière interdite
    ["reportee", "realisee"], // terminal
  ];
  for (const [from, to] of interdites) {
    let threw = false;
    try {
      assertSessionTransition(from as never, to as never);
    } catch {
      threw = true;
    }
    console.log(`${threw ? "REFUSÉ✅" : "ACCEPTÉ🔴"} interdite ${from}→${to}`);
  }
  const autorisees: Array<[string, string]> = [
    ["planifiee", "en_cours"],
    ["en_cours", "realisee"],
    ["planifiee", "annulee"],
    ["en_cours", "annulee"],
    ["planifiee", "reportee"],
  ];
  for (const [from, to] of autorisees) {
    let ok = true;
    try {
      assertSessionTransition(from as never, to as never);
    } catch {
      ok = false;
    }
    console.log(`${ok ? "ACCEPTÉ✅" : "REFUSÉ🔴"} autorisée ${from}→${to}`);
  }
}

main();
