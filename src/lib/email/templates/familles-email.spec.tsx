/**
 * Garde du référentiel e-mail — les règles qui doivent ROUGIR si elles cassent.
 *
 * ── POURQUOI CETTE SUITE EXISTE ─────────────────────────────────────────────
 *
 * Le 2026-08-31, un audit des 44 gabarits face au « Référentiel e-mail AXION IA
 * v1.0 » a relevé des défauts qu'aucun test ne voyait, parce qu'aucun test ne
 * les regardait :
 *
 *   • 24 gabarits sur 44 passaient `preview={t.title}` — le pré-en-tête
 *     répétait l'objet mot pour mot, c'est-à-dire n'existait pas (§3.5) ;
 *   • 27 gabarits ouvraient leur corps par « Bonjour {prénom}, » isolé, ce qui
 *     donne aux résumés d'Apple Intelligence / Gemini / Copilot une salutation
 *     à résumer et rien d'autre (§3.6) ;
 *   • tous les objets portaient le suffixe « — Axion-IA », déjà présent dans le
 *     nom d'expéditeur, qui consommait 11 des 45 caractères lisibles (§3.4) ;
 *   • `payment-receipt` — un REÇU — portait un bloc de demande d'avis et quatre
 *     liens sociaux, interdits en famille A (§5.1 règle 3).
 *
 * Chacun de ces défauts est individuellement mineur et collectivement décisif :
 * ils portent sur ce que le destinataire voit dans la première seconde et demie.
 * Et chacun revient dès qu'on écrit un 45ᵉ gabarit sans y penser.
 *
 * ── CE QUE CETTE SUITE NE FAIT PAS ──────────────────────────────────────────
 *
 * Elle ne porte PAS sa propre liste de gabarits ni sa propre table des
 * familles. Elle lit `EMAIL_TEMPLATE_NAMES` (le registre réel) et DÉDUIT la
 * famille du HTML rendu. Une garde qui recopie la liste qu'elle surveille finit
 * par surveiller sa copie : le gabarit ajouté hier n'y figure pas, et la suite
 * reste verte en ne regardant rien.
 */

import { describe, it, expect } from "vitest";
import { renderEmailTemplate, EMAIL_TEMPLATE_NAMES } from "./index";
import { REGIME_FAMILLE, type FamilleEmail } from "./_layout";
import { OBJET_MAX } from "../objet-email";
import { EMAIL_LEGAL } from "../legal-footer";

/**
 * Charge d'essai. L'intitulé de formation est VOLONTAIREMENT long (52
 * caractères) : c'est la variable qui faisait exploser les objets, et un test
 * qui la choisit courte mesure une situation qui n'arrive pas. Le vrai
 * catalogue porte « Prompt engineering et automatisations métier » et plus long
 * encore.
 */
const TITRE_LONG = "Intelligence artificielle appliquée aux PME et ETI";

const PAYLOAD: Record<string, unknown> = {
  contactName: "Jean Dupont",
  stagiairePrenomNom: "Marie Leroy",
  destinataireNom: "Sophie Martin",
  contactNom: "Paul Bernard",
  prenom: "Jean",
  nom: "Dupont",
  ville: "Grenoble",
  leaderName: "Claire Petit",
  companyName: "INVEST SUN",
  raisonSociale: "INVEST SUN",
  city: "Lyon",
  invoiceNumber: "F-2026-0001",
  numeroFacture: "F-2026-0001",
  numero: "AXI-FACT-2026-042",
  amountTtc: "1 200,00 €",
  montantDu: "1 200,00 €",
  montantLabel: "2 940,00 € TTC",
  savedEurPerYear: 48000,
  savedHoursPerYear: 1200,
  fteRecovered: 0.8,
  topTasks: [],
  sectorLabel: "industrie",
  headcount: 42,
  titreFormation: TITRE_LONG,
  intituleFormation: TITRE_LONG,
  libelleQuestionnaire: "questionnaire de satisfaction",
  slotTitre: "Programme de formation",
  interventionLabel: "Session Grenoble",
  familleLabel: "Supports",
  version: 3,
  typeDocument: "attestation",
  numeroSession: "S-2026-014",
  dateDebut: "14/09/2026",
  dateFin: "15/09/2026",
  dateDebutFormation: "14/09/2026",
  dateFinFormation: "15/09/2026",
  dateEcheance: "20/08/2026",
  dateEcheanceLabel: "20/08/2026",
  dateValiditeLabel: "30/09/2026",
  joursRetard: 11,
  lieu: "Grenoble",
  modalite: "présentiel",
  niveau: "critique",
  code: "FACTURE_IMPAYEE",
  // Titre d'alerte VOLONTAIREMENT long : avec « Facture impayée » (15
  // caractères), la garde ne voyait pas que `qualiopi-alerte-interne`
  // atteignait 87 caractères sur un cas réel. Une charge d'essai trop douce
  // mesure une situation qui n'arrive pas.
  titre: "Facture arrivée à échéance sans règlement",
  guichet: "Administration",
  date: "mardi 2 septembre",
  heure: "14:00",
  dureeMinutes: 30,
  moment: "confirmation",
  subject: "Votre demande",
  bodyMarkdown: "Bonjour,\n\nMerci de votre message.",
  signature: "Williams\nAxion-IA",
  telephone: "+33 6 12 34 56 78",
  paidAt: "13/05/2026",
  paymentType: "deposit",
  bookingId: "00000000-0000-0000-0000-000000000001",
  submissionId: "00000000-0000-0000-0000-000000000002",
  cadrageId: "00000000-0000-0000-0000-000000000003",
  expiresHours: 24,
  expiresAt: "15/09/2026",
  effectueLe: "31/08/2026",
  reference: "RGPD-2026-004",
  deposeeLe: "31/08/2026",
  type: "suppression",
  demandes: 2,
  newsletter: 1,
  conversations: 3,
  candidatures: 1,
  appels: 1,
  offre: "Commercial indépendant",
  dateCandidature: "12/08/2026",
  oppositionUrl: "https://axion-ia.com/fr/opposition/AAA",
  joursOpposition: 30,
  magicLink: "https://axion-ia.com/espace-formateur/connexion/AAA",
  signatureUrl: "https://axion-ia.com/fr/portail/signer/AAA",
  checkoutUrl: "https://checkout.stripe.com/c/pay/AAA",
  retryUrl: "https://checkout.stripe.com/c/pay/BBB",
  reportUrl: "https://axion-ia.com/fr/simulateur/rapport/AAA",
  lienPortail: "https://axion-ia.com/fr/portail/acces/AAA",
  lienQuestionnaire: "https://axion-ia.com/fr/portail/acces/AAA",
  lienEnquete: "https://axion-ia.com/fr/portail/acces/AAA",
  lienEmargement: "https://axion-ia.com/fr/portail/acces/BBB",
  lienFacture: "https://axion-ia.com/fr/portail/acces/CCC",
  interventionType: "essentielle",
  notes: "Alerte rouge météo.",
  refundPercentage: 50,
  contexte: "question",
  clientNom: "INVEST SUN",
  signataireNom: "Simone Blanc",
  auditType: "express",
  implType: "automatisation",
  rows: [],
  experiences: [],
};

const LOCALES = ["fr", "en"] as const;

/** Déduit la famille du HTML rendu, sans recopier de table de correspondance. */
function familleDe(html: string): FamilleEmail {
  // Le pied RÉDUIT du §6.3 est l'empreinte propre de la famille A : lui seul
  // porte « envoyé automatiquement suite à une action » / « sent automatically
  // following an action », et lui seul omet la rangée sociale.
  if (html.includes("automatiquement suite") || html.includes("automatically following")) {
    return "A";
  }
  // B et D portent les quatre profils ; C n'en porte qu'un, la page entreprise.
  if (html.includes("facebook.com")) return "B";
  return "C";
}

/** Normalise pour comparer deux libellés sans buter sur la casse ou l'accent. */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Décode les entités que React Email pose dans le HTML rendu.
 *
 * Sans ça, un pré-en-tête contenant une apostrophe arrive sous la forme
 * `l&#x27;objet` et ne peut PAS être comparé au libellé d'origine : la garde
 * passerait au vert sur une répétition parfaite, faute de savoir la lire.
 */
function decodeEntites(s: string): string {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2F;/g, "/");
}

/** Toutes les URL DISTINCTES du message (cf. `budgetLiens` dans `_layout`). */
function liensDistincts(html: string): Set<string> {
  return new Set((html.match(/href="([^"]+)"/g) ?? []).map((h) => h.slice(6, -1)));
}

/**
 * Objets dont le dépassement de `OBJET_MAX` est DÉLIBÉRÉ, avec sa raison.
 *
 * 🔑 La liste porte un motif, pas seulement un nom. Une dérogation sans raison
 * écrite est une dérogation que personne ne saura rouvrir — et au premier
 * gabarit ajouté, la tentation sera d'y glisser le nouveau nom plutôt que de
 * raccourcir l'objet.
 */
const OBJETS_HORS_BORNE: Record<string, string> = {
  "vivier-information":
    "Notice juridique dont le texte est validé (doctrine CNIL « CVthèque ») : " +
    "sa reformulation fabriquerait un second texte non validé, sur lequel " +
    "reposerait la licéité d'un traitement. Tronqué sur mobile, l'objet reste " +
    "compréhensible (« Votre candidature chez Axion-IA — conservatio… »).",
  "candidature-commercial-recap":
    "E-mail INTERNE à l'équipe. Le préfixe « [CANDIDATURE COMMERCIAL] » est une " +
    "étiquette de filtrage de boîte, pas une accroche : il doit rester entier.",
};

describe("Référentiel e-mail — objet (§3.4)", () => {
  for (const name of EMAIL_TEMPLATE_NAMES) {
    for (const locale of LOCALES) {
      it(`${name} (${locale}) : objet ≤ ${OBJET_MAX} caractères`, async () => {
        const { subject } = await renderEmailTemplate(name, locale, PAYLOAD);
        const derogation = OBJETS_HORS_BORNE[name];
        if (derogation !== undefined) {
          expect(subject.length, `${name} : dérogation enregistrée — ${derogation}`).toBeLessThan(
            80,
          );
          return;
        }
        expect(
          subject.length,
          `Objet de ${subject.length} caractères : « ${subject} ». Au-delà de ` +
            `${OBJET_MAX}, il est tronqué sur mobile — et c'est sur ce qu'il en ` +
            `reste que le destinataire décide d'ouvrir. Composer l'objet avec ` +
            `objetCompose() plutôt que d'interpoler une variable libre.`,
        ).toBeLessThanOrEqual(OBJET_MAX);
      });

      it(`${name} (${locale}) : objet sans suffixe de marque ni majuscules criées`, async () => {
        const { subject } = await renderEmailTemplate(name, locale, PAYLOAD);
        // Le nom d'expéditeur porte déjà « Axion-IA » : le répéter dans l'objet
        // coûte 11 des 45 caractères lisibles sans rien apprendre à personne.
        expect(subject, `« ${subject} » : suffixe de marque redondant`).not.toMatch(
          /[—·-]\s*Axion-IA\s*$/,
        );
        // §3.4 : ni majuscules intégrales, ni point d'exclamation.
        expect(subject, `« ${subject} » : point d'exclamation en objet`).not.toContain("!");
      });
    }
  }
});

describe("Référentiel e-mail — pré-en-tête (§3.5)", () => {
  for (const name of EMAIL_TEMPLATE_NAMES) {
    for (const locale of LOCALES) {
      it(`${name} (${locale}) : pré-en-tête présent, distinct de l'objet ET du titre`, async () => {
        const { subject, html } = await renderEmailTemplate(name, locale, PAYLOAD);
        // React Email rend le pré-en-tête dans un bloc masqué en tête de <body>.
        const m = html.match(/data-skip-in-text="true"[^>]*>([^<]*)/);
        expect(m, `${name} : aucun bloc de pré-en-tête rendu`).not.toBeNull();
        const preview = decodeEntites((m?.[1] ?? "").trim());

        expect(
          preview.length,
          `${name} : pré-en-tête vide — Gmail affiche alors le début du HTML`,
        ).toBeGreaterThan(0);

        /*
         * 🔴 Cette garde ne comparait au départ qu'à l'OBJET, et CINQ gabarits
         * sont passés au travers : `payment-failed`, `qualiopi-convocation`,
         * `podcast-demande-recue`, `rgpd-effacement-confirme` et
         * `candidature-commercial-recap` ont un objet distinct du titre — mais
         * leur pré-en-tête recopiait le TITRE.
         *
         * Le défaut ne s'est vu qu'en regardant la console d'administration,
         * qui affiche l'aperçu tel qu'un client de messagerie le rendra. Une
         * garde qui ne compare qu'à une des deux chaînes laisse passer la
         * moitié des cas : on compare désormais aux deux.
         */
        const titre = decodeEntites(
          (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "").replace(/<[^>]+>/g, ""),
        ).trim();

        for (const [quoi, valeur] of [
          ["l'objet", subject],
          ["le titre", titre],
        ] as const) {
          if (valeur.trim() === "") continue;
          expect(
            norm(preview),
            `${name} : le pré-en-tête répète ${quoi} (« ${preview} »). Il le ` +
              `PROLONGE — l'objet dit quoi, le pré-en-tête dit l'échéance, le ` +
              `montant, le délai. Le répéter, c'est n'en avoir aucun.`,
          ).not.toBe(norm(valeur));
        }
      });
    }
  }
});

describe("Référentiel e-mail — régime de famille (§2.5, §5.1, §5.4)", () => {
  for (const name of EMAIL_TEMPLATE_NAMES) {
    it(`${name} (fr) : respecte le régime de sa famille`, async () => {
      const { html } = await renderEmailTemplate(name, "fr", PAYLOAD);
      const famille = familleDe(html);
      const regime = REGIME_FAMILLE[famille];

      // ── Budget de liens (§5.4) ──────────────────────────────────────────
      const liens = liensDistincts(html);
      expect(
        liens.size,
        `${name} (famille ${famille}) : ${liens.size} liens distincts pour un ` +
          `budget de ${regime.budgetLiens}. Au-delà, deux effets mesurables — ` +
          `dilution de l'attention, et hausse du classement en spam (le ratio ` +
          `liens/texte est un critère de filtrage). Liens : ${[...liens].join(", ")}`,
      ).toBeLessThanOrEqual(regime.budgetLiens);

      // ── Partage et preuve sociale (§5.1 règle 3) ────────────────────────
      if (!regime.partage) {
        expect(html, `${name} : bloc de parrainage interdit en famille ${famille}`).not.toContain(
          "Partager sur LinkedIn",
        );
        expect(html, `${name} : demande d'avis interdite en famille ${famille}`).not.toContain(
          "Laisser un avis",
        );
      }

      // ── Réseaux sociaux (§2.5) ──────────────────────────────────────────
      if (regime.reseauxSociaux === "aucun") {
        expect(html, `${name} : aucun réseau social en famille A`).not.toContain("linkedin.com");
        expect(html, `${name} : aucun réseau social en famille A`).not.toContain("facebook.com");
      }

      // ── Soupape de réponse (§4.3) ───────────────────────────────────────
      // ⛔ Jamais en famille A : un e-mail de sécurité doit avoir exactement un
      // lien et zéro distraction. C'est ce dépouillement qu'on apprend aux gens
      // à reconnaître comme la marque d'un vrai message de sécurité.
      // Lot 4 : un gabarit qui tutoie (tunnel commercial) reçoit la soupape au
      // tutoiement — même phrase, même place, autre personne grammaticale.
      const soupape = /R(?:épondez|éponds) simplement à cet e-mail/;
      if (regime.soupapeReponse) {
        expect(html, `${name} : soupape de réponse attendue en famille ${famille}`).toMatch(
          soupape,
        );
      } else {
        expect(html, `${name} : soupape de réponse interdite en famille A`).not.toMatch(soupape);
      }

      // ── Désabonnement (§2.5) ────────────────────────────────────────────
      // On ne se désabonne pas d'une facture ni d'une alerte de sécurité.
      if (famille === "A") {
        expect(html, `${name} : pas de désabonnement en famille A`).not.toContain("Se désabonner");
      }
    });
  }
});

describe("Référentiel e-mail — mentions légales et expéditeur", () => {
  for (const name of EMAIL_TEMPLATE_NAMES) {
    it(`${name} (fr) : identité légale complète en pied (LCEN art. 1-1)`, async () => {
      const { html } = await renderEmailTemplate(name, "fr", PAYLOAD);
      // 🔴 Ces trois valeurs venaient de `process.env.COMPANY_*`, dont le repli
      // était la CHAÎNE VIDE, filtrée en silence. Le worker qui rend et envoie
      // les e-mails est une application Coolify DISTINCTE, avec son propre
      // environnement : une identité correcte sur le site ne prouvait rien sur
      // ce que recevaient les destinataires.
      expect(html, `${name} : raison sociale absente du pied`).toContain(EMAIL_LEGAL.legalName);
      expect(html, `${name} : adresse du siège absente du pied`).toContain("ELITE BUREAUX");
      expect(html, `${name} : identifiant SIREN absent du pied`).toContain(EMAIL_LEGAL.siren);
    });

    it(`${name} (fr) : aucune adresse noreply@ visible (§3.2)`, async () => {
      const { html, text } = await renderEmailTemplate(name, "fr", PAYLOAD);
      for (const [ou, contenu] of [
        ["html", html],
        ["texte", text],
      ] as const) {
        expect(
          contenu.toLowerCase(),
          `${name} (${ou}) : « noreply@ » ferme la porte au destinataire au ` +
            `moment exact où il a besoin d'aide, et les fournisseurs de ` +
            `messagerie le lisent comme un signal négatif.`,
        ).not.toContain("noreply@");
      }
    });
  }
});

describe("Référentiel e-mail — poids du message (§8)", () => {
  /**
   * 100 Ko, la borne du §8.
   *
   * 🔑 Ce n'est pas une préoccupation de performance : c'est une question de
   * CONFORMITÉ. Gmail tronque un message au-delà d'environ 102 Ko et affiche
   * « Message tronqué » avec un lien « Afficher le message intégral ». Ce qu'il
   * coupe, c'est la FIN — donc le pied de page, donc les mentions légales de la
   * LCEN et le lien de désabonnement. Un e-mail trop lourd devient, pour la
   * plupart de ses destinataires, un e-mail sans mentions légales.
   */
  const POIDS_MAX_OCTETS = 100 * 1024;

  for (const name of EMAIL_TEMPLATE_NAMES) {
    it(`${name} (fr) : HTML sous 100 Ko`, async () => {
      const { html } = await renderEmailTemplate(name, "fr", PAYLOAD);
      const octets = Buffer.byteLength(html, "utf8");
      expect(
        octets,
        `${name} : ${(octets / 1024).toFixed(1)} Ko. Au-delà de 100 Ko, Gmail ` +
          `tronque le message — et ce qu'il coupe en premier, c'est le pied de ` +
          `page : mentions légales et désabonnement disparaissent.`,
      ).toBeLessThan(POIDS_MAX_OCTETS);
    });
  }
});

describe("Référentiel e-mail — première phrase optimisée pour les résumés IA (§3.6)", () => {
  // Apple Intelligence, Gmail/Gemini et Outlook Copilot résument l'e-mail dans
  // la LISTE de la boîte de réception, à partir des premiers caractères du
  // corps. Une salutation en tête consomme ce résumé pour ne rien dire.
  const SALUTATION_EN_TETE = /^(bonjour|bonsoir|hello|hi)\b[^.!?]{0,40}[,.]?\s*$/i;

  for (const name of EMAIL_TEMPLATE_NAMES) {
    it(`${name} (fr) : le corps n'ouvre pas sur une salutation isolée`, async () => {
      const { text } = await renderEmailTemplate(name, "fr", PAYLOAD);
      // Le rendu texte débute par le pré-en-tête puis le titre ; on cherche la
      // première ligne de CORPS, c'est-à-dire la première phrase substantielle.
      const lignes = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      const premiere = lignes.find((l) => l.length > 12) ?? "";
      expect(
        SALUTATION_EN_TETE.test(premiere),
        `${name} : le corps ouvre sur « ${premiere} ». Les résumés affichés ` +
          `dans la boîte de réception se construisent sur les 100 premiers ` +
          `caractères : mettre l'information d'abord, la politesse ensuite ` +
          `(« Votre place est réservée. Bonjour Marie — voici les détails. »).`,
      ).toBe(false);
    });
  }
});
