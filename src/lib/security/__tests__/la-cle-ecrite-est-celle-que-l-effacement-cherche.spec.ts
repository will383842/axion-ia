// La clé ÉCRITE par les formulaires est-elle celle que l'effacement CHERCHE ?
//
// ── Ce que ce test ajoute, et ce qu'il n'ajoute pas ────────────────────────
// `tests/unit/ci/toute-submission-porte-sa-cle-personne.spec.ts` prouve que
// chaque création POSE une clé. Il ne prouve pas qu'elle soit la BONNE : deux
// dérivations différentes de la même adresse rempliraient la colonne sans que
// l'effacement ne retrouve jamais rien, et les deux gardes seraient vertes.
//
// C'est un contrat entre un producteur (les Server Actions) et deux
// consommateurs (`rgpd-erase.ts`, `api/gdpr-export`). Ce fichier le tient par
// les deux bouts.
//
// ⚠️ Ce qu'il NE prouve PAS : que l'effacement fonctionne de bout en bout sur
// une vraie base. Cela demande Postgres, et se joue dans la suite E2E de Gate B.
// Ici on prouve l'accord des CLÉS, ce qui est précisément ce qui a manqué —
// le défaut du 2026-09-04 n'était pas une requête fausse, c'était une colonne
// vide en face d'une requête juste.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashEmailForLookup, normalizeEmail } from "@/lib/security/email-hash";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const lire = (rel: string) => readFileSync(path.join(RACINE, rel), "utf8");

describe("la clé écrite est celle que l'effacement cherche", () => {
  it("producteurs et consommateurs appellent la MÊME fonction", () => {
    // Une seule dérivation dans tout le dossier. Si un jour quelqu'un en écrit
    // une seconde « équivalente », ce test le voit avant la mise en production.
    const producteurs = [
      "src/features/commercial-application/lead-actions.ts",
      "src/features/commercial-application/actions.ts",
      "src/features/unified-contact/actions.ts",
      "src/features/roi-report/actions.ts",
    ];
    const consommateurs = ["src/lib/rgpd-erase.ts", "src/app/api/gdpr-export/route.ts"];

    for (const f of [...producteurs, ...consommateurs]) {
      expect(lire(f), `${f} doit dériver la clé par \`hashEmailForLookup\`, pas autrement`).toMatch(
        /hashEmailForLookup/,
      );
    }
  });

  it("`Submission.contactEmailHash` et `JobApplication.emailHash` sont la MÊME clé", () => {
    // Question posée le 2026-09-04 par la session recrutement, et elle est la
    // bonne : ce sont DEUX COLONNES sur deux tables. Si elles ne dérivaient pas
    // l'adresse de la même façon, la même personne porterait deux clés et toute
    // vue « personne » se scinderait EN SILENCE — sans erreur, sans ligne
    // manquante, juste deux fiches là où il en faut une.
    //
    // Elles dérivent bien de `hashEmailForLookup` toutes les deux (vérifié).
    // Ce test l'ancre, parce que rien d'autre ne l'empêcherait de diverger.
    expect(lire("src/features/job-application/actions.ts")).toMatch(
      /emailHash:\s*hashEmailForLookup\(/,
    );
    expect(lire("src/features/commercial-application/lead-actions.ts")).toMatch(
      /contactEmailHash:\s*emailKey/,
    );
    expect(lire("src/features/commercial-application/lead-actions.ts")).toMatch(
      /const emailKey = hashEmailForLookup\(/,
    );
  });

  it("l'autre empreinte d'e-mail du dépôt n'est PAS une clé de personne", () => {
    // 🔴 `sha256Email` (`server/crm-sync/inbound.ts`) est un SHA-256 NU de
    // l'adresse — sans sel, sans séparation de domaine. `hashEmailForLookup`
    // est un HMAC salé. Les deux valeurs sont DIFFÉRENTES pour la même adresse.
    //
    // Elle a une raison d'être : elle rapproche un `emailHash` que le CRM
    // ENVOIE d'un abonné newsletter dont l'adresse est stockée en clair. C'est
    // un contrat avec un tiers, pas une clé interne.
    //
    // Le piège : s'en servir un jour comme clé de personne scinderait la fiche
    // sans rien casser. Ce test verrouille son unique usage légitime.
    const inbound = lire("src/server/crm-sync/inbound.ts");
    expect(inbound).toMatch(/sha256Email\(sub\.email\)/);
    expect(
      /sha256Email\s*\([^)]*\)\s*(===|!==)\s*[^;]*(contactEmailHash|personKey|person_key)/.test(
        inbound,
      ),
      "`sha256Email` ne doit JAMAIS être comparée à une clé de personne : SHA-256 nu contre HMAC salé, elles ne coïncident jamais",
    ).toBe(false);
  });

  it("l'effacement interroge bien la colonne `contactEmailHash`", () => {
    // Le producteur ne sert à rien si le consommateur cherche ailleurs.
    expect(lire("src/lib/rgpd-erase.ts")).toMatch(/contactEmailHash:\s*lookupHash/);
    expect(lire("src/app/api/gdpr-export/route.ts")).toMatch(/contactEmailHash:\s*lookupHash/);
  });

  it("la dérivation est déterministe — sinon rien ne se retrouve jamais", () => {
    const a = hashEmailForLookup("Jean.Dupont@Example.COM");
    const b = hashEmailForLookup("Jean.Dupont@Example.COM");
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("elle normalise casse et espaces — l'adresse tapée au téléphone retrouve celle tapée au clavier", () => {
    // C'est ce qui fait qu'un même humain reste UNE personne malgré une saisie
    // différente. La normalisation est la seule raison pour laquelle la fiche
    // « personne » peut exister sans table dédiée.
    const reference = hashEmailForLookup("jean.dupont@example.com");
    expect(hashEmailForLookup("  Jean.Dupont@Example.com  ")).toBe(reference);
    expect(hashEmailForLookup("JEAN.DUPONT@EXAMPLE.COM")).toBe(reference);
    expect(normalizeEmail("  Jean.Dupont@Example.com  ")).toBe("jean.dupont@example.com");
  });

  it("deux adresses DIFFÉRENTES ne se confondent pas — témoin négatif", () => {
    // Sans ce contre-témoin, une fonction cassée qui rendrait une constante
    // ferait passer les quatre tests précédents.
    expect(hashEmailForLookup("jean.dupont@example.com")).not.toBe(
      hashEmailForLookup("jeanne.dupont@example.com"),
    );
  });

  it("une adresse absente ne produit pas de clé — sinon les vides se regroupent entre eux", () => {
    // Une clé posée sur `null` rassemblerait sous une même « personne » toutes
    // les lignes sans adresse. `null` est la seule réponse juste.
    expect(hashEmailForLookup(null)).toBeNull();
    expect(hashEmailForLookup("")).toBeNull();
    expect(hashEmailForLookup("   ")).toBeNull();
  });
});
