// La fenêtre des fiches « récentes » proposées au rattachement d'un rendez-vous.
//
// ── Pourquoi une constante SEULE dans son fichier ────────────────────────
// Elle est lue des DEUX côtés : par la requête qui filtre
// (`features/admin-calendly/fiches-rattachables.ts`) et par le sélecteur qui
// l'annonce à l'écran (`components/admin/contacts/CalendlyEventEditor.tsx`).
//
// 🔴 ET LE SECOND EST UN COMPOSANT CLIENT. Le premier réflexe — importer la
// constante depuis le module de requête — aurait tiré **Prisma dans le bundle
// du navigateur** : ce module importe `@/lib/prisma`, `decryptPii` et le hachage
// d'adresses. Un `import type` s'efface à la compilation, une VALEUR non.
//
// 🔑 La leçon générale : quand une valeur doit être lue d'un côté serveur ET
// d'un côté client, elle ne vit dans aucun des deux. Elle vit dans un module
// pur, que les deux importent.
//
// Sans ce partage, le jour où l'on passerait à 60 jours, le sélecteur
// annoncerait toujours « 30 derniers jours » en proposant des fiches de 45 —
// et rien ne rougirait nulle part.

/** Nombre de jours d'ancienneté maximum d'une fiche proposée au rattachement. */
export const JOURS_FICHES_RECENTES = 30;
