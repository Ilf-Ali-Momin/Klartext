// Writes the synthetic sample letters in fixtures/ as text PDFs plus their expected JSON.
// All names, addresses and numbers are fictional. Run with: npm run fixtures

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

interface Fixture {
  name: string;
  lines: string[];
  expected: Record<string, unknown>;
}

const FIXTURES: Fixture[] = [
  {
    name: "rundfunk-zahlungserinnerung",
    lines: [
      "Beitragsservice Musterstadt",
      "Postfach 10 20 30, 12345 Musterstadt",
      "",
      "Frau Mira Beispiel",
      "Lindenweg 4",
      "12345 Musterstadt",
      "",
      "Musterstadt, 02.09.2026",
      "",
      "Beitragsnummer: 987 654 321",
      "",
      "Zahlungserinnerung",
      "",
      "Sehr geehrte Frau Beispiel,",
      "",
      "für Ihre Wohnung ist der Rundfunkbeitrag für den Zeitraum Juli 2026 bis",
      "September 2026 noch offen. Der offene Betrag beträgt 55,08 Euro.",
      "",
      "Bitte überweisen Sie den Betrag bis zum 30.09.2026 auf folgendes Konto:",
      "",
      "Empfänger: Beitragsservice Musterstadt",
      "IBAN: DE00 1234 5678 9012 3456 78",
      "Verwendungszweck: 987654321",
      "",
      "Wenn Sie den Betrag bereits überwiesen haben, betrachten Sie dieses Schreiben",
      "bitte als gegenstandslos.",
      "",
      "Mit freundlichen Grüßen",
      "Ihr Beitragsservice",
    ],
    expected: {
      sender: { type: "broadcasting_fee" },
      letter_date: "2026-09-02",
      deadline: { kind: "fixed", date: "2026-09-30", relative_period: null },
      amount: { value: 55.08 },
      reference_numbers: ["987 654 321"],
    },
  },
  {
    name: "finanzamt-steuerbescheid",
    lines: [
      "Finanzamt Musterstadt",
      "Steuerstraße 1, 12345 Musterstadt",
      "",
      "Herrn Arjun Muster",
      "Ahornallee 12",
      "12345 Musterstadt",
      "",
      "Musterstadt, 15.09.2026",
      "",
      "Steuernummer: 123/456/78901",
      "",
      "Bescheid für 2025 über Einkommensteuer",
      "",
      "Festgesetzt werden:            Einkommensteuer     1.842,00 Euro",
      "Bereits gezahlt (Lohnsteuer):                      2.080,00 Euro",
      "Erstattung:                                          238,00 Euro",
      "",
      "Der Erstattungsbetrag von 238,00 Euro wird auf Ihr Konto überwiesen.",
      "",
      "Rechtsbehelfsbelehrung",
      "Gegen diesen Bescheid ist der Einspruch zulässig. Der Einspruch ist beim",
      "Finanzamt Musterstadt schriftlich oder elektronisch einzulegen. Die Frist",
      "für die Einlegung des Einspruchs beträgt einen Monat. Sie beginnt mit Ablauf",
      "des Tages, an dem Ihnen dieser Bescheid bekannt gegeben worden ist.",
      "",
      "Mit freundlichen Grüßen",
      "Ihr Finanzamt Musterstadt",
    ],
    expected: {
      sender: { type: "tax_office" },
      letter_date: "2026-09-15",
      deadline: {
        kind: "relative",
        date: null,
        relative_period: { count: 1, unit: "month", from: "receipt" },
      },
      amount: { value: 238 },
      reference_numbers: ["123/456/78901"],
    },
  },
  {
    name: "inkasso-forderung",
    lines: [
      "Muster Inkasso GmbH",
      "Hafenstraße 99, 54321 Beispielburg",
      "",
      "Herrn Tomás Probe",
      "Birkenstraße 7",
      "12345 Musterstadt",
      "",
      "Beispielburg, 05.10.2026",
      "",
      "Aktenzeichen: IK-2026-004711",
      "Auftraggeber: Beispiel Mobilfunk AG",
      "",
      "Forderung aus Mobilfunkvertrag",
      "",
      "Sehr geehrter Herr Probe,",
      "",
      "unser Auftraggeber hat uns mit dem Einzug der folgenden Forderung beauftragt:",
      "",
      "Hauptforderung:                 64,90 Euro",
      "Mahnkosten des Auftraggebers:    5,00 Euro",
      "Inkassokosten:                  27,45 Euro",
      "Gesamtbetrag:                   97,35 Euro",
      "",
      "Bitte zahlen Sie den Gesamtbetrag innerhalb von 14 Tagen ab Datum dieses",
      "Schreibens unter Angabe des Aktenzeichens auf folgendes Konto:",
      "",
      "Empfänger: Muster Inkasso GmbH",
      "IBAN: DE00 9876 5432 1098 7654 32",
      "",
      "Sollte die Zahlung nicht fristgerecht eingehen, behalten wir uns vor, das",
      "gerichtliche Mahnverfahren einzuleiten.",
      "",
      "Mit freundlichen Grüßen",
      "Muster Inkasso GmbH",
    ],
    expected: {
      sender: { type: "debt_collector" },
      letter_date: "2026-10-05",
      deadline: {
        kind: "relative",
        date: null,
        relative_period: { count: 14, unit: "day", from: "letter_date" },
      },
      amount: { value: 97.35 },
      reference_numbers: ["IK-2026-004711"],
    },
  },
];

// Minimal single-page PDF writer: Helvetica with WinAnsiEncoding, which covers German umlauts.

const WIN_ANSI_EXTRA: Record<string, number> = { "€": 0x80, "–": 0x96, "„": 0x84, "“": 0x93 };

function pdfString(text: string): string {
  let out = "";
  for (const char of text) {
    const code = WIN_ANSI_EXTRA[char] ?? char.codePointAt(0)!;
    if (code > 0xff) throw new Error(`Character not in WinAnsi: ${char}`);
    if (char === "(" || char === ")" || char === "\\") out += `\\${char}`;
    else if (code < 0x20 || code > 0x7e) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += char;
  }
  return `(${out})`;
}

function buildPdf(lines: string[]): Buffer {
  const fontSize = 11;
  const leading = 15;
  const ops = [`BT /F1 ${fontSize} Tf ${leading} TL 64 780 Td`];
  for (const line of lines) ops.push(`${pdfString(line)} Tj T*`);
  ops.push("ET");
  const content = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

const dir = path.resolve("fixtures");
mkdirSync(dir, { recursive: true });
for (const fixture of FIXTURES) {
  writeFileSync(path.join(dir, `${fixture.name}.pdf`), buildPdf(fixture.lines));
  writeFileSync(
    path.join(dir, `${fixture.name}.expected.json`),
    `${JSON.stringify(fixture.expected, null, 2)}\n`,
  );
  console.log(`wrote fixtures/${fixture.name}.pdf`);
}
