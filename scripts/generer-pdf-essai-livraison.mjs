#!/usr/bin/env node
// Génère `public/guides-reseau/essai-livraison.pdf` : 1 page « Document d'essai technique ».
// PDF minimal valide (4 objets + table xref calculée), police Helvetica standard, AUCUNE donnée
// personnelle, déterministe (aucune date ni identifiant variable). Usage : node scripts/generer-pdf-essai-livraison.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SORTIE = resolve(process.argv[2] ?? "public/guides-reseau/essai-livraison.pdf");
const flux = "BT /F1 24 Tf 72 720 Td (Document d'essai technique) Tj ET\n";
const objets = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  `<< /Length ${Buffer.byteLength(flux, "latin1")} >>\nstream\n${flux}endstream`,
];
let pdf = "%PDF-1.4\n";
const positions = [];
objets.forEach((o, i) => {
  positions.push(Buffer.byteLength(pdf, "latin1"));
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
});
const debutXref = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
for (const p of positions) pdf += `${String(p).padStart(10, "0")} 00000 n \n`;
pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF\n`;
mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(SORTIE, Buffer.from(pdf, "latin1"));
console.log(`écrit : ${SORTIE} (${Buffer.byteLength(pdf, "latin1")} octets)`);
