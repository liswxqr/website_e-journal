/**
 * Экспорт данных журнала. Без внешних зависимостей.
 * - CSV с UTF-8 BOM (корректно открывается в Excel с кириллицей)
 * - PDF — через окно печати браузера (Сохранить как PDF)
 */

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map(escapeCsv).join(";")).join("\r\n");
  const bom = "﻿"; // чтобы Excel понял UTF-8
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : filename + ".csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Открывает чистое окно печати с переданным HTML-содержимым (для сохранения в PDF). */
export function printHtml(title: string, bodyHtml: string) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Разрешите всплывающие окна, чтобы экспортировать в PDF.");
    return;
  }
  win.document.write(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>
  * { font-family: Arial, sans-serif; }
  body { margin: 24px; color: #0f172a; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: center; }
  th { background: #eff6ff; }
  td.name, th.name { text-align: left; white-space: nowrap; }
  @media print { @page { size: landscape; margin: 12mm; } }
</style>
</head>
<body>
${bodyHtml}
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`);
  win.document.close();
}
