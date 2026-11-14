// ORIGINES_SUIVANTES_DEPUIS : posable par `coolify-drapeau.yml` (liste fermée, date UTC non antérieure,
// « les-deux »), documentée ; `coolify-lire-drapeaux.yml` est en lecture seule et n'affiche pas le corps brut.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const doc = readFileSync("docs/guides-reseau-interrupteurs.md", "utf8");
const poser = readFileSync(".github/workflows/coolify-drapeau.yml", "utf8");
const lire = readFileSync(".github/workflows/coolify-lire-drapeaux.yml", "utf8");

describe("ORIGINES_SUIVANTES_DEPUIS posable par le workflow", () => {
  it("est dans la liste fermée", () => {
    expect(poser).toMatch(/^\s+- "ORIGINES_SUIVANTES_DEPUIS"/m);
  });
  it("exige les-deux, une date UTC et refuse le passé", () => {
    expect(poser).toMatch(/CLE" = "ORIGINES_SUIVANTES_DEPUIS" \] && \[ "\$CIBLE" != "les-deux"/);
    expect(poser).toMatch(/ORIGINES_SUIVANTES_DEPUIS" \]; then\s+\[\[ "\$VALEUR" =~ [^\n]*Z\$/);
    expect(poser).toMatch(/-lt "\$\(date -u \+%s\)"/);
  });
  it("est documentée avec les deux workflows, sans docker exec", () => {
    expect(doc).toContain("coolify-drapeau.yml");
    expect(doc).toContain("coolify-lire-drapeaux.yml");
    expect(doc).not.toContain("docker exec -e ORIGINES_SUIVANTES_DEPUIS");
  });
});

describe("coolify-lire-drapeaux.yml : lecture seule", () => {
  it("n'a aucune méthode d'écriture", () => {
    expect(lire).not.toMatch(/\b(PATCH|POST|PUT|DELETE)\b/);
    expect(lire).not.toMatch(/curl[^\n]*(-X|--request)\b/);
  });
  it("permissions minimales", () => {
    expect(lire).toMatch(/permissions:\s+contents: read/);
  });
  it("filtre par jq et n'affiche pas le corps brut", () => {
    expect(lire).toContain("jq -r --argjson cles");
    expect(lire).not.toMatch(/echo "\$reponse"|cat \/tmp|head -c/);
    expect(lire).not.toMatch(/\| jq -r '?\.?\[?\]?'?\s*$/m);
  });
  it("n'affiche la date que si elle a la forme attendue", () => {
    expect(lire).toMatch(/ORIGINES_SUIVANTES_DEPUIS" and [^\n]*\(\$v \| test\(/);
  });
  it("liste fermée des drapeaux", () => {
    for (const k of [
      "CRM_SYNC_ENABLED",
      "CRM_SYNC_GUIDE_ENABLED",
      "SYNCHRO_CRM_V3",
      "SYNCHRO_CRM_V3_ORIGINES_SUIVANTES",
      "SYNCHRO_CRM_V3_NEWSLETTER_OPTIN",
      "ORIGINES_SUIVANTES_DEPUIS",
    ])
      expect(lire).toContain(`"${k}"`);
  });
});

describe("ORIGINES_SUIVANTES_DEPUIS : borne haute, pas de redéploiement, lecture filtrée", () => {
  it("refuse une date au-delà de +366 jours", () => {
    expect(poser).toMatch(/-gt "\$\(\( \$\(date -u \+%s\) \+ 366 \* 86400 \)\)"/);
  });
  it("n'exécute aucun deploy pour cette clé", () => {
    const etape = poser.slice(poser.indexOf("Redéployer (POST"));
    expect(etape).toMatch(/CLE: \$\{\{ inputs\.cle \}\}/);
    const garde = etape.indexOf('"$CLE" = "ORIGINES_SUIVANTES_DEPUIS"');
    expect(garde).toBeGreaterThan(-1);
    expect(garde).toBeLessThan(etape.indexOf("deploy()"));
    expect(etape).toContain("pris en compte au prochain redéploiement");
    expect(etape.slice(garde, etape.indexOf("deploy()"))).toContain("exit 0");
  });
  it("n'affiche la date en clair que si elle a la forme attendue", () => {
    expect(lire).toMatch(
      /\$k == "ORIGINES_SUIVANTES_DEPUIS" and [^\n]*test\("\\\\A20\[0-9\]\{2\}-\[0-9\]\{2\}-\[0-9\]\{2\}T\[0-9\]\{2\}:\[0-9\]\{2\}:\[0-9\]\{2\}Z\\\\z"\)/,
    );
    expect(lire).not.toMatch(/elif \$k == "ORIGINES_SUIVANTES_DEPUIS" then/);
  });
});
