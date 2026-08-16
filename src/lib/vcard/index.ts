// vCard de Williams Jullin — la fiche que l'on enregistre dans son téléphone.
//
// Cible : le QR « ENREGISTRER MON CONTACT » imprimé sur la carte de visite.
// Le QR encode `https://axion-ia.com/qr/vc`, qui redirige (302, modifiable en
// console sans réimprimer) vers `/williams-jullin.vcf`. Scanner la carte
// affiche donc directement la fiche contact NATIVE du téléphone, avec photo,
// et son bouton « Créer un nouveau contact ». Un seul geste, aucun détour par
// un navigateur, et la fiche reste valable même si le site tombe.
//
// ── Pourquoi vCard 3.0 et pas 4.0 ────────────────────────────────────────────
// La 4.0 (RFC 6350) est plus propre, mais elle n'est pas lue partout : les
// carnets d'adresses Android d'avant 2021 et plusieurs clients de messagerie
// ignorent silencieusement les fiches 4.0. La 3.0 (RFC 2426) est comprise par
// iOS, Android, Outlook, Gmail et Thunderbird sans exception connue. Pour un
// objet IMPRIMÉ, dont on ne peut pas corriger le comportement après coup, la
// compatibilité prime sur l'élégance du format.
//
// ── Trois pièges de format, corrigés ici ─────────────────────────────────────
//  1. `\r\n` obligatoire. La RFC impose CRLF ; certains parseurs Android
//     n'acceptent pas `\n` seul et renvoient une fiche vide, sans erreur.
//  2. Pliage à 75 octets. Une ligne plus longue DOIT être coupée et poursuivie
//     par une ligne commençant par une espace. C'est vital ici : la photo en
//     base64 fait ~20 000 caractères d'un seul tenant.
//  3. Échappement. Dans une valeur, `\`, `,` et `;` doivent être préfixés d'une
//     contre-oblique, sinon une virgule dans la note fait basculer le reste du
//     texte dans un champ inattendu.
//
// ── Ce que cette fiche NE dit pas ────────────────────────────────────────────
// Aucune mention de certification Qualiopi. Le drapeau
// `QUALIOPI_CERTIFICATION_OBTENUE` vaut `false` : tant que le certificat n'est
// pas délivré, la fiche ne l'affirme pas. Cf. `src/server/qualiopi/config/flag.ts`.

import { PHOTO_JPEG_BASE64 } from "./photo";

/** Longueur maximale d'une ligne vCard, en octets, pliage compris (RFC 2426 §2.6). */
const MAX_LINE_OCTETS = 75;

/**
 * Identité publiée dans la fiche.
 *
 * Les données de la société proviennent des mentions légales du site
 * (AXION IA SAS, RCS Grenoble 108018631). Le téléphone et l'e-mail sont ceux
 * imprimés sur la carte de visite — les trois surfaces doivent rester
 * cohérentes : la fiche enregistrée, la carte imprimée et le site.
 */
export const WILLIAMS = {
  prenom: "Williams",
  nom: "Jullin",
  fonction: "Fondateur & CEO",
  role: "Architecte IA — formation, audit, implémentation",
  societe: "AXION IA SAS",
  telephone: "+33743331201",
  email: "williamsjullin@axion-ia.com",
  siteWeb: "https://axion-ia.com",
  whatsapp: "https://wa.me/33743331201",
  adresse: {
    complement: "ELITE BUREAUX - boîte 53",
    rue: "11 avenue Paul Verlaine",
    ville: "Grenoble",
    codePostal: "38100",
    pays: "France",
  },
  /**
   * Anniversaire sans millésime, forme `--MMJJ`.
   *
   * C'est la forme qu'exporte Google Contacts pour une date sans année, et
   * qu'iOS lit également. Omettre l'année est délibéré : une fiche remise à des
   * inconnus n'a pas à porter une date de naissance complète, qui est une
   * donnée d'identification.
   */
  anniversaire: "--0225",
  /**
   * Descriptif affiché sous la fiche dans le carnet d'adresses.
   *
   * « Agence IA » reprend mot pour mot le verso de la carte imprimée. La
   * dernière ligne annonce la zone d'intervention : France ET francophonie —
   * ne pas la réduire à « France métropolitaine », ce qui fermerait la porte à
   * la Belgique, la Suisse, le Québec et l'Afrique francophone.
   */
  note:
    "Agence IA : formations, audits, accompagnement 1-to-1, implémentations " +
    "d'automatisations et plateformes web augmentées par l'IA. " +
    "TPE, PME, ETI et grands groupes. " +
    "Interventions partout en France et dans la francophonie.",
  /**
   * Horodatage de dernière révision de la fiche (RFC 2426 §3.6.4).
   *
   * Constante, jamais `new Date()` : la route est pré-rendue au build, et une
   * valeur mouvante rendrait la sortie non reproductible d'un build à l'autre.
   * À incrémenter à la main lors d'une vraie mise à jour de la fiche.
   */
  revision: "2026-08-16T00:00:00Z",
} as const;

/** Échappe une valeur de champ vCard (RFC 2426 §2.4.2). */
export function escapeValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Plie une ligne à 75 octets, les lignes suivantes commençant par une espace.
 *
 * La découpe se fait sur les octets UTF-8, pas sur les caractères : couper au
 * milieu d'une séquence multi-octets produirait un caractère de remplacement
 * dans le carnet d'adresses. On avance donc caractère par caractère en
 * surveillant le poids en octets.
 */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = "";
  let octets = 0;
  // La 1re ligne dispose de 75 octets ; les suivantes en perdent 1 pour l'espace.
  let budget = MAX_LINE_OCTETS;

  for (const char of line) {
    const weight = Buffer.byteLength(char, "utf8");
    if (octets + weight > budget) {
      out.push(current);
      current = "";
      octets = 0;
      budget = MAX_LINE_OCTETS - 1;
    }
    current += char;
    octets += weight;
  }
  out.push(current);

  return out.map((part, i) => (i === 0 ? part : ` ${part}`)).join("\r\n");
}

/** Construit la vCard 3.0 complète, prête à être servie. */
export function buildVCard(): string {
  const p = WILLIAMS;
  const a = p.adresse;

  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "PRODID:-//Axion-IA//Carte de visite//FR",

    // N est structuré : nom;prénom;autres;préfixe;suffixe
    `N:${escapeValue(p.nom)};${escapeValue(p.prenom)};;;`,
    `FN:${escapeValue(`${p.prenom} ${p.nom}`)}`,
    `ORG:${escapeValue(p.societe)}`,
    `TITLE:${escapeValue(p.fonction)}`,
    `ROLE:${escapeValue(p.role)}`,

    // PREF désigne le moyen de contact à privilégier : le mobile, puis l'e-mail.
    `TEL;TYPE=CELL,VOICE,PREF:${p.telephone}`,
    `EMAIL;TYPE=INTERNET,WORK,PREF:${p.email}`,
    `URL:${p.siteWeb}`,

    // ADR structuré : boîte;complément;rue;ville;région;code postal;pays
    `ADR;TYPE=WORK:;${escapeValue(a.complement)};${escapeValue(a.rue)};` +
      `${escapeValue(a.ville)};;${a.codePostal};${escapeValue(a.pays)}`,

    `BDAY:${p.anniversaire}`,
    `NOTE:${escapeValue(p.note)}`,

    // Le carnet d'adresses d'iOS propose un bouton WhatsApp direct si ce champ
    // est présent — d'où sa place ici, en plus du numéro.
    `X-SOCIALPROFILE;TYPE=whatsapp:${p.whatsapp}`,
    `CATEGORIES:${escapeValue("Axion-IA")},${escapeValue("Intelligence artificielle")}`,

    `PHOTO;ENCODING=b;TYPE=JPEG:${PHOTO_JPEG_BASE64}`,
    `REV:${p.revision}`,
    "END:VCARD",
  ];

  // CRLF partout, y compris en fin de fichier : plusieurs parseurs ignorent la
  // dernière ligne si elle n'est pas terminée.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** Nom de fichier proposé au téléchargement. */
export const VCARD_FILENAME = "williams-jullin.vcf";
