/**
 * Test STRUCTUREL — chaque circuit de signature déclaré doit être émissible.
 *
 * ## Le défaut que ce test rend impossible
 *
 * Le 2026-07-31, sur la PREMIÈRE convention réelle (AXI-DOC-2026-003), le lien
 * de signature « client » a été refusé : « Aucun client n'est rattaché à cette
 * pièce ». Diagnostic : le circuit `convention: [client, axionia]` était déclaré
 * dans `parties-requises.ts`, la résolution d'identité lisait
 * `DocumentGenere.clientId` — et l'action de génération ne passait que
 * `refs: { sessionId }`. Trois circuits sur huit étaient dans ce cas
 * (convention, tripartite, protocole AFEST) : déclarés, jamais atteignables.
 *
 * Aucun test ne le voyait, car les circuits vivent dans un fichier et les refs
 * dans un autre — rien ne les confrontait. C'est ce que ce test fait : il lit
 * LE CODE SOURCE des générateurs, extrait les refs passées à `generateDocument`
 * pour chaque type signable, et exige que chaque partie du circuit dispose de
 * la référence dont sa résolution d'identité a besoin.
 *
 * ➡️ Ajouter un circuit sans câbler ses refs, ou retirer une ref encore
 * exigée par un circuit, fait échouer CE test — avant le déploiement, pas
 * devant un client.
 *
 * ⚠️ Analyse de SOURCE, pas d'exécution : volontaire. Exécuter les actions
 * exigerait une base et un mock par entité ; lire la source suffit à prouver
 * la présence de la ref, et reste vrai quel que soit le chemin d'exécution.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { TYPES_SIGNABLES, circuitPour } from "./parties-requises";
import type { PartieSignataire } from "./document-signature-hash";

// ─────────────────────────────────────────────────────────────────────────────
// Ce que chaque partie exige comme ref (miroir de `resoudreIdentite` dans
// piece-lien-signature.ts — si la résolution change de source, changer ICI
// aussi, le test le rappellera en échouant).
// ─────────────────────────────────────────────────────────────────────────────

const REF_REQUISE_PAR_PARTIE: Partial<Record<PartieSignataire, string>> = {
  client: "clientId",
  beneficiaire: "traineeId",
  sous_traitant: "sousTraitantId",
  // Le financeur se résout via le dossier de financement de la SESSION.
  financeur: "sessionId",
  // formateur / responsable_pedagogique / axionia / tuteur signent depuis un
  // espace authentifié — aucun jeton public, donc aucune ref exigée.
};

// ─────────────────────────────────────────────────────────────────────────────
// Écarts CONNUS et assumés — chacun doit rester justifié, jamais silencieux.
// ─────────────────────────────────────────────────────────────────────────────

const ECARTS_ASSUMES: ReadonlyArray<{ type: string; partie: PartieSignataire; raison: string }> = [
  {
    type: "protocole_afest",
    partie: "client",
    // Fait de SCHÉMA, pas oubli de câblage : `CoachingSession` n'a aucune FK
    // vers `Client` (un coaching peut exister sans fiche CRM ; l'entreprise y
    // est du texte libre). Fabriquer un rattachement scellerait une identité
    // que personne n'a saisie. L'admin obtient le refus explicite — actionnable.
    // Lever cet écart = décision de schéma (FK Client sur CoachingSession).
    raison:
      "CoachingSession sans FK Client — refus explicite à l'émission, décision de schéma en attente",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Où vivent les générateurs de pièces signables.
// ─────────────────────────────────────────────────────────────────────────────

const FICHIERS_GENERATEURS = [
  "src/server/actions/qualiopi/documents.ts",
  "src/server/actions/qualiopi/devis.ts",
  "src/server/qualiopi/coaching-afest/protocole-1to1.ts",
];

const REF_KEYS = ["sessionId", "clientId", "traineeId", "sousTraitantId", "coachingSessionId"];

/**
 * Extrait, pour un type de document, les clés de refs passées à
 * `generateDocument` dans les sources. Un type peut être généré à plusieurs
 * endroits : on exige que CHAQUE site de génération porte les refs (sinon une
 * partie serait émissible ou non selon le chemin qui a produit la pièce).
 */
function refsParSiteDeGeneration(type: string): string[][] {
  const sites: string[][] = [];
  for (const fichier of FICHIERS_GENERATEURS) {
    const source = readFileSync(resolve(process.cwd(), fichier), "utf8");
    let depuis = 0;
    for (;;) {
      const posType = source.indexOf(`type: "${type}"`, depuis);
      if (posType === -1) break;
      const posRefs = source.indexOf("refs:", posType);
      // Le bloc refs suit toujours le type dans le même appel — une fenêtre
      // large mais bornée évite d'attraper les refs de l'appel suivant.
      if (posRefs !== -1 && posRefs - posType < 6000) {
        const finLigne = source.indexOf("\n", source.indexOf("}", posRefs));
        const bloc = source.slice(posRefs, finLigne);
        sites.push(REF_KEYS.filter((k) => new RegExp(`\\b${k}\\b`).test(bloc)));
      }
      depuis = posType + 1;
    }
  }
  return sites;
}

// ─────────────────────────────────────────────────────────────────────────────
// Le test
// ─────────────────────────────────────────────────────────────────────────────

describe("circuits de signature — chaque partie déclarée est émissible", () => {
  const types = TYPES_SIGNABLES;

  it("le registre déclare bien des circuits (garde anti-régression du test lui-même)", () => {
    expect(types.length).toBeGreaterThanOrEqual(8);
  });

  for (const type of types) {
    const circuit = circuitPour(type);
    if (circuit === null) continue;
    const refsRequises = [
      ...new Set(
        circuit.parties
          .map((p) => REF_REQUISE_PAR_PARTIE[p])
          .filter((r): r is string => r !== undefined),
      ),
    ];
    // Circuit purement « espace authentifié » : rien à exiger.
    if (refsRequises.length === 0) continue;

    it(`${type} : chaque site de génération fournit [${refsRequises.join(", ")}]`, () => {
      const sites = refsParSiteDeGeneration(type);
      // Un circuit déclaré dont AUCUN code ne génère la pièce est suspect :
      // soit le générateur a bougé de fichier (ajouter le fichier ci-dessus),
      // soit la pièce n'existe plus (retirer le circuit).
      expect(
        sites.length,
        `aucun site de génération trouvé pour « ${type} » dans ${FICHIERS_GENERATEURS.join(", ")}`,
      ).toBeGreaterThan(0);

      for (const refsFournies of sites) {
        for (const ref of refsRequises) {
          const partie = (Object.keys(REF_REQUISE_PAR_PARTIE) as PartieSignataire[]).find(
            (p) => REF_REQUISE_PAR_PARTIE[p] === ref,
          );
          const assume = ECARTS_ASSUMES.some((e) => e.type === type && e.partie === partie);
          if (assume) continue;
          expect(
            refsFournies,
            `la pièce « ${type} » déclare la partie « ${partie} » mais son générateur ne passe pas « ${ref} » dans refs — le lien de signature sera refusé à l'émission`,
          ).toContain(ref);
        }
      }
    });
  }

  it("les écarts assumés correspondent à des circuits réels (pas de justification zombie)", () => {
    for (const ecart of ECARTS_ASSUMES) {
      const circuit = circuitPour(ecart.type);
      expect(circuit, `écart assumé sur un type inconnu : ${ecart.type}`).not.toBeNull();
      expect(circuit?.parties).toContain(ecart.partie);
      expect(ecart.raison.length).toBeGreaterThan(20);
    }
  });
});
