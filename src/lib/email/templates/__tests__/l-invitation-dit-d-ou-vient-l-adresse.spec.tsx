/**
 * L'invitation à l'échange dit d'où vient l'adresse — art. 14 RGPD
 * (2026-09-19).
 *
 * Une personne recommandée par un tiers n'a jamais écrit à Axion-IA : le
 * premier message qu'elle reçoit doit lui dire comment on a eu son adresse, qui
 * traite ses données, pourquoi, combien de temps, et quels sont ses droits —
 * dont la réclamation auprès de la CNIL. Il ne peut donc pas commencer par
 * « Merci pour ton intérêt » : elle n'en a exprimé aucun.
 *
 * ⚠️ Les jobs enfilés AVANT ce changement n'ont pas de `provenance` : leur
 * rendu doit rester IDENTIQUE, octet pour octet (instantané pris avant la
 * modification du gabarit).
 */
import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";

import { ApporteurInvitationAppelEmail } from "../apporteur-invitation-appel";
import { IDENTITE_LEGALE } from "@/lib/identite-legale-ssot";

const CALENDLY = "https://calendly.com/axion-ia/echange-apporteur";

/** Texte visible, sans balises ni entités — ce que la personne lit. */
function texte(h: string): string {
  return h
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

/** L'année du pied de page change au 1er janvier : elle n'est pas l'objet de l'instantané. */
function sansAnnee(h: string): string {
  return h.replace(/©(?:\s|<!-- -->)*\d{4}/g, "© AAAA");
}

async function rendu(payload: Record<string, unknown>, locale: "fr" | "en" = "fr") {
  return render(<ApporteurInvitationAppelEmail locale={locale} payload={payload} />);
}

describe("invitation — provenance indirecte (recommandation, autre)", () => {
  const PAYLOAD = {
    contactName: "Nadia Ben",
    calendlyUrl: CALENDLY,
    provenance: { mode: "indirecte", libelle: "par une personne qui te recommande" },
  };

  it("🔴 ne remercie pas d'un intérêt jamais exprimé, et dit d'où vient l'adresse", async () => {
    const t = texte(await rendu(PAYLOAD));
    expect(t).not.toContain("Merci pour ton intérêt");
    expect(t).toContain("Nous avons ton adresse par une personne qui te recommande.");
  });

  it("🔴 nomme le responsable, la finalité, la durée, les droits et la CNIL", async () => {
    const h = await rendu(PAYLOAD);
    const t = texte(h);
    expect(t).toContain(IDENTITE_LEGALE.legalName);
    expect(t).toContain(IDENTITE_LEGALE.ville);
    expect(t).toContain("24 mois");
    expect(t).toMatch(/accès.*rectification.*effacement.*opposition/);
    expect(t).toContain("CNIL");
    expect(h).toContain("/fr/politique-confidentialite");
    expect(t).toContain("un clic suffit");
  });

  it("la version anglaise porte les mêmes informations", async () => {
    const t = texte(
      await rendu(
        {
          ...PAYLOAD,
          provenance: { mode: "indirecte", libelle: "from someone who recommends you" },
        },
        "en",
      ),
    );
    expect(t).not.toContain("Thank you for your interest");
    expect(t).toContain("We have your address from someone who recommends you.");
    expect(t).toContain("CNIL");
    expect(t).toContain("24 months");
  });
});

describe("invitation — provenance directe", () => {
  it("dit comment la personne a donné son adresse", async () => {
    const t = texte(
      await rendu({
        contactName: "Nadia",
        calendlyUrl: CALENDLY,
        provenance: { mode: "directe", libelle: "par e-mail" },
      }),
    );
    expect(t).toContain("Tu nous as donné ton adresse par e-mail.");
  });
});

describe("invitation — jobs anciens, sans provenance", () => {
  it("🔴 rendu identique à celui d'avant le changement (FR)", async () => {
    const h = await rendu({
      contactName: "Nadia Ben",
      calendlyUrl: CALENDLY,
      dossierUrl: "https://axion-ia.com/fr/devenir-commercial-ia/candidature",
    });
    expect(sansAnnee(h)).toMatchSnapshot();
  });

  it("🔴 rendu identique à celui d'avant le changement (EN)", async () => {
    const h = await rendu({ contactName: "Nadia", calendlyUrl: CALENDLY }, "en");
    expect(sansAnnee(h)).toMatchSnapshot();
  });
});
