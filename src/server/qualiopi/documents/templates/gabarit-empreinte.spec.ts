// @vitest-environment node

/**
 * Verrou — le TEXTE d'un gabarit signable ne change pas sans qu'on tranche.
 *
 * ## Le défaut, et il vient d'arriver
 *
 * `gabarit-versions.ts` porte, depuis le 16/08, une règle d'usage écrite noir
 * sur blanc dans son propre en-tête :
 *
 * > **Toute modification du TEXTE RENDU d'une pièce de cette table impose
 * > d'incrémenter sa version.**
 *
 * Le 09/09, trois clauses de fond ont été ajoutées au contrat de sous-traitance
 * — délai de paiement, fait générateur, mandat de facturation — et la table
 * n'a pas bougé. La règle était à l'endroit exact où elle se lit, elle n'a
 * rien empêché.
 *
 * 🔑 **Un commentaire ne protège pas un autre fichier.** C'est le motif du
 * `server-only` qui tuait deux crons en silence : la consigne existait, et rien
 * ne l'EXÉCUTAIT. Ce fichier l'exécute.
 *
 * ## Ce que coûte l'oubli
 *
 * `exemplaire-signe.ts` rejoue l'instantané des données à travers le composant
 * de rendu D'AUJOURD'HUI. Si le texte a changé depuis la signature et que la
 * version n'a pas bougé, le système croit la pièce reproductible : il produit
 * une copie « signée » portant des clauses que le signataire n'a jamais lues,
 * dont l'empreinte scellée ne correspond plus. La version est la seule chose
 * qui le fait refuser.
 *
 * ## Pourquoi une EMPREINTE, et pas une lecture du texte
 *
 * Lire « le texte rendu » d'un composant react-pdf demanderait de l'exécuter,
 * avec ses données, ses conditions et ses variantes — un rendu par branche.
 * L'empreinte du SOURCE, commentaires retirés et espaces normalisés, répond à
 * une question plus modeste et suffisante : **est-ce que ce fichier a changé
 * depuis la dernière fois que quelqu'un a tranché ?**
 *
 * ⚠️ ELLE PEUT DONC ROUGIR SUR UN CHANGEMENT PUREMENT COSMÉTIQUE — un renommage
 * de variable, un import déplacé. C'est assumé, et c'est même le bon
 * compromis : le rouge n'est pas un verdict, c'est une QUESTION, et le message
 * porte les deux réponses possibles. Une garde qui pose une question à laquelle
 * on répond en une ligne coûte infiniment moins qu'une clause réécrite
 * rétroactivement sous la signature de quelqu'un.
 *
 * ⚠️ Les commentaires sont retirés AVANT de mesurer. Sans ça, documenter la
 * garde ferait rougir la garde — piège déjà payé deux fois dans ce dépôt.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GABARITS_ARCHIVES } from "./archives";
import { GABARIT_VERSIONS, type TypeGabaritSignable } from "./gabarit-versions";

/** Fichier source de chaque pièce signable. Miroir de `COMPOSANTS`. */
const SOURCE: Readonly<Record<TypeGabaritSignable, string>> = {
  devis: "devis.tsx",
  convention: "convention.tsx",
  convention_tripartite: "convention-tripartite.tsx",
  contrat_formation: "contrat-formation.tsx",
  contrat_sous_traitance: "contrat-sous-traitance.tsx",
  contrat_travail: "contrat-travail.tsx",
  releve_connexion: "releve-connexion.tsx",
  lettre_mission: "lettre-mission.tsx",
  mandat_opco: "mandat-opco.tsx",
};

/**
 * Empreinte ATTENDUE de chaque gabarit, avec la version sous laquelle elle a
 * été relevée.
 *
 * ⚠️ CE QU'IL FAUT FAIRE QUAND CE TEST ROUGIT — les deux réponses, et une seule
 * est correcte selon le cas :
 *
 *   · le texte a changé pour de bon (clause ajoutée, mention reformulée,
 *     section renumérotée — tout ce qu'un SIGNATAIRE verrait autrement) :
 *     incrémenter la version dans `GABARIT_VERSIONS`, ajouter sa ligne
 *     d'historique, PUIS reporter la nouvelle empreinte ici ;
 *
 *   · le changement est cosmétique (style, commentaire, renommage, import) :
 *     reporter la nouvelle empreinte ici SANS toucher à la version. Une version
 *     qui bouge sans raison refuse des exemplaires parfaitement fidèles, et une
 *     garde qui refuse à tort finit désarmée.
 *
 * ⛔ Ce qu'il ne faut JAMAIS faire : retirer une entrée de cette table pour
 * faire passer le test. Le contrôle deviendrait vert en ne regardant plus rien.
 */
const EMPREINTES: Readonly<
  Record<TypeGabaritSignable, { readonly sha: string; readonly version: number }>
> = {
  devis: { sha: "bfd05ad0ef5d538342d23a8deeff1b69f10c8fb9acdad6f5dd88a1cb79fc1f90", version: 1 },
  convention: {
    // v4 — 04/10/2026 : § 5 réécrit (relecture juridique, tour 2) ; v3 archivée.
    sha: "1e175dba72907cd70a9557fa563fc8aa6f8e39c13b57dcee2b792e7bf24c4d2f",
    version: 4,
  },
  convention_tripartite: {
    // v4 — 04/10/2026 : § 5 réécrit (relecture juridique, tour 2) ; v3 archivée.
    sha: "8216086dbdbf3ef850f3db8180743ce8da785412d09090c57362699f336a647d",
    version: 4,
  },
  contrat_formation: {
    // v2 — 30/09/2026 : citations juridiques corrigées ; v1 archivée.
    sha: "0c138db997a2aadff39ef3843d625d846f7f3ce813f7a39e4287d46a0fddaafa",
    version: 2,
  },
  contrat_sous_traitance: {
    sha: "826c87dd9c49c4d2424bfb8a9457e22bd6b99cbb8c14752e6588fb05a01136eb",
    version: 2,
  },
  contrat_travail: {
    // v2 — 13/09/2026 : la période d'essai porte son UNITÉ (cf. GABARIT_VERSIONS).
    sha: "ccf8d5714c07a539301e6173e467fddb7ba7f1cbbd4381479dbacf344107e8da",
    version: 2,
  },
  releve_connexion: {
    // v2 — 30/09/2026 : citations juridiques corrigées ; v1 archivée.
    sha: "d362a55795b87f700e935ff54e64db32047e708ee3f34aa173f2617b2502a85d",
    version: 2,
  },
  lettre_mission: {
    sha: "5ecd3292d85abac664088d4ef4648748c63de2a3a6330f86f11cc6a09a96fd9c",
    version: 1,
  },
  mandat_opco: {
    // v1 — 04/10/2026 : premier texte (INT-T66-A).
    sha: "870027f574c91d4d4c4d36d7a88254cbf274db404705f9543461aa1690410041",
    version: 1,
  },
};

/**
 * Retire commentaires de bloc et de ligne, puis normalise les espaces.
 *
 * 🔑 Les deux moitiés comptent. Sans le retrait des commentaires, écrire la
 * documentation d'une clause ferait rougir la garde — on apprendrait à ne plus
 * documenter. Sans la normalisation des espaces, Prettier ferait rougir un
 * texte inchangé : ce dépôt a déjà payé deux fois un témoin qui dépendait du
 * formatage.
 */
function texteMesurable(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function empreinte(fichier: string): string {
  const chemin = join(
    process.cwd(),
    "src",
    "server",
    "qualiopi",
    "documents",
    "templates",
    fichier,
  );
  return createHash("sha256")
    .update(texteMesurable(readFileSync(chemin, "utf8")), "utf8")
    .digest("hex");
}

const TYPES = Object.keys(GABARIT_VERSIONS) as TypeGabaritSignable[];

describe("le texte d'un gabarit signable ne change pas sans qu'on tranche", () => {
  it("🔑 la table des sources couvre EXACTEMENT les pièces signables", () => {
    // Contre-témoin d'exhaustivité : une pièce ajoutée à `GABARIT_VERSIONS` et
    // oubliée ici échapperait entièrement au contrôle, en silence.
    expect(Object.keys(SOURCE).sort()).toEqual([...TYPES].sort());
    expect(Object.keys(EMPREINTES).sort()).toEqual([...TYPES].sort());
  });

  it("🔑 chaque source est LUE et rend un texte non vide", () => {
    // Sans ce témoin, un chemin devenu faux ferait lever `readFileSync` — ou,
    // pire, rendrait une chaîne vide dont l'empreinte serait stable et fausse.
    for (const type of TYPES) {
      const texte = texteMesurable(
        readFileSync(
          join(process.cwd(), "src", "server", "qualiopi", "documents", "templates", SOURCE[type]),
          "utf8",
        ),
      );
      expect(texte.length, `${SOURCE[type]} : source vide ou illisible`).toBeGreaterThan(500);
    }
  });

  it("🔴 aucun gabarit n'a changé depuis la dernière décision", () => {
    const derives = TYPES.filter(
      (t) => EMPREINTES[t].sha !== "" && empreinte(SOURCE[t]) !== EMPREINTES[t].sha,
    );
    expect(
      derives.map((t) => `${t} (${SOURCE[t]}) → ${empreinte(SOURCE[t])}`),
      "Le TEXTE d'un ou plusieurs gabarits signables a changé.\n" +
        "  · s'il s'agit d'une modification de FOND — clause ajoutée, mention " +
        "reformulée, section renumérotée, tout ce qu'un SIGNATAIRE verrait " +
        "autrement — incrémentez sa version dans `GABARIT_VERSIONS`, ajoutez sa " +
        "ligne d'historique, PUIS reportez l'empreinte ci-dessus dans `EMPREINTES`. " +
        "Sans l'incrément, les exemplaires déjà signés seront re-rendus avec des " +
        "clauses que leurs signataires n'ont jamais lues.\n" +
        "  · s'il s'agit d'un changement COSMÉTIQUE — style, commentaire, " +
        "renommage, import — reportez l'empreinte SANS toucher à la version.",
    ).toEqual([]);
  });

  it("🔴 l'empreinte relevée correspond à la version en vigueur", () => {
    // Le piège que ce test ferme : reporter une nouvelle empreinte SANS
    // incrémenter, sur un changement de fond. Les deux colonnes doivent bouger
    // ensemble, et cette assertion rend l'oubli visible à la relecture.
    for (const type of TYPES) {
      expect(
        EMPREINTES[type].version,
        `${type} : l'empreinte a été relevée sous la version ${EMPREINTES[type].version}, ` +
          `mais la table en vigueur dit ${GABARIT_VERSIONS[type]}. L'une des deux n'a pas été mise à jour.`,
      ).toBe(GABARIT_VERSIONS[type]);
    }
  });

  it("🔑 CONTRE-TÉMOIN : l'empreinte SAIT voir une modification", async () => {
    // Le test principal compare des valeurs égales. S'il cessait de mesurer —
    // chemin faux, normalisation qui avale tout — il resterait vert en ne
    // regardant plus rien. On FABRIQUE donc la modification qu'il prétend voir,
    // au lieu de l'emprunter au dépôt.
    const source = readFileSync(
      join(
        process.cwd(),
        "src",
        "server",
        "qualiopi",
        "documents",
        "templates",
        SOURCE.contrat_sous_traitance,
      ),
      "utf8",
    );
    const avant = createHash("sha256").update(texteMesurable(source), "utf8").digest("hex");
    const apres = createHash("sha256")
      .update(texteMesurable(source.replace("Délai de paiement", "Délai de règlement")), "utf8")
      .digest("hex");
    expect(apres, "changer un mot du contrat ne change pas son empreinte").not.toBe(avant);
  });

  it("🔑 CONTRE-TÉMOIN : un COMMENTAIRE ne change PAS l'empreinte", () => {
    // L'autre moitié, et elle est aussi importante : si documenter une clause
    // faisait rougir la garde, on apprendrait à ne plus documenter.
    const source = readFileSync(
      join(
        process.cwd(),
        "src",
        "server",
        "qualiopi",
        "documents",
        "templates",
        SOURCE.contrat_sous_traitance,
      ),
      "utf8",
    );
    const avecCommentaire = `// note ajoutée par le test\n${source}`;
    expect(texteMesurable(avecCommentaire)).toBe(texteMesurable(source));
  });
});

/**
 * Empreintes des gabarits ARCHIVÉS — une version déjà signée ne change JAMAIS.
 *
 * 🔴 2026-09-30. Ces fichiers rendent l'exemplaire signé de pièces DÉJÀ
 * signées (dont la convention `AXI-DOC-2026-039`, v2). Contrairement à la table
 * `EMPREINTES` ci-dessus, il n'y a ici qu'une seule réponse possible quand le
 * test rougit : **annuler la modification**. Il n'existe pas de retouche
 * « cosmétique » d'un texte déjà signé qu'on puisse accepter sans preuve — le
 * témoin octet pour octet est
 * `__tests__/pieces-signees-restent-reproductibles.spec.tsx`.
 *
 * ⛔ Ne jamais mettre à jour une empreinte de cette table, ni retirer une
 * entrée pour faire passer le test.
 */
const EMPREINTES_ARCHIVES: Readonly<Record<string, string>> = {
  "convention.v2.tsx": "3455697cb2369aa22b07547038910e3987533520891f184b68b170f2067c48cd",
  "convention-tripartite.v2.tsx":
    "7d742470ca75e388c089185b43ec39852744ac22bd36b411ebf6a1b33544982c",
  "convention.v3.tsx": "3dcbfec9920cd196164c5d91111044656f6c717709b294453780a57c6baccdc3",
  "convention-tripartite.v3.tsx":
    "72db3db385ee38f6172f44d52c04d3e5a3488af2212c46a27a655a8119f0772c",
  "contrat-formation.v1.tsx": "4afe9d19dac33437e8970ecbad091af861e8a5bce4f01b35ac4fceaed264e4cd",
  "releve-connexion.v1.tsx": "958909a208a6f56c286c67f68694982e9668b48232872553c683ac68aee44ae7",
  "mentions-figees.ts": "6f570713a14786affb5a2a2bc2dd73f61e0ff1546dcf9ab896917ff03eb6f199",
};

describe("⛔ le texte d'une version ARCHIVÉE ne change jamais", () => {
  const archive = (fichier: string): string =>
    createHash("sha256")
      .update(
        texteMesurable(
          readFileSync(
            join(
              process.cwd(),
              "src",
              "server",
              "qualiopi",
              "documents",
              "templates",
              "archives",
              fichier,
            ),
            "utf8",
          ),
        ),
        "utf8",
      )
      .digest("hex");

  it("🔑 chaque version inscrite au registre a son empreinte figée, et réciproquement", () => {
    const inscrits = Object.values(GABARITS_ARCHIVES).flatMap((parVersion) =>
      Object.values(parVersion ?? {}).map((a) => a.fichier),
    );
    expect([...inscrits, "mentions-figees.ts"].sort()).toEqual(
      Object.keys(EMPREINTES_ARCHIVES).sort(),
    );
  });

  it("🔴 aucun fichier archivé n'a changé", () => {
    const modifies = Object.entries(EMPREINTES_ARCHIVES)
      .filter(([fichier, sha]) => archive(fichier) !== sha)
      .map(([fichier]) => `${fichier} → ${archive(fichier)}`);
    expect(
      modifies,
      "Un gabarit ARCHIVÉ a changé. Il rend l'exemplaire de pièces DÉJÀ SIGNÉES : " +
        "annulez la modification. Pour faire évoluer le texte, retouchez le gabarit " +
        "COURANT et incrémentez sa version (cf. `gabarit-versions.ts`).",
    ).toEqual([]);
  });

  it("🔑 on n'archive que des versions ANTÉRIEURES à la version courante", () => {
    for (const [type, parVersion] of Object.entries(GABARITS_ARCHIVES)) {
      for (const v of Object.keys(parVersion ?? {}).map(Number)) {
        expect(v, `${type} v${v}`).toBeLessThan(GABARIT_VERSIONS[type as TypeGabaritSignable]);
        expect(Number.isInteger(v) && v >= 1, `${type} v${v}`).toBe(true);
      }
    }
  });

  it("🔑 CONTRE-TÉMOIN : l'empreinte d'une archive voit un mot changé", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src",
        "server",
        "qualiopi",
        "documents",
        "templates",
        "archives",
        "mentions-figees.ts",
      ),
      "utf8",
    );
    expect(texteMesurable(source.replaceAll("L.6353-2", "D.6353-1"))).not.toBe(
      texteMesurable(source),
    );
  });
});
