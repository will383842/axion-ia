/**
 * Garde RGPD article 9 sur `SignaturePad` — vérifiée sur le CODE, pas par revue.
 *
 * La CNIL qualifie la dynamique de tracé (pression, vitesse, timing,
 * inclinaison) de caractéristique biométrique comportementale. La capturer ferait
 * basculer tout le dispositif d'émargement sous l'article 9 : interdiction de
 * principe, analyse d'impact probable. Le tracé rasterisé reste, lui, une donnée
 * personnelle ordinaire (article 6).
 *
 * Or `PointerEvent` expose ces champs à portée de main. Ajouter `e.pressure`
 * pour épaissir un trait est une modification d'une ligne, elle passerait
 * n'importe quelle relecture distraite, et elle changerait le régime juridique
 * du produit sans que personne ne s'en aperçoive.
 *
 * ⚠️ Ce test lit le FICHIER SOURCE. C'est volontaire, et c'est le seul angle qui
 * marche : un test de rendu ne peut pas prouver l'ABSENCE d'une capture, il ne
 * peut qu'observer ce qui est émis dans le scénario qu'on a imaginé. Ici on
 * vérifie que le vecteur n'existe pas du tout.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = readFileSync(join(__dirname, "SignaturePad.tsx"), "utf8");

/** Le code du composant, commentaires retirés — c'est lui seul qui s'exécute. */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("SignaturePad — aucune capture de dynamique de tracé", () => {
  it.each([
    ["pressure", /\bpressure\b/],
    ["tiltX", /\btiltX\b/],
    ["tiltY", /\btiltY\b/],
    ["twist", /\btwist\b/],
    ["tangentialPressure", /\btangentialPressure\b/],
    ["timeStamp", /\btimeStamp\b/],
    ["pointerType", /\bpointerType\b/],
    ["width (surface de contact)", /\be\.width\b/],
    ["height (surface de contact)", /\be\.height\b/],
  ])("ne lit jamais %s", (_, motif) => {
    expect(CODE).not.toMatch(motif);
  });

  it.each([
    ["Date.now", /\bDate\.now\b/],
    ["performance.now", /\bperformance\.now\b/],
    ["new Date", /new\s+Date\b/],
  ])("ne mesure aucun temps (%s)", (_, motif) => {
    // Un horodatage par point suffirait à reconstituer la vitesse du tracé.
    expect(CODE).not.toMatch(motif);
  });

  it("ne conserve AUCUN historique de points", () => {
    // Un tableau de points EST la dynamique, même sans horodatage : l'espacement
    // entre points échantillonnés à fréquence fixe encode la vitesse.
    expect(CODE).not.toMatch(/points\s*[:=]/);
    expect(CODE).not.toMatch(/\.push\(/);
    expect(CODE).not.toMatch(/traces?\s*[:=]\s*\[/);
  });

  it("la SEULE sortie est une image rasterisée", () => {
    const sorties = CODE.match(/onChange\([^)]*\)/g) ?? [];
    expect(sorties.length).toBeGreaterThan(0);
    for (const s of sorties) {
      // `onChange(null)` (effacement) ou `onChange(<…>.toDataURL("image/png"))`.
      expect(s === "onChange(null)" || s.includes('toDataURL("image/png")')).toBe(true);
    }
  });

  it("ne produit pas d'image à chaque mouvement — ce serait la vitesse, indirectement", () => {
    // Émettre à chaque `pointermove` encoderait la cadence du tracé dans la
    // suite des appels réseau, même si chaque image est nue.
    const tracer = CODE.slice(CODE.indexOf("function tracer"), CODE.indexOf("function terminer"));
    expect(tracer).not.toMatch(/onChange\(/);
  });

  it("informe le signataire de ce qui n'est PAS mesuré", () => {
    // L'information est due, et elle doit être exacte : c'est aussi ce qui rend
    // la promesse vérifiable par l'utilisateur lui-même.
    expect(SOURCE).toMatch(/ni la pression, ni la vitesse/i);
  });
});
