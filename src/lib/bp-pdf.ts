import {
  DAYS,
  PERIODS,
  SLOTS,
  collect,
  formatDateTime,
  interpret,
  periodLabel,
  slotKey,
  statsFor,
  type BpData,
} from "./bp-storage";

export async function downloadReportPdf(data: BpData) {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const left = 18;
  let y = 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Compte rendu d'automesure tensionnelle", left, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Patient : ${data.patientName || "non renseigné"}`,
    left,
    y,
  );
  y += 5;
  doc.text(`Début du relevé : ${formatDateTime(data.startedAt)}`, left, y);
  y += 5;
  doc.text(`Édité le : ${formatDateTime(new Date().toISOString())}`, left, y);

  const global = statsFor(collect(data));
  const conclusion = interpret(global);

  y += 10;
  doc.setDrawColor(200);
  doc.setFillColor(240, 246, 245);
  doc.rect(left, y, 174, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(
    `Moyenne globale : ${global.systolic}/${global.diastolic} mmHg` +
      (global.pulse ? `  —  Pouls moyen : ${global.pulse} bpm` : ""),
    left + 4,
    y + 9,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${conclusion.label}  (${global.count} mesure(s) enregistrée(s))`,
    left + 4,
    y + 16,
  );
  y += 32;

  // Detail table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Détail des mesures", left, y);
  y += 6;

  const cols = [left, left + 42, left + 78, left + 110, left + 142];
  const header = ["Jour / Période", "Mesure", "Systole", "Diastole", "Pouls"];
  doc.setFontSize(9);
  header.forEach((h, i) => doc.text(h, cols[i], y));
  y += 2;
  doc.line(left, y, left + 174, y);
  y += 5;
  doc.setFont("helvetica", "normal");

  for (const day of DAYS) {
    for (const period of PERIODS) {
      const label = `Jour ${day} — ${periodLabel(period)}`;
      for (const slot of SLOTS) {
        const r = data.readings[slotKey(day, period, slot)];
        if (y > 265) {
          doc.addPage();
          y = 22;
        }
        doc.text(slot === 0 ? label : "", cols[0], y);
        doc.text(`n°${slot + 1}`, cols[1], y);
        doc.text(r ? String(r.systolic) : "—", cols[2], y);
        doc.text(r ? String(r.diastolic) : "—", cols[3], y);
        doc.text(r?.pulse ? String(r.pulse) : "—", cols[4], y);
        y += 5.5;
      }
      const s = statsFor(collect(data, { day, period }));
      doc.setFont("helvetica", "bold");
      doc.text(
        s.count
          ? `Moyenne ${periodLabel(period).toLowerCase()} : ${s.systolic}/${s.diastolic} mmHg`
          : `Moyenne ${periodLabel(period).toLowerCase()} : —`,
        cols[1],
        y,
      );
      doc.setFont("helvetica", "normal");
      y += 8;
    }
  }

  if (y > 250) {
    doc.addPage();
    y = 22;
  }
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    "Seuils de référence en automesure : moyenne normale < 135/85 mmHg.",
    left,
    y,
  );
  y += 4;
  doc.text(
    "Document informatif à présenter à votre médecin ; il ne remplace pas un avis médical.",
    left,
    y,
  );

  const name = (data.patientName || "patient")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  doc.save(`tension-${name || "patient"}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
