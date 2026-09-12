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
    sha: "3a0ab051cc6bbe5586f04877a0a5ec6ff512e4701877b9080e91fdd99f72fb08",
    version: 2,
  },
  convention_tripartite: {
    sha: "b9955eee0a645ae94d81711a32891dd2108c2008d00423dc9b5c01a40cdfa247",
    version: 2,
  },
  contrat_formation: {
    sha: "5e1340495af53425ad863a3099b6333f8c1d6c6d7f70b5d152211810dbc28923",
    version: 1,
  },
  contrat_sous_traitance: {
    sha: "826c87dd9c49c4d2424bfb8a9457e22bd6b99cbb8c14752e6588fb05a01136eb",
    version: 2,
  },
  contrat_travail: {
    sha: "838949ca21ee01186a39eca67a073d880a0d44b9470002dc3cf2adcd2418c4a9",
    version: 1,
  },
  releve_connexion: {
    sha: "afa986aaf0b72cb79ffa17b1693062898d85bbf9476de4ae191009a840cd7055",
    version: 1,
  },
  lettre_mission: {
    sha: "5ecd3292d85abac664088d4ef4648748c63de2a3a6330f86f11cc6a09a96fd9c",
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
