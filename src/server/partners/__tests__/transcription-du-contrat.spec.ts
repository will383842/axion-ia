/**
 * REQ-QA-007 — la transcription du contrat, tenue par une empreinte.
 *
 * Le contrat d'événements est PUBLIÉ par Axion Partners
 * (`packages/contracts/contracts.v1.json`, dérivé là-bas par `pnpm contracts:export`).
 * Ce dépôt en détient une COPIE OCTET POUR OCTET, jamais une retranscription :
 * REQ-QA-007 exige « un schéma Zod versionné transcrit à l'identique dans les deux
 * dépôts, avec un test de transcription datée de chaque côté ». Ce fichier est le
 * test de transcription du CÔTÉ AXIONIA.
 *
 * 🔑 Ce que ce test attrape, et qu'aucune relecture humaine n'attrape : une copie
 * MODIFIÉE. Un développeur qui « corrige » un champ dans la copie locale plutôt que
 * dans le descripteur de Partners fabrique deux contrats qui portent le même numéro
 * de version. L'empreinte est le seul instrument qui rende cette divergence visible.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CHAMPS_ENVELOPPE, SCHEMA_VERSION, TYPES_EVENEMENT } from "../contrat";
import { cheminContratPublie, empreinteContratPublie } from "../contrat/empreinte";

const RACINE = path.resolve(__dirname, "..", "contrat");

describe("REQ-QA-007 — transcription du contrat d'événements", () => {
  it("la copie du JSON Schema publié est INTACTE : son empreinte est celle que Partners a publiée", () => {
    const octets = readFileSync(cheminContratPublie());
    const calculee = createHash("sha256").update(octets).digest("hex");

    expect(calculee).toBe(empreinteContratPublie());
  });

  it("l'empreinte SAIT rougir : un seul octet changé dans la copie la fait diverger", () => {
    // Contre-témoin. Sans lui, `empreinteContratPublie()` pourrait retourner le
    // hash RECALCULÉ du fichier et l'assertion précédente serait une tautologie
    // verte quoi qu'il arrive.
    const octets = readFileSync(cheminContratPublie(), "utf8");
    const mute = octets.replace('"event_id"', '"eventId"');

    expect(mute).not.toBe(octets); // le mutant a bien mordu
    expect(createHash("sha256").update(mute, "utf8").digest("hex")).not.toBe(
      empreinteContratPublie(),
    );
  });

  it("l'empreinte attendue est LUE dans le fichier `.sha256` de Partners, pas écrite en dur ici", () => {
    // INT-T72-A : la PREMIÈRE ligne est celle du contrat publié ; les suivantes (la chaîne canonique
    // de la relecture et ses vecteurs) s'ajoutent après elle, et `empreinteContratPublie` lit la première.
    const ligne = readFileSync(path.join(RACINE, "contracts.sha256"), "utf8").split("\n")[0]!;

    // Format `sha256sum` : « <hash>  <nom de fichier> ».
    expect(ligne).toMatch(/^[0-9a-f]{64} {2}contracts\.v2\.json$/);
    expect(ligne.slice(0, 64)).toBe(empreinteContratPublie());
  });

  it("la liste des types est DÉRIVÉE du JSON publié — ce dépôt n'en retape aucun", () => {
    const publie = JSON.parse(readFileSync(cheminContratPublie(), "utf8")) as {
      properties: { event_type: { enum: string[] }; schema_version: { const: number } };
      required: string[];
    };

    expect([...TYPES_EVENEMENT]).toEqual(publie.properties.event_type.enum);
    expect(SCHEMA_VERSION).toBe(publie.properties.schema_version.const);
    expect([...CHAMPS_ENVELOPPE]).toEqual(publie.required);
  });

  it("REQ-INT-004 — la liste est FERMÉE sur les onze types du contrat v2", () => {
    // Le nombre est écrit ici À DESSEIN. Sept en v1 (`partners/ADR-0008`), onze depuis la
    // `schema_version` 2 publiée par INT-T01c : les quatre noms recensés hors contrat y
    // sont entrés. Un douzième type publié par Partners fait rougir CETTE assertion, et
    // c'est ici que la question doit se poser.
    expect(TYPES_EVENEMENT).toHaveLength(11);
  });
});
