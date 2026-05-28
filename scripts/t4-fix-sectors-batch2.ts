/**
 * t4-fix-sectors-batch2.ts — Audit Will 2026-05-28.
 * Remplace les blocs topSectorsNaf encore génériques de 11 villes batch 2
 * par 5 secteurs ancrés local.
 */
import { promises as fs } from "fs";
import path from "path";

const COPY_DIR = path.join(process.cwd(), "src", "content", "villes", "copy");

const FIXES: Record<string, string[]> = {
  cugnaux: [
    "Sous-traitance aéronautique et mécanique de précision",
    "BTP et construction résidentielle périurbaine toulousaine",
    "Santé, cliniques et services à la personne",
    "Commerce et zones d'activités du Sud-Ouest toulousain",
    "Logistique et négoce industriel",
  ],
  beauvais: [
    "Industries agroalimentaires",
    "Logistique et services aéroportuaires (Beauvais-Tillé)",
    "Tourisme et patrimoine (cathédrale gothique, tapisserie)",
    "Assurance et back-offices tertiaires",
    "BTP et matériaux de construction de l'Oise",
  ],
  "bellerive-sur-allier": [
    "Hôtellerie et thermalisme (agglomération de Vichy)",
    "Restauration, tourisme et bien-être",
    "Sport, loisirs et événementiel (plaine sportive)",
    "Cosmétique et santé (filière thermale)",
    "Commerce et artisanat de bouche de bord d'Allier",
  ],
  "noisy-le-grand": [
    "Sièges sociaux et back-offices (quartier Mont d'Est)",
    "Banque, assurance et services financiers",
    "Numérique, éditeurs de logiciels et ESN",
    "Promotion immobilière et BTP du Grand Paris Est",
    "Commerce et restauration (centre Les Arcades)",
  ],
  wasquehal: [
    "E-commerce et distribution (parc de la Pilaterie)",
    "Sièges et back-offices de la métropole lilloise",
    "Éditeurs de logiciels et ESN",
    "Logistique et supply chain",
    "Hippisme, sport et événementiel",
  ],
  "le-teil": [
    "Industrie des matériaux (cimenterie Lafarge, carrières)",
    "Agriculture et viticulture de la vallée du Rhône",
    "BTP et négoce de matériaux",
    "Logistique fluviale et routière (axe rhodanien)",
    "Tourisme patrimonial et nature (gorges de l'Ardèche)",
  ],
  canejan: [
    "PME industrielles et zones d'activités (Pessac-Canéjan)",
    "BTP et construction de la métropole bordelaise",
    "Logistique et négoce du Sud-Gironde",
    "Santé et services à la personne",
    "Viticulture et négoce des Graves",
  ],
  "fontenay-sous-bois": [
    "Sièges sociaux et grands comptes (Société Générale, RATP)",
    "Banque, assurance et back-offices financiers",
    "Éditeurs de logiciels et ESN",
    "Audiovisuel et production (proximité Vincennes)",
    "Commerce et services de l'Est parisien",
  ],
  draveil: [
    "BTP et artisanat du bâtiment",
    "Commerce et restauration de bord de Seine",
    "Tourisme vert et loisirs (forêt de Sénart, Seine)",
    "Santé et services à la personne",
    "Nautisme et bases de loisirs",
  ],
  "jassans-riottier": [
    "PME industrielles et artisanales du Val de Saône",
    "BTP et construction résidentielle (bassin caladois)",
    "Logistique et négoce de bord de Saône",
    "Commerce et zones d'activités (proximité Villefranche)",
    "Viticulture et agroalimentaire du Beaujolais",
  ],
  "saint-gratien": [
    "BTP et artisanat du bâtiment",
    "Commerce et restauration de centre-ville",
    "Santé, bien-être et services à la personne",
    "Tourisme et loisirs (lac d'Enghien proche)",
    "Hôtellerie et événementiel de la vallée de Montmorency",
  ],
};

async function main() {
  let fixed = 0;
  for (const [slug, sectors] of Object.entries(FIXES)) {
    const fp = path.join(COPY_DIR, `${slug}.ts`);
    const content = await fs.readFile(fp, "utf-8");
    const block = `topSectorsNaf: [\n${sectors.map((s) => `    "${s}",`).join("\n")}\n  ],`;
    const newContent = content.replace(/topSectorsNaf:\s*\[[\s\S]*?\],/, block);
    if (newContent === content) {
      console.log(`  ⚠ ${slug}: pas de remplacement (regex no match)`);
      continue;
    }
    await fs.writeFile(fp, newContent, "utf-8");
    fixed++;
    console.log(`  ✓ ${slug}`);
  }
  console.log(`\n[fix-sectors-batch2] ${fixed}/${Object.keys(FIXES).length} fichiers corrigés`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
