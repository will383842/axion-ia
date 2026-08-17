/**
 * 🔴 Dire la vérité au clic — Lot 3quinquies §2.
 *
 * Deux écrans sur cinq annonçaient « envoyé » alors que l'e-mail attendait une
 * approbation dans la corbeille de validation. Un admin qui lit « Facture
 * envoyée » n'ira pas valider : la facture reste bloquée, le client ne reçoit
 * rien, et personne ne cherche.
 */

import { describe, expect, it } from "vitest";
import { messageEnvoi, type ResultatEnvoi } from "./message-envoi";

const NOTE =
  "L'email attend votre validation dans Emails → À valider ; il partira une fois approuvé.";

const r = (patch: Partial<ResultatEnvoi> = {}): ResultatEnvoi => ({
  enqueued: true,
  garePourValidation: false,
  to: "client@exemple.fr",
  ...patch,
});

describe("🔴 garé pour validation : l'écran ne dit PAS « envoyé »", () => {
  const m = messageEnvoi("Facture", r({ enqueued: false, garePourValidation: true, note: NOTE }));

  it("le ton n'est pas un succès", () => {
    expect(m.ton).toBe("attention");
  });

  it("le texte NE contient pas « envoyé »", () => {
    // Le cœur du défaut : « Facture envoyée à … » est un mensonge quand
    // l'e-mail attend une approbation humaine.
    expect(m.texte.toLowerCase()).not.toContain("envoyée à");
  });

  it("il DIT où l'e-mail attend", () => {
    expect(m.texte).toContain("À valider");
  });

  it("sans note, il le dit quand même — et nomme l'écran", () => {
    // 🔴 Le repli ne doit pas être muet : c'est le cas où l'action n'a rien
    // expliqué, donc celui où l'écran doit parler le plus.
    const sansNote = messageEnvoi("Devis", r({ enqueued: false, garePourValidation: true }));
    expect(sansNote.ton).toBe("attention");
    expect(sansNote.texte).toContain("n'est PAS parti");
    expect(sansNote.texte).toContain("Emails → À valider");
  });
});

describe("🔴 file indisponible : un TROISIÈME cas, pas un succès", () => {
  const m = messageEnvoi("Devis", r({ enqueued: false, garePourValidation: false }));

  it("ton d'attention", () => {
    expect(m.ton).toBe("attention");
  });

  it("il ne renvoie PAS vers la corbeille de validation", () => {
    // Confondre les deux enverrait valider une file vide — et le message
    // enverrait diagnostiquer au mauvais endroit, exactement le défaut que le
    // serveur avait déjà corrigé sans que l'écran le rende.
    expect(m.texte).not.toContain("À valider");
    expect(m.texte).toContain("réessayer plus tard");
  });
});

describe("🔴 envoi réel : le succès reste un succès", () => {
  it("ton de succès, destinataire nommé", () => {
    // ⚠️ La garde ne doit pas transformer tout envoi en avertissement : le cas
    // nominal doit rester lisible, sinon on apprend à ignorer le bandeau.
    const m = messageEnvoi("Facture", r());
    expect(m.ton).toBe("succes");
    expect(m.texte).toContain("client@exemple.fr");
  });

  it("une note sur un envoi RÉUSSI est quand même relayée", () => {
    // Cas réel : la signature attendue n'a pas été créée, l'e-mail est parti
    // SANS bouton « signer ». L'envoi a bien eu lieu — et il faut le dire.
    const note = "Devis envoyé, mais le lien de signature n'a pas pu être créé.";
    const m = messageEnvoi("Devis", r({ note }));
    expect(m.ton).toBe("succes");
    expect(m.texte).toBe(note);
  });
});

describe("🔴 la note de l'action l'emporte sur toute phrase inventée", () => {
  it.each([
    ["garé", { enqueued: false, garePourValidation: true }],
    ["file indisponible", { enqueued: false, garePourValidation: false }],
    ["envoyé", {}],
  ] as const)("%s : la note est relayée TELLE QUELLE", (_cas, patch) => {
    // 🔴 Deux phrases pour le même fait divergent, et c'est celle de l'écran —
    // la moins informée — qui gagnerait. L'action sait ce qui s'est passé ;
    // l'écran la relaie.
    const note = "Phrase exacte calculée par l'action.";
    expect(messageEnvoi("Devis", r({ ...patch, note })).texte).toBe(note);
  });
});
