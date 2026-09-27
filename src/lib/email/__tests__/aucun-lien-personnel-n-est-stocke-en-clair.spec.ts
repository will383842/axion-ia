// @vitest-environment node
/**
 * 🔴 La copie d'un e-mail envoyé ne garde AUCUN lien personnel en clair
 * (2026-09-27).
 *
 * La console montre l'e-mail tel qu'il est parti. Un lien de signature, un
 * lien d'émargement, un lien magique de connexion, le lien d'export RGPD ou le
 * lien d'opposition signé du pied de page VALENT un geste : lisibles dans la
 * console, ils permettraient de signer, émarger ou se connecter à la place du
 * destinataire. `masquerSecretsEmail` les masque avant l'écriture.
 *
 * ## Pourquoi ce test balaie TOUS les gabarits
 *
 * Une liste de « gabarits à secret » écrite ici vieillirait : le lien
 * d'opposition, ajouté au châssis après coup, aurait échappé à toute liste
 * antérieure. On lit donc le REGISTRE (`EMAIL_TEMPLATE_NAMES`) et on rend
 * chaque gabarit avec des liens personnels réalistes, chacun porteur d'un
 * marqueur unique. Un gabarit ajouté demain est couvert sans y penser.
 *
 * Témoin positif : les marqueurs sont bien PRÉSENTS dans le rendu brut
 * (sinon « aucun marqueur après masquage » serait satisfait par un rendu qui
 * n'en contient aucun).
 */

import { beforeAll, describe, expect, it } from "vitest";

import { EMAIL_TEMPLATE_NAMES, renderEmailTemplate } from "@/lib/email/templates";
import { PAYLOAD_EXEMPLE } from "@/server/email/apercu/payloads-exemple";
import { jetonOpposition } from "@/server/email/opposition-jeton";
import {
  MASQUE_SECRET,
  aFormeDeJeton,
  masquerSecretsEmail,
  masquerSecretsTexte,
} from "@/lib/email/masquer-secrets";

const DESTINATAIRE = "camille.dupont@example.invalid";

/** Un jeton réaliste (base64url, 32 caractères) portant un numéro lisible. */
const marqueur = (n: number): string =>
  `Qz${String(n).padStart(3, "0")}xK9vB2nL5tR7yUw4mP8sD1fG6hJ`;

/** Les formes réelles de liens personnels du dépôt. */
const FORMES = [
  (m: string) => `https://axion-ia.com/portail/signer/${m}`,
  (m: string) => `https://axion-ia.com/portail/emarger/${m}`,
  (m: string) => `https://axion-ia.com/formateur/connexion/${m}`,
  (m: string) => `https://axion-ia.com/api/guide-ia/telecharger?t=${encodeURIComponent(m)}`,
  (m: string) => `https://axion-ia.com/fr/confirmation/newsletter?token=${m}`,
  (m: string) => `https://checkout.stripe.com/c/pay/cs_live_${m}#fidkdWxOYHwnPyd1blpxYHZxWjA0`,
] as const;

const marqueurs: string[] = [];
let payload: Record<string, unknown>;

beforeAll(() => {
  process.env["AUTH_SECRET"] ??= "secret-de-test-suffisamment-long-0123456789";
  payload = { ...PAYLOAD_EXEMPLE };
  let n = 0;
  for (const [cle, valeur] of Object.entries(PAYLOAD_EXEMPLE)) {
    if (valeur === "https://exemple.invalid/lien-de-demonstration") {
      n += 1;
      const m = marqueur(n);
      marqueurs.push(m);
      payload[cle] = FORMES[n % FORMES.length]!(m);
    } else if (valeur === "jeton-de-demonstration") {
      n += 1;
      const m = marqueur(n);
      marqueurs.push(m);
      payload[cle] = m;
    }
  }
});

describe("masquerSecretsTexte — la règle", () => {
  it("masque un segment de chemin qui a la forme d'un jeton, garde le chemin lisible", () => {
    const { sortie, masques } = masquerSecretsTexte(
      'href="https://axion-ia.com/portail/signer/aB3dE5fG7hJ9kL1mN3pQ5rS7"',
    );
    expect(sortie).toBe(`href="https://axion-ia.com/portail/signer/${MASQUE_SECRET}"`);
    expect(masques).toBe(1);
  });

  it("masque la valeur d'un paramètre nommé `token`, même courte, et garde les autres", () => {
    const { sortie } = masquerSecretsTexte(
      "https://axion-ia.com/api/unsubscribe?token=abc&amp;utm_source=email",
    );
    expect(sortie).toBe(
      `https://axion-ia.com/api/unsubscribe?token=${MASQUE_SECRET}&amp;utm_source=email`,
    );
  });

  it("masque un UUID (ressource nominative) et un lien de visioconférence", () => {
    expect(
      masquerSecretsTexte("https://calendly.com/cancellations/3f2a9c1e-8b7d-4e6f-a5c4-1b2d3e4f5a6b")
        .sortie,
    ).toBe(`https://calendly.com/cancellations/${MASQUE_SECRET}`);
    expect(masquerSecretsTexte("https://meet.google.com/abc-defg-hij").sortie).toBe(
      `https://meet.google.com/${MASQUE_SECRET}`,
    );
  });

  it("témoin : un lien PUBLIC reste intact — slug, ancre courte, lien Calendly de réservation", () => {
    const publics = [
      "https://axion-ia.com/fr/politique-confidentialite#reseau-d-apporteurs-d-affaires",
      "https://calendly.com/axion-ia/echange-apporteur-15-min",
      "https://axion-ia.com/fr/devenir-commercial-ia/candidature",
      "https://axion-ia.com/documents/catalogue-formations-2026.pdf",
    ];
    for (const url of publics) {
      const r = masquerSecretsTexte(url);
      // L'ancre de la politique dépasse 8 caractères : elle est masquée par
      // prudence (Stripe range sa session dans le fragment). Le CHEMIN reste.
      expect(r.sortie.split("#")[0]).toBe(url.split("#")[0]);
    }
    expect(aFormeDeJeton("formation-intelligence-artificielle")).toBe(false);
  });

  it("est idempotent : masquer deux fois ne change rien", () => {
    const une = masquerSecretsTexte(
      "https://axion-ia.com/portail/signer/aB3dE5fG7hJ9kL1mN3pQ5rS7?t=x",
    );
    const deux = masquerSecretsTexte(une.sortie);
    expect(deux.sortie).toBe(une.sortie);
    expect(deux.masques).toBe(0);
  });
});

describe("🔴 aucun gabarit du registre ne laisse un lien personnel en clair dans sa copie", () => {
  it("le rendu BRUT contient bien les liens personnels (témoin positif)", async () => {
    let gabaritsAvecSecret = 0;
    for (const nom of EMAIL_TEMPLATE_NAMES) {
      const r = await renderEmailTemplate(nom, "fr", payload, { destinataire: DESTINATAIRE });
      const brut = r.html + r.text;
      if (marqueurs.some((m) => brut.includes(m))) gabaritsAvecSecret += 1;
    }
    // Mesuré le 2026-09-27 : plus de la moitié des gabarits portent au moins un
    // lien personnel issu de la charge. Sous 15, la charge d'essai ne teste plus rien.
    expect(gabaritsAvecSecret).toBeGreaterThanOrEqual(15);
  }, 60_000);

  it("après masquage : aucun marqueur, aucun jeton d'opposition, dans aucun gabarit", async () => {
    const jeton = jetonOpposition(DESTINATAIRE);
    const fuites: string[] = [];
    let oppositionsVues = 0;
    for (const nom of EMAIL_TEMPLATE_NAMES) {
      const r = await renderEmailTemplate(nom, "fr", payload, { destinataire: DESTINATAIRE });
      const brut = r.html + r.text;
      if (brut.includes(encodeURIComponent(jeton)) || brut.includes(jeton)) oppositionsVues += 1;
      const copie = masquerSecretsEmail(r);
      const stocke = copie.subject + copie.html + copie.text;
      for (const m of marqueurs) {
        if (stocke.includes(m)) fuites.push(`${nom} : ${m}`);
      }
      if (stocke.includes(jeton) || stocke.includes(encodeURIComponent(jeton))) {
        fuites.push(`${nom} : jeton d'opposition`);
      }
    }
    expect(fuites).toEqual([]);
    // Témoin : le lien d'opposition signé figure bien dans les familles B, C, D.
    expect(oppositionsVues).toBeGreaterThan(10);
  }, 60_000);
});
