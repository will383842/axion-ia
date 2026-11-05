/**
 * Archive la version COURANTE des CGV (`CGV_VERSION`) : texte canonique, empreintes, PDF figé
 * dans R2. Idempotent ; ne supprime ni ne modifie jamais rien. Aucune dépendance à l'interrupteur
 * (archiver n'a aucun effet visible) :
 *   pnpm exec tsx scripts/archiver-cgv.ts
 * À jouer EN PROD avant toute refonte du texte des CGV.
 */
import { assurerArchiveCgvCourante } from "@/server/legal/cgv-archive";

async function main(): Promise<void> {
  const a = await assurerArchiveCgvCourante();
  console.log(
    `CGV ${a.version} archivées : texte ${a.texteSha256} · PDF ${a.pdfSha256} (${a.pdfTaille} o) · ${a.pdfR2Key}`,
  );
}

main().then(
  () => process.exit(0),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
