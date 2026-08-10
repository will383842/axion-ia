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

import { getQualiopiPublicIdentity } from "@/server/qualiopi/config/public-identity";
import {
  LEGAL_MENTIONS,
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

export async function buildQualiopiCertificationsSection(
  isFr: boolean,
): Promise<{ title: string; body: string } | null> {
  const id = await getQualiopiPublicIdentity();
  if (!id) return null;

  const parts: string[] = [];

  // ── Déclaration d'activité (NDA) ──
  if (id.nda) {
    parts.push(
      isFr
        ? `Numéro de déclaration d'activité (NDA) : ${id.nda}.`
        : `Activity registration number (NDA): ${id.nda}.`,
    );
    // Base juridique verbatim (inclut « ne vaut pas agrément de l'État »).
    parts.push(LEGAL_MENTIONS.declarationActivite);
  }

  // ── Certification Qualiopi ──
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
