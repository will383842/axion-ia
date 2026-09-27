// La COPIE des e-mails envoyés est RESTITUÉE à l'export (art. 15) — 2026-09-27.
//
// Depuis que le worker garde l'objet et le texte de chaque e-mail parti
// (`email_log_contents`, 12 mois), cette copie est une donnée de la personne.
// Conservée et non exportée, ce serait le défaut `D5-5-02` recommencé. Ce
// test exige les DEUX moitiés, comme `le-point-apres-l-appel-est-exporte` :
// lue en base, ET rendue telle quelle.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/app/api/gdpr-export/route.ts"), "utf8");

describe("export RGPD — la copie des e-mails envoyés", () => {
  it("est lue avec la ligne du journal : objet, texte, noms des pièces jointes", () => {
    const lecture = source.slice(
      source.indexOf("prisma.emailLog.findMany("),
      source.indexOf("prisma.emailOutbox.findMany("),
    );
    expect(lecture).toMatch(
      /contenu:\s*\{\s*select:\s*\{\s*subject:\s*true,\s*text:\s*true,\s*attachmentNames:\s*true/,
    );
  });

  it("est rendue sans tri de champs (la liste lue part telle quelle dans l'export)", () => {
    expect(source).toMatch(/^\s*emailsEnvoyes,\s*$/m);
  });
});
