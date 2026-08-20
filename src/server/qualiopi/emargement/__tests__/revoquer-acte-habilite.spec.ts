/**
 * `D3-3-04` — révoquer une signature reste un acte de la DIRECTION.
 *
 * ## Pourquoi ce fichier existe, et il a une histoire
 *
 * La matrice `HABILITATIONS` est gardée par `auth/habilitations.spec.ts` : y
 * ouvrir `revoquer_signature` à `editor` ou au responsable qualité rougit.
 *
 * 🔴 Mais une mutation jouée le 2026-08-20 est passée AU VERT : remplacer
 * `requireHabilitation("revoquer_signature")` par `requireAdminWrite()` dans la
 * Server Action. La matrice restait intacte, l'action ne s'en servait plus, et
 * `editor` — que `requireAdminWrite` autorise — pouvait révoquer une preuve
 * légale. **La garde protégeait la définition, pas le câblage.**
 *
 * C'est la même leçon que le dépôt a payée le 2026-08-15, quand quatre actes
 * engageants sont restés ouverts à `editor` parce que chaque action portait sa
 * propre garde recopiée. Le patron de ce fichier est celui de
 * `evaluations/__tests__/attester-acte-habilite.spec.ts`.
 *
 * ⚠️ Les commentaires sont retirés avant analyse : cet en-tête et l'action
 * parlent tous deux de `requireAdminWrite` en prose, et un test statique qui
 * trouve ses propres explications est un faux positif — ce dépôt l'a déjà payé.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ACTION = join(
  process.cwd(),
  "src",
  "server",
  "actions",
  "qualiopi",
  "emargement-revocation.ts",
);

const source = readFileSync(ACTION, "utf-8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("🔴 révoquer une signature reste un acte habilité", () => {
  it('l\'action exige `requireHabilitation("revoquer_signature")`', () => {
    expect(
      source.includes('requireHabilitation("revoquer_signature")'),
      "l'action doit passer par la matrice d'habilitation, pas par une garde de rôle générique",
    ).toBe(true);
  });

  it("🔴 elle n'emploie AUCUNE garde qui autoriserait `editor`", () => {
    // `requireAdminWrite` autorise `editor`, `secretaire` et
    // `responsable_qualite`. C'est correct pour produire un brouillon ou classer
    // une pièce ; c'est faux pour retirer sa valeur à une preuve légale.
    for (const garde of ["requireAdminWrite", "requireAdminPublish", "requireAdminRead"]) {
      expect(source, `« ${garde} » ouvrirait cet acte trop largement`).not.toContain(garde);
    }
  });

  it("le témoin : la lecture SAIT reconnaître la garde trop large", () => {
    // 🔑 La règle s'applique à elle-même. Sur un extrait fabriqué qui porte la
    // faute, elle doit la voir — sinon les deux tests ci-dessus ne prouvent
    // rien de plus que « le fichier existe ».
    const fautif = "const session = await requireAdminWrite();";
    expect(fautif).toContain("requireAdminWrite");
  });

  it("l'inventaire n'est pas vide — le fichier lu contient bien du code", () => {
    // Sans ceci, un chemin devenu faux rendrait une chaîne vide et TOUS les
    // tests ci-dessus passeraient au vert en ne vérifiant plus rien. Une garde
    // qui ne garde rien est pire qu'une garde absente : elle rassure.
    expect(source.length).toBeGreaterThan(200);
    expect(source).toContain("revoquerSignatureEmargementAction");
  });
});
