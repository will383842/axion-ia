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
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GABARITS_ARCHIVES, GABARITS_ARCHIVES_FORMATION } from "./archives";
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
  autorisation_captation: "autorisation-captation.tsx",
  facture: "facture.tsx",
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
  devis: {
    // v5 — 17/11/2026 : bloc « Conditions particulières » (devis classique), phrase de primauté
    // lue dans la photo (`data.phrasePrimaute`, nulle tant que le fondateur ne l'a pas validée,
    // sans changement de version à l'allumage), mention dans le « Bon pour accord » ; v4 archivée.
    // (v4 — 07/11/2026 : bloc « Formule retenue par le client » (choix scellé, totaux, récurrent,
    // empreinte du choix) imprimé sur l'exemplaire signé d'un devis à formules ; texte rendu
    // changé (branche de fond ajoutée) donc incrément ; v3 archivée.
    // (v3 — 06/11/2026 : devis à formules, formules A et B côte à côte, lot 3 ; v2 archivée.)
    // (v2 — 16/10/2026 : mention handicap, L15, NC12 ; v1 archivée.)
    // Mise en page seule (08/11/2026, texte rendu INCHANGÉ → version 4 conservée) : le bloc
    // « Formule retenue » sort du cadre insécable « Bon pour accord » (`choixBox`, sécable).
    // v6 — 18/11/2026 : refonte au style de la charte 2027 (`charte/v1`), libellés simplifiés,
    // phrases juridiques et montants repris mot pour mot ; v5 archivée (`archives/devis.v5.tsx`).
    // (v5 — 17/11/2026 : bloc « Conditions particulières », sha d6eb37c8… : voir EMPREINTES_ARCHIVES.)
    // Taux de TVA décimaux à la française (« 5,5 % », 18/11/2026) : v6 PAS ENCORE EN LIGNE,
    // aucun exemplaire signé sous v6 → empreinte reportée SANS incrément (version 6 conservée).
    sha: "7177c2a2e65e795710c5c7621ec55fcc1400801a93ccffcd5a3b8d18793d57e5",
    version: 6,
  },
  convention: {
    // v9 — 25/11/2026 : § 3, paragraphe de la garantie de remboursement de la Journée IA
    // (`TEXTE_GARANTIE_JOURNEE_IA`, CGV 47.10), imprimé seulement si `data.journeeIa === true` ;
    // v8 archivée.
    // (v8 — 19/11/2026 : clause financeur (§ 5), clause 5 bis et ligne Qualiopi imprimées seulement
    // si la certification est obtenue à la génération (`data.certificationObtenue`), texte des
    // clauses inchangé et gardé ; v7 archivée.
    // (v7 — 18/11/2026 : refonte au style de la charte 2027 (`charte/v1`), texte inchangé.
    // v6 — 16/10/2026 : mention handicap, L15, NC12. v5 — 04/10/2026 : clause de condition suspensive OPCO.)
    // v10 — 26/11/2026 : l'acompte versé reste acquis en cas d'annulation, sans condition de délai
    // (§ 4) ; dédit formation facturé à part, ni imputable ni pris en charge par un OPCO ; v9 archivée.
    // (v9 — 25/11/2026 : paragraphe de la garantie Journée IA, § 3.)
    // v11 — 26/11/2026 : la personne morale non professionnelle perd aussi l'acompte (§ 4), avec
    // clause réciproque (acompte rendu + indemnité égale si l'organisme annule hors force majeure) ;
    // v10 archivée.
    // v12 — 26/11/2026 : l'organisme REPORTE au lieu d'annuler (2 dates sous 3 mois, sans frais,
    // acompte reporté ; CGV 46.4) ; v11 archivée.
    sha: "4c2c887ad93a4e226c39835c1af7420aba50428e51004a763669299c710b9098",
    version: 12,
  },
  convention_tripartite: {
    // v7 — 18/11/2026 : refonte au style de la charte 2027, texte inchangé ; v6 archivée.
    // (v6 — 16/10/2026 : même mention handicap, mot pour mot.)
    // v8 — 26/11/2026 : même règle de l'acompte acquis (§ 4), mot pour mot ; v7 archivée.
    // v9 — 26/11/2026 : même règle de l'acompte et même clause réciproque (§ 4), mot pour mot ;
    // v8 archivée.
    // v10 — 26/11/2026 : même règle de report sans frais (§ 4), mot pour mot ; v9 archivée.
    sha: "54d020954dfcecc5f6ac220bbb96c7bc46e9b0c5f4635366991384b9273d1b80",
    version: 10,
  },
  contrat_formation: {
    // v3 — 18/11/2026 : refonte au style de la charte 2027, texte inchangé ; v2 archivée.
    // (v2 — 30/09/2026 : citations juridiques corrigées.)
    sha: "9c2f344b57fa6ddcca856f1f60ac781a912e568cb3cdca178d8e1aeeb0dc1ac1",
    version: 3,
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
    // v1 — 04/10/2026 : premier texte (INT-T66-A), avec les trois ajouts de la juriste
    // (issue 656, commentaire 5981375404) intégrés AVANT toute émission : reste en v1.
    sha: "d1eb58ca3d70e5c0804503a505cc2f3bd1d541e9af3504da93d0525b9aca78ad",
    version: 1,
  },
  autorisation_captation: {
    // v1 — 10/10/2026 (S6a) : entrée dans la table, texte d'origine relevé tel quel.
    sha: "6a15a48290dfd6fd336474e4148d41c46465b0a0c39a7b2523bb3e96e36bb687",
    version: 1,
  },
  facture: {
    // v2 — 18/11/2026 : refonte au style de la charte 2027 (mise en page seule, intitulés,
    // montants et mentions inchangés ; facture ET avoir) ; v1 archivée (`archives/facture.v1.tsx`).
    sha: "1b610d823f1a3e64328eb021e61c698dcebccce5f5b4764d53c8181341d9ce6b",
    version: 2,
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
  "convention.v4.tsx": "4f4a212643f49e4873bae2517b28dfaceab218057e6c9895287e4005798c4b1c",
  "convention-tripartite.v4.tsx":
    "fb7fa23dae608dc04921190e5e0538373fc94615bc228f145354c4cda53b154e",
  "convention.v5.tsx": "12e956e39f7a868b8bdf5ecddb599f0fe389add85c280469e1bbad74952560ee",
  "convention-tripartite.v5.tsx":
    "b46c9072efe9f2013c499629f2af2364e6d56a92a3c35f83c353c5dfb16817d4",
  "devis.v1.tsx": "bfd05ad0ef5d538342d23a8deeff1b69f10c8fb9acdad6f5dd88a1cb79fc1f90",
  // Copie conforme du gabarit courant du 06/11/2026 (empreinte identique à celle de la v2 courante).
  "devis.v2.tsx": "c702f29f1febb462cc3461591a8704b13c1512fa0e42b18219febccac6d4c811",
  // 07/11/2026 : copie conforme du gabarit courant d'avant le bloc « Formule retenue » (empreinte
  // identique à celle de l'ancienne v3 courante, 70f99c86…).
  "devis.v3.tsx": "70f99c862cad6bc0fa9b2f7473a06bc4d05b665e57b41e52d0a24f791d3815f9",
  // 17/11/2026 : copie conforme du gabarit courant d'avant le bloc « Conditions particulières »
  // (empreinte identique à celle de l'ancienne v4 courante, 29aaf995…).
  "devis.v4.tsx": "29aaf995b338ad278f5fe8a739737f0c13e9121cd3cbfec782b384ba5cec146b",
  // 18/11/2026 : copie conforme du gabarit courant d'avant la refonte charte 2027 (empreinte
  // identique à celle de l'ancienne v5 courante, d6eb37c8…).
  "devis.v5.tsx": "d6eb37c85d2826d7e4518ea54ec80b3ef5ac2908f87dd8c490d7201c2f72a141",
  // 18/11/2026 : copie conforme du gabarit courant d'avant la refonte charte 2027.
  "facture.v1.tsx": "457cd2272ed81f208e85388ba401a138dbb48a6b8454a817facdee3b91fc8d39",
  // 18/11/2026 : copies conformes des gabarits courants d'avant la refonte charte 2027 (seule
  // différence : la mention légale de tête est figée dans le fichier).
  "convention.v6.tsx": "ecfd0277704317e97b34c135203f42f246f7fa932d4bb9887c7e9bb3a2bc5218",
  // 19/11/2026 : copie conforme du gabarit courant du 18/11, mention figée.
  "convention.v7.tsx": "73047fbf99819d59ed81b2a7523e1c960b51c80921a085d14a24983b8cd2bf1c",
  // 25/11/2026 : copie conforme du gabarit courant du 19/11, mention figée.
  "convention.v8.tsx": "6f5bccb9116ff3846249fba85bc95369ab8b1f236c4bf650262a5bc8e159c86c",
  // 26/11/2026 : copies conformes des gabarits courants d'avant la règle de l'acompte acquis
  // (mention légale figée dans le fichier).
  "convention.v9.tsx": "4bd0a3df6f9cedd1ff86000937058c9c97a33ed23524fe1122a553b42f1f8ce6",
  // 26/11/2026 : copies conformes des gabarits courants d'avant la réciprocité non-professionnel
  // (mention légale figée dans le fichier).
  "convention.v10.tsx": "58b6650ec812c0d8b6a2698fce9be4d4b889bef691ac8eba5bb3b6292ab0a903",
  // 26/11/2026 : copies conformes des gabarits courants d'avant le report à l'initiative d'Axion-IA.
  "convention.v11.tsx": "5bddc2825d427a17a5173504889e6a0ea6f983f99d1730934a07242b7b713526",
  "convention-tripartite.v9.tsx":
    "434bb7584074d52abb58151cc783fbcd9a6b58ddf3efdc8d690ccefbbc45ef21",
  "convention-tripartite.v8.tsx":
    "d972d3180bbcea219ae21c3aebb3398486a333e185c02eea2d621a5d06445081",
  "convention-tripartite.v7.tsx":
    "1c9a167628836c062e5af9a11cf1f52998325b65682ece4efe6fe231bbc11ac5",
  "convention-tripartite.v6.tsx":
    "e994a458883987781d2b3b4b4d2d2c00dc782ee8248fe75d6846b4544f4a7660",
  "contrat-formation.v2.tsx": "50a48f4ac853f805ab112d463ae15a2a61c5548eb02231db18aee78b420b3fa3",
  "contrat-formation.v1.tsx": "4afe9d19dac33437e8970ecbad091af861e8a5bce4f01b35ac4fceaed264e4cd",
  "releve-connexion.v1.tsx": "958909a208a6f56c286c67f68694982e9668b48232872553c683ac68aee44ae7",
  // 18/11/2026 : copies conformes des cinq gabarits de formation d'avant la charte 2027
  // (programme, convocation, attestations, certificat : pièces non signables, v1 archivées).
  "programme-formation.v1.tsx": "b069b4582c5e5d697ffcc9e495a465a013aeb6cbfe0ca058710a66cfa07583c5",
  "convocation.v1.tsx": "bd97002b7b8f1133a50451bb28b7e2b91466b808e942f29fde694210c06ce0b6",
  "attestation.v1.tsx": "e4ea5ce69f7bd3e7dddd13df615544fd638c97202dd945dac5ec50c78de76e56",
  "attestation-partielle.v1.tsx":
    "1835ed08d7fda3ff9a19754ea6efcdafb9cae18302f81333a7bb45aca8c74aa8",
  "certificat-realisation.v1.tsx":
    "e6db1484b612ac9cf972b6e6f47e3552bcfd621d3ae3b13f7a73b7ea1ad5a107",
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
    const inscritsFormation = Object.values(GABARITS_ARCHIVES_FORMATION).flatMap((parVersion) =>
      Object.values(parVersion).map((a) => a.fichier),
    );
    expect([...inscrits, ...inscritsFormation, "mentions-figees.ts"].sort()).toEqual(
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

/**
 * 🔑 Module de style `charte/v1` — GELÉ.
 *
 * Les gabarits signables (le devis depuis la v6) s'appuient sur lui : changer une couleur, un
 * espace ou un composant change le rendu d'une pièce, y compris au re-rendu d'un exemplaire
 * courant. Même mesure que `EMPREINTES_ARCHIVES` (commentaires et espaces ignorés).
 *
 * ⛔ Ne jamais mettre à jour une empreinte de cette table. Une évolution de style crée un
 * dossier `charte/v2` (et, pour chaque gabarit qui l'adopte, une nouvelle version archivée).
 */
const EMPREINTES_CHARTES: Readonly<Record<string, string>> = {
  "composants.tsx": "3161ef5454705d13df3d8a584e858a4c803b1edc7b51b993ab409891214afc6c",
  "couleurs.ts": "2bf575a228ce03d7bcf027a692b2d22a055956d4f0be7f9cc87ccd0a60e8c4e3",
  "index.ts": "edcf9558e5c55aed54571c639ca78dbc097bc12bb171778fb6625c76a7ae9428",
};

describe("⛔ le module de style charte/v1 est gelé", () => {
  const dossier = join(process.cwd(), "src", "server", "qualiopi", "documents", "charte", "v1");
  const empreinteCharte = (fichier: string): string =>
    createHash("sha256")
      .update(texteMesurable(readFileSync(join(dossier, fichier), "utf8")), "utf8")
      .digest("hex");

  it("🔑 chaque fichier non-test du dossier a son empreinte, et réciproquement", () => {
    const fichiers = readdirSync(dossier)
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.spec\.(ts|tsx)$/.test(f))
      .sort();
    expect(fichiers).toEqual(Object.keys(EMPREINTES_CHARTES).sort());
  });

  it("🔴 aucun fichier de charte/v1 n'a changé", () => {
    const modifies = Object.entries(EMPREINTES_CHARTES)
      .filter(([fichier, sha]) => empreinteCharte(fichier) !== sha)
      .map(([fichier]) => `${fichier} → ${empreinteCharte(fichier)}`);
    expect(
      modifies,
      "charte/v1 est GELÉ : annulez la modification, ou créez charte/v2 pour un nouveau style.",
    ).toEqual([]);
  });

  it("🔑 CONTRE-TÉMOIN : l'empreinte voit une couleur changée, pas un commentaire", () => {
    const source = readFileSync(join(dossier, "couleurs.ts"), "utf8");
    expect(texteMesurable(source.replace("#B23F16", "#B23F17"))).not.toBe(texteMesurable(source));
    expect(texteMesurable(source.replace("FIGÉES", "figées"))).toBe(texteMesurable(source));
  });
});
