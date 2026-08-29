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

import { BRAND } from "@/lib/brand";

import { PHOTO_JPEG_BASE64 } from "./photo";

/** Longueur maximale d'une ligne vCard, en octets, pliage compris (RFC 2426 §2.6). */
const MAX_LINE_OCTETS = 75;

/**
 * Identité publiée dans la fiche.
 *
 * ── Tout ce qui a une SSOT en dérive ─────────────────────────────────────────
 * La raison sociale, le nom du fondateur et l'URL du site NE sont PAS recopiés
 * ici : ils viennent de `@/lib/brand`. Ce n'est pas une préférence de style.
 * Le 02/08/2026, la raison sociale existait en **sept copies littérales
 * divergentes** et l'entité déclarait DEUX adresses de siège selon la page ;
 * Google rapproche `legalName` et `address` des registres SIRENE/INPI pour
 * décider si le site EST l'entreprise immatriculée, et un écart d'un seul
 * caractère casse ce rapprochement — sans jamais faire échouer un build.
 * Cf. `src/lib/seo/__tests__/identite-legale-registre.spec.ts`.
 *
 * Une carte de visite est la pire surface où laisser diverger ces valeurs :
 * elle est imprimée, distribuée, et ne se corrige plus.
 *
 * ── Ce qui reste littéral, et pourquoi ───────────────────────────────────────
 * L'adresse est écrite ici sous sa forme **structurée** (vCard `ADR` veut des
 * champs séparés, le JSON-LD une `streetAddress` d'un seul tenant) : aucune des
 * deux ne dérive de l'autre sans reformatage. Elle est donc recopiée du Kbis à
 * l'identique, casse comprise, et une garde la compare au JSON-LD de
 * l'organisation — c'est le test qui tient la cohérence, pas la discipline.
 *
 * Le téléphone et l'e-mail sont ceux imprimés sur la carte papier ; ils n'ont
 * pas de SSOT et sont gardés par un test dédié.
 */
export const WILLIAMS = {
  /**
   * `N` veut le nom et le prénom SÉPARÉS, quand la SSOT ne porte que le nom
   * complet. La découpe est donc écrite à la main, et une garde vérifie que
   * `prénom + nom` reconstitue exactement `FOUNDER.fullName`.
   */
  prenom: "Williams",
  nom: "Jullin",
  /**
   * `TITLE` sans la société : la vCard porte déjà `ORG`, et le carnet
   * d'adresses affiche les deux l'un sous l'autre — « Fondateur & CEO
   * d'Axion-IA / AXION IA SAS » y dirait deux fois la même chose. C'est donc le
   * préfixe de `FOUNDER.jobTitleFr`, et une garde vérifie qu'il en reste un.
   */
  fonction: "Fondateur & CEO",
  role: "Architecte IA — formation, audit, implémentation",
  societe: BRAND.legalName,
  telephone: "+33743331201",
  email: "williamsjullin@axion-ia.com",
  siteWeb: BRAND.url,
  whatsapp: "https://wa.me/33743331201",
  /**
   * Adresse du siège, recopiée du Kbis (RCS Grenoble à jour au 30/07/2026) et
   * de l'avis de situation SIRENE du 02/08/2026, qui concordent.
   *
   * 🔴 Le complément « ELITE BUREAUX - boîte 53 » fait partie de l'adresse
   * immatriculée — SIRENE le porte sur sa propre ligne. L'omettre casse
   * l'exact-match NAP. Ne pas « nettoyer » ce champ.
   */
  adresse: {
    complement: "ELITE BUREAUX - boîte 53",
    rue: "11 Avenue Paul Verlaine",
    ville: "Grenoble",
    codePostal: "38100",
    pays: "France",
  },
  /**
   * Date de naissance complète, forme ISO `AAAA-MM-JJ`.
   *
   * ⚠️ La forme sans millésime `--0225` a été essayée en premier, et RETIRÉE
   * après constat sur un vrai téléphone le 2026-08-17 : le carnet d'adresses
   * n'affiche pas une date sans année, il lui substitue une **année sentinelle**
   * et la fiche annonçait « 25 février **1604** ». Un anniversaire faux est pire
   * que pas d'anniversaire du tout — celui qui enregistre la fiche reçoit un
   * rappel à une date absurde, et croit l'information fiable.
   *
   * Le compromis est donc arbitré dans l'autre sens : la date complète est une
   * donnée d'identification, sur une fiche publique (`/williams-jullin.vcf`,
   * `noindex` mais accessible à qui scanne la carte). Décision de Will,
   * 2026-08-17. Pour revenir en arrière, remettre `--0225` en acceptant
   * l'année sentinelle, ou retirer la ligne `BDAY` de `buildVCard()`.
   */
  anniversaire: "1974-02-25",
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
    "PME, ETI et grands groupes. " +
    "Interventions partout en France et dans la francophonie.",
  /**
   * Horodatage de dernière révision de la fiche (RFC 2426 §3.6.4).
   *
   * Constante, jamais `new Date()` : la route est pré-rendue au build, et une
   * valeur mouvante rendrait la sortie non reproductible d'un build à l'autre.
   * À incrémenter à la main lors d'une vraie mise à jour de la fiche.
   */
  revision: "2026-08-17T00:00:00Z",
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
