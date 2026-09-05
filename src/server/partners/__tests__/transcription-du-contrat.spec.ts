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
    const ligne = readFileSync(path.join(RACINE, "contracts.sha256"), "utf8").trim();

    // Format `sha256sum` : « <hash>  <nom de fichier> ».
    expect(ligne).toMatch(/^[0-9a-f]{64} {2}contracts\.v1\.json$/);
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

  it("REQ-INT-004 — la liste est FERMÉE sur les sept types que le registre énumère", () => {
    // Le nombre est écrit ici À DESSEIN. `partners/ADR-0008` a tranché « sept, pas
    // onze » : quatre autres noms circulent au registre des exigences sans être
    // portés par la liste fermée de REQ-INT-004. Le jour où Partners republie à
    // onze, CETTE assertion rougit — et c'est le seul endroit du dépôt où la
    // décision de l'ADR redevient une question, ce qui est exactement où il faut
    // qu'elle soit posée.
    expect(TYPES_EVENEMENT).toHaveLength(7);
  });
});
