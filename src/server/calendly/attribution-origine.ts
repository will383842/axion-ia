// L'ATTRIBUTION D'ORIGINE d'un échange apporteur venu de la page vidéo
// (2026-10-10, statistiques par annonce).
//
// ── Le problème ───────────────────────────────────────────────────────────
// La publicité arrive avec `utm_content=<identifiant de l'annonce>`. Sur le
// parcours de réservation, `utm_content` désigne autre chose : le BOUTON cliqué
// (`apporteur:vsl-apporteur`, `choix-rendez-vous.ts`), et la colonne
// `calendly_events.utm_content` l'affiche comme tel dans la console. Une
// réservation prise depuis l'e-mail B1, un rappel, ou un autre appareil ne porte,
// elle, aucune UTM. L'annonce se perdait donc entre l'inscription et le créneau.
//
// ── La solution retenue : la FICHE fait foi ─────────────────────────────────
// L'étape 1 a gardé les UTM d'arrivée sur la fiche (`details.funnel.utm`). Quand
// l'enrichissement rattache la réservation à une fiche de la page vidéo, il
// RELIT cette attribution — quel que soit le chemin de la réservation (page
// merci, e-mail, autre appareil) — et la recopie sur le rendez-vous :
//   · `utm_source / utm_medium / utm_campaign` : seulement s'ils sont vides (ce
//     que porte la réservation elle-même prime, règle de l'enrichissement) ;
//   · le bloc complet, annonce comprise, dans la clé privée
//     `rawPayload._attributionOrigine` (préservée à chaque passage) — jamais à
//     la place du bouton (`utm_content`), qui reste le marqueur du tunnel.
// Le tableau « Tunnels → Apporteurs » lit l'annonce sur la fiche, la même source.
//
// Module PUR : aucune lecture, aucune écriture.

export interface AttributionOrigine {
  readonly utm_source?: string;
  readonly utm_medium?: string;
  readonly utm_campaign?: string;
  readonly utm_content?: string;
}

const CLES = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

function enregistrement(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** La fiche vient-elle de la page vidéo (bloc `details.vsl`) ? */
export function estFicheVideo(details: unknown): boolean {
  const v = enregistrement(details)["vsl"];
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Les UTM d'arrivée gardées sur une fiche (`details.funnel.utm`), nettoyées. */
export function attributionDeLaFiche(details: unknown): AttributionOrigine {
  const utm = enregistrement(enregistrement(enregistrement(details)["funnel"])["utm"]);
  const out: Record<string, string> = {};
  for (const cle of CLES) {
    const v = utm[cle];
    if (typeof v === "string" && v.trim()) out[cle] = v.trim().slice(0, 200);
  }
  return out;
}

export interface LigneRendezVous {
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly rawPayload: unknown;
}

/**
 * Ce qu'il faut écrire sur le rendez-vous pour qu'il porte l'attribution
 * d'origine ; `null` s'il n'y a rien à écrire (déjà recopiée, ou fiche sans UTM).
 * Ne remplace JAMAIS une valeur déjà présente.
 */
export function recopieAttribution(
  ligne: LigneRendezVous,
  attribution: AttributionOrigine,
  ficheId: string,
  maintenant: Date,
): Record<string, unknown> | null {
  if (Object.keys(attribution).length === 0) return null;
  const data: Record<string, unknown> = {};
  if (ligne.utmSource == null && attribution.utm_source) data["utmSource"] = attribution.utm_source;
  if (ligne.utmMedium == null && attribution.utm_medium) data["utmMedium"] = attribution.utm_medium;
  if (ligne.utmCampaign == null && attribution.utm_campaign) {
    data["utmCampaign"] = attribution.utm_campaign;
  }
  const brut = enregistrement(ligne.rawPayload);
  if (brut["_attributionOrigine"] === undefined) {
    data["rawPayload"] = {
      ...brut,
      _attributionOrigine: { ...attribution, fiche: ficheId, le: maintenant.toISOString() },
    };
  }
  return Object.keys(data).length > 0 ? data : null;
}
