/**
 * SSOT — Photos héro sectorielles (Unsplash, licence gratuite).
 *
 * Sourcées via l'API Unsplash (provider `content-gen/providers/unsplash.ts`),
 * téléchargées en local (`/public/illustrations/secteurs/{slug}.avif`, 1600×1000)
 * → 0 hotlink externe. Conformité CGU (docs/content-gen/UNSPLASH-COMPLIANCE.md) :
 *   - licence gratuite uniquement (filtre premium/paid à la sélection)
 *   - endpoint `/photos/:id/download` déclenché avant usage (CGU API §6)
 *   - **attribution photographe rendue** sur la page (CGU API §9) — cf. le
 *     `<figcaption>` du héro via `SectorHeroMedia`
 *   - liens UTM `utm_source=axion-ia` (audit trail = ce fichier : photoId source)
 *
 * ⚠️ Ne PAS retirer l'attribution rendue sans retirer la photo (violation CGU).
 * Clé = `ClientSectorSlug` (SSOT `content/sectors.ts`).
 */

import type { ClientSectorSlug } from "@/content/sectors";

export interface SectorPhotoCredit {
  /** ID Unsplash (audit trail source). */
  readonly photoId: string;
  /** Nom du photographe (rendu dans le crédit). */
  readonly photographer: string;
  /** Profil photographe (UTM axion-ia). */
  readonly photographerUrl: string;
  /** Page photo Unsplash (UTM axion-ia). */
  readonly photoUrl: string;
}

export const SECTOR_PHOTO_CREDITS: Record<ClientSectorSlug, SectorPhotoCredit> = {
  comptabilite_finance: {
    photoId: "Mw9KxYkqsnk",
    photographer: "Marissa Grootes",
    photographerUrl: "https://unsplash.com/@marissacristina?utm_source=axion-ia&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/Mw9KxYkqsnk?utm_source=axion-ia&utm_medium=referral",
  },
  btp_immobilier: {
    photoId: "x-ghf9LjrVg",
    photographer: "Scott Blake",
    photographerUrl:
      "https://unsplash.com/@sunburned_surveyor?utm_source=axion-ia&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/x-ghf9LjrVg?utm_source=axion-ia&utm_medium=referral",
  },
  restauration_hotellerie: {
    photoId: "y-XZf_TNRms",
    photographer: "Pylyp Sukhenko",
    photographerUrl: "https://unsplash.com/@novokayn?utm_source=axion-ia&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/y-XZf_TNRms?utm_source=axion-ia&utm_medium=referral",
  },
  sante_medecine: {
    photoId: "U4FyCp3-KzY",
    photographer: "Piron Guillaume",
    photographerUrl: "https://unsplash.com/@gpiron?utm_source=axion-ia&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/U4FyCp3-KzY?utm_source=axion-ia&utm_medium=referral",
  },
  juridique: {
    photoId: "jKU2NneZAbI",
    photographer: "Clarisse Meyer",
    photographerUrl: "https://unsplash.com/@clarissemeyer?utm_source=axion-ia&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/jKU2NneZAbI?utm_source=axion-ia&utm_medium=referral",
  },
  commerce_retail: {
    photoId: "q3o_8MteFM0",
    photographer: "Blake Wisz",
    photographerUrl: "https://unsplash.com/@blakewisz?utm_source=axion-ia&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/q3o_8MteFM0?utm_source=axion-ia&utm_medium=referral",
  },
  industrie_logistique: {
    photoId: "vzdFzNNgt1k",
    photographer: "Sikai Gu",
    photographerUrl: "https://unsplash.com/@gentle_kay?utm_source=axion-ia&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/vzdFzNNgt1k?utm_source=axion-ia&utm_medium=referral",
  },
  artisanat_services: {
    photoId: "TywjkDHf0Ps",
    photographer: "Annie Spratt",
    photographerUrl: "https://unsplash.com/@anniespratt?utm_source=axion-ia&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/TywjkDHf0Ps?utm_source=axion-ia&utm_medium=referral",
  },
  rh_recrutement: {
    photoId: "vzfgh3RAPzM",
    photographer: "Christina @ wocintechchat.com",
    photographerUrl: "https://unsplash.com/@wocintechchat?utm_source=axion-ia&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/vzfgh3RAPzM?utm_source=axion-ia&utm_medium=referral",
  },
  collectivites_public: {
    photoId: "CyvK_Z2pYXg",
    photographer: "Robert Bye",
    photographerUrl: "https://unsplash.com/@robertbye?utm_source=axion-ia&utm_medium=referral",
    photoUrl: "https://unsplash.com/photos/CyvK_Z2pYXg?utm_source=axion-ia&utm_medium=referral",
  },
};
