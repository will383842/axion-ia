/**
 * Qualiopi — Section « Certifications & agréments » des mentions légales.
 *
 * Retourne un bloc `{ title, body }` injectable dans `LegalPageTemplate` (même
 * forme que les sections statiques de `content/legal.ts`), ou `null` hors
 * Phase B. La page `/mentions-legales` l'append à ses sections existantes —
 * elle n'a donc aucune connaissance du module Qualiopi (import depuis
 * `@/components/qualiopi/`, jamais `@/server/qualiopi/`).
 *
 * Les valeurs (NDA, n° Qualiopi, dates) viennent de la config ; les bases
 * juridiques verbatim de `LEGAL_MENTIONS`. Chaque ligne n'est ajoutée que si sa
 * valeur est renseignée → dégradation gracieuse si la config est partielle.
 */

import { getNdaPublic, getQualiopiPublicIdentity } from "@/server/qualiopi/config/public-identity";
import {
  formatMentionDeclarationActivite,
  formatMentionMarqueQualiopi,
} from "@/server/qualiopi/legal/legal-mentions";

/** Formate une date ISO (YYYY-MM-DD) en français lisible, sinon renvoie brut. */
function formatDateFr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  const [, y, mo, d] = m;
  const mois = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
  ];
  const idx = Number(mo) - 1;
  if (idx < 0 || idx > 11) return iso.trim();
  return `${Number(d)} ${mois[idx]} ${y}`;
}

/**
 * Section « Déclaration d'activité » — le NDA et sa mention obligatoire.
 *
 * 🔴 SECTION AUTONOME depuis le 2026-08-17, et c'est tout l'objet du patch. Le
 * NDA vivait à l'intérieur de `buildQualiopiCertificationsSection`, donc derrière
 * la garde de certification Qualiopi. Le récépissé DREETS obtenu le 17 août 2026
 * n'aurait rien affiché sur le site, faute d'une certification qui n'arrivera
 * pas avant des mois. Un enregistrement administratif et une certification
 * qualité ne se conditionnent pas l'un l'autre — cf. `computeNdaPublic`.
 *
 * `null` si le numéro n'est pas disponible (hors Phase B, ou config vide) :
 * on n'affiche jamais un titre de section suivi d'un vide.
 *
 * ⚠️ La mention « cet enregistrement ne vaut pas agrément de l'État » n'est pas
 * ajoutée ici mais produite par `formatMentionDeclarationActivite`, qui la soude
 * au numéro (art. L.6352-12). Ne pas la réécrire à la main dans cette fonction :
 * ce serait rouvrir la possibilité d'un numéro publié sans elle.
 */
export async function buildDeclarationActiviteSection(
  isFr: boolean,
): Promise<{ title: string; body: string } | null> {
  const nda = await getNdaPublic();
  if (!nda) return null;

  const parts = [
    isFr
      ? `Axion-IA est un organisme de formation déclaré. Numéro de déclaration d'activité (NDA) : ${nda}.`
      : `Axion-IA is a registered training provider. Activity registration number (NDA): ${nda}.`,
    // Mention légale française verbatim, dans les deux langues : c'est un texte
    // réglementaire opposable, pas une phrase d'agrément traduisible.
    formatMentionDeclarationActivite(nda),
  ];

  return {
    title: isFr ? "Déclaration d'activité" : "Training provider registration",
    body: parts.join(" "),
  };
}

export async function buildQualiopiCertificationsSection(
  isFr: boolean,
): Promise<{ title: string; body: string } | null> {
  const id = await getQualiopiPublicIdentity();
  if (!id) return null;

  const parts: string[] = [];

  // ── Certification Qualiopi ──
  //
  // Le NDA N'EST PLUS ICI : il a sa propre section
  // (`buildDeclarationActiviteSection`), affichée dès que le numéro existe et
  // sans attendre la certification. L'y remettre le ferait apparaître deux fois
  // le jour où Qualiopi sera obtenu.
  //
  // 🔴 Garde sur les champs vides (2026-08-10). La parenthèse s'ouvrait EN DUR
  // sur « (certificat n° ${id.qualiopiNumero} » : si le numéro n'était pas
  // renseigné en admin, les mentions légales publiaient littéralement
  // « …certifié Qualiopi (certificat n° ). ». Constaté en aperçu local avec la
  // configuration vide. Le numéro était le SEUL champ sans garde — organisme,
  // date et validité en avaient déjà une.
  //
  // Second défaut du même bloc : « le ${date} » s'accrochait à « délivré par »,
  // donc une date SANS organisme donnait « (certificat n° X le 12 janvier 2026 »
  // — sans verbe. La date porte maintenant son propre « délivré le ».
  //
  // Chaque segment est optionnel et la parenthèse entière disparaît si aucun
  // n'est renseigné : la phrase reste grammaticale dans les 16 combinaisons.
  const details: string[] = [];

  if (id.qualiopiNumero) {
    details.push(
      isFr ? `certificat n° ${id.qualiopiNumero}` : `certificate no. ${id.qualiopiNumero}`,
    );
  }

  const delivrance: string[] = [];
  if (id.qualiopiOrganisme) {
    delivrance.push(
      isFr ? `délivré par ${id.qualiopiOrganisme}` : `issued by ${id.qualiopiOrganisme}`,
    );
  }
  if (id.qualiopiDateObtention) {
    const d = isFr ? formatDateFr(id.qualiopiDateObtention) : id.qualiopiDateObtention;
    delivrance.push(
      delivrance.length > 0
        ? isFr
          ? `le ${d}`
          : `on ${d}`
        : isFr
          ? `délivré le ${d}`
          : `issued on ${d}`,
    );
  }
  if (delivrance.length > 0) details.push(delivrance.join(" "));

  if (id.qualiopiValidite) {
    details.push(
      isFr
        ? `valable jusqu'au ${formatDateFr(id.qualiopiValidite)}`
        : `valid until ${id.qualiopiValidite}`,
    );
  }

  let phraseQualiopi = isFr
    ? "Axion-IA est un organisme de formation certifié Qualiopi"
    : "Axion-IA is a Qualiopi-certified training provider";
  if (details.length > 0) phraseQualiopi += ` (${details.join(", ")})`;
  phraseQualiopi += ".";
  parts.push(phraseQualiopi);

  // Mention obligatoire de la marque Qualiopi (catégories certifiées).
  parts.push(formatMentionMarqueQualiopi(id.categoriesCertifiees));

  return {
    title: isFr ? "Certifications & agréments" : "Certifications & accreditations",
    body: parts.join(" "),
  };
}
