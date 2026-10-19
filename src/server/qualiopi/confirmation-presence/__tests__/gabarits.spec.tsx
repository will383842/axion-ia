import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@react-email/components";
import {
  QualiopiPresenceConfirmationEmail,
  qualiopiPresenceConfirmationSubject,
} from "@/lib/email/templates/qualiopi-presence-confirmation";
import {
  QualiopiPresenceEntrepriseEmail,
  qualiopiPresenceEntrepriseSubject,
} from "@/lib/email/templates/qualiopi-presence-entreprise";
import { EMAIL_TEMPLATE_NAMES } from "@/lib/email/templates";
import { estEmailQualiopiAutomatique } from "@/server/email/outbox-policy";

const DOSSIER = join(process.cwd(), "src/lib/email/templates");
const FICHIERS = ["qualiopi-presence-confirmation.tsx", "qualiopi-presence-entreprise.tsx"];

const PAYLOAD_CONFIRMATION = {
  stagiairePrenomNom: "Camille Dupont",
  titreFormation: "Piloter son activité avec l'IA",
  dateDebutFormation: "lundi 26 octobre 2026",
  lienPresence: "https://axion-ia.com/fr/portail/presence/jeton",
};

const PAYLOAD_ENTREPRISE = {
  contactNom: "Alex Martin",
  raisonSociale: "Atelier Lumen",
  stagiairePrenomNom: "Camille Dupont",
  titreFormation: "Piloter son activité avec l'IA",
  dateDebutFormation: "lundi 26 octobre 2026",
};

describe("gabarits de confirmation de présence", () => {
  it("sont enregistrés et partent seuls (P-12 étape 4)", () => {
    for (const nom of ["qualiopi-presence-confirmation", "qualiopi-presence-entreprise"]) {
      expect(EMAIL_TEMPLATE_NAMES as readonly string[]).toContain(nom);
      expect(estEmailQualiopiAutomatique(nom)).toBe(true);
    }
  });

  it("aucun fichier ne dit « certifié »", () => {
    for (const f of FICHIERS) {
      expect(readFileSync(join(DOSSIER, f), "utf8").toLowerCase()).not.toContain("certifi");
    }
  });

  it("la demande rend le lien en /fr/portail/presence/, la relance se distingue", async () => {
    const html = await render(
      <QualiopiPresenceConfirmationEmail locale="fr" payload={PAYLOAD_CONFIRMATION} />,
    );
    expect(html).toContain("/fr/portail/presence/jeton");
    expect(html.toLowerCase()).not.toContain("certifi");
    expect(html).not.toContain("/en/");
    const relance = await render(
      <QualiopiPresenceConfirmationEmail
        locale="fr"
        payload={{ ...PAYLOAD_CONFIRMATION, relance: true }}
      />,
    );
    expect(relance).not.toBe(html);
    expect(
      qualiopiPresenceConfirmationSubject("fr", { ...PAYLOAD_CONFIRMATION, relance: true }),
    ).toMatch(/rappel/i);
  });

  it("l'e-mail à l'entreprise ne porte ni motif ni donnée de santé", async () => {
    const html = await render(
      <QualiopiPresenceEntrepriseEmail locale="fr" payload={PAYLOAD_ENTREPRISE} />,
    );
    const texte = (
      html + qualiopiPresenceEntrepriseSubject("fr", PAYLOAD_ENTREPRISE)
    ).toLowerCase();
    for (const interdit of ["adapt", "handicap", "aménag", "amenag", "santé", "sante", "certifi"]) {
      expect(texte).not.toContain(interdit);
    }
    expect(html).toContain("pas confirmé sa présence à ce jour");
    expect(html).toContain("Camille Dupont");
  });
});
