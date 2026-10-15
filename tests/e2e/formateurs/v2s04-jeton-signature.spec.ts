// @formateurs V2-S04 (vérification n° 2, sécurité) — Lien de signature rejoué.
//
// Liens d'une lettre de mission fabriqués par le code du dépôt et présentés à
// l'action publique de signature : révoqué, remplacé, échu, altéré — refusés,
// chacun avec sa raison. Témoin : un lien neuf est reconnu.
//
// Défaut consigné (`test.fixme`, cf. le rapport de la PR) :
//   · V2-S-3 — le lien de signature émis vers l'adresse d'AVANT un changement
//     fait en console reste valable : il signe encore la pièce.

import { expect, test } from "@playwright/test";

import { prisma } from "../fixtures/formateurs/base";
import { scenarioV2 } from "../fixtures/formateurs/v2s-commun";

interface Essai {
  lecture: string;
  signature: string;
}
interface Observations {
  temoin: string;
  revoque: Essai;
  remplace: Essai;
  echu: Essai;
  altere: string;
  avant: string;
  changement: string;
  apresChangement: Essai;
  signatures: number;
}

test.describe("@formateurs V2-S04 — lien de signature d'une pièce rejoué", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  let o: Observations;

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    o = await scenarioV2<Observations>("v2s04-jeton-signature");
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("témoin : un lien neuf est reconnu", () => {
    expect(o.temoin).toBe("ok");
    expect(o.avant).toBe("ok");
  });

  test("révoqué, remplacé par un plus récent : refusé « révoqué »", () => {
    expect(o.revoque).toEqual({ lecture: "revoque", signature: "lien_revoque" });
    expect(o.remplace).toEqual({ lecture: "revoque", signature: "lien_revoque" });
  });

  test("échu : refusé « expiré » ; altéré : refusé « invalide »", () => {
    expect(o.echu).toEqual({ lecture: "expire", signature: "lien_expire" });
    expect(o.altere).toBe("lien_invalide");
  });

  // V2-S-3 — BLOQUANT (sécurité). Après un changement d'adresse fait en console,
  // le lien de signature envoyé à l'ANCIENNE adresse signe encore la lettre de
  // mission. Probable : changement-email-console.ts (`ecrireFicheAvecChangementEmail`,
  // ~l. 154-175) invalide les codes F17 et les liens de connexion, pas les
  // `DocumentSignatureToken` vivants du formateur.
  test("V2-S-3 — le lien envoyé à l'ancienne adresse ne signe plus rien", () => {
    expect(o.changement).toBe("ok");
    expect(o.apresChangement.signature).not.toBe("signe");
    expect(o.signatures).toBe(0);
  });
});
