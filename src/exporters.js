// Export receipts as CSV, Excel, PDF or ZIP, build expense-report PDFs,
// and assemble the accountant hand-off package.
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { byCategory, money, prettyDate, sum, findIssues, ISSUE_LABELS } from './utils';
import { isWeb, dataUrlParts, base64ToBlob, webSave } from './platform';

const B64 = FileSystem.EncodingType?.Base64 || 'base64';
const OUT_DIR = () => FileSystem.cacheDirectory + 'exports/';

async function outPath(name) {
  await FileSystem.makeDirectoryAsync(OUT_DIR(), { intermediates: true }).catch(() => {});
  return OUT_DIR() + name.replace(/[^\w.\-]+/g, '_');
}

// Hand a finished file to the user: share sheet on the phone, download in the web build.
export async function deliver(out, dialogTitle = 'Share') {
  if (out.web) return webSave(out.filename, out.data);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(out.uri, { mimeType: out.mime, dialogTitle });
}

// Write text or base64 content to a file (phone) or wrap it for download (web).
async function emit(name, content, mime, isBase64 = false) {
  const filename = name.replace(/[^\w.\-]+/g, '_');
  if (isWeb) return { web: true, filename, mime, data: isBase64 ? base64ToBlob(content, mime) : content };
  const p = await outPath(filename);
  await FileSystem.writeAsStringAsync(p, content, isBase64 ? { encoding: B64 } : undefined);
  return { uri: p, mime };
}

// Base64 of a stored receipt image (a file on the phone, a data URL on web).
async function readImageB64(uri) {
  const d = dataUrlParts(uri);
  if (d) return d.base64;
  return FileSystem.readAsStringAsync(uri, { encoding: B64 });
}

// ---------- rows ----------
const HEADERS = ['Date', 'Merchant', 'Category', 'Subtotal', 'Tax', 'Total', 'Currency', 'Payment', 'Tags', 'Notes', 'Status', 'Image file'];

function rows(receipts) {
  return receipts.map((r) => [
    r.date,
    r.merchant,
    r.category,
    Number(r.subtotal ?? r.total - (r.tax || 0)).toFixed(2),
    Number(r.tax || 0).toFixed(2),
    Number(r.total || 0).toFixed(2),
    r.currency,
    r.paymentMethod || '',
    (r.tags || []).join('; '),
    r.notes || '',
    r.status === 'needs_review' ? 'Needs review' : 'OK',
    r.imageUri ? imageName(r) : '',
  ]);
}

const imageName = (r) => `${r.date}_${(r.merchant || 'receipt').replace(/[^\w]+/g, '-').slice(0, 30)}_${r.id.slice(-4)}.${(r.imageUri || '.jpg').split('.').pop().slice(0, 4)}`;

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildCSV(receipts) {
  return [HEADERS, ...rows(receipts)].map((r) => r.map(csvCell).join(',')).join('\n');
}

function buildWorkbookBase64(receipts) {
  const wb = XLSX.utils.book_new();
  const data = [HEADERS, ...rows(receipts).map((r) => r.map((v, i) => (i >= 3 && i <= 5 ? Number(v) : v)))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [12, 26, 16, 10, 10, 10, 8, 12, 20, 24, 12, 30].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Receipts');

  const cat = byCategory(receipts).map((c) => [c.category, c.count, +c.tax.toFixed(2), +c.total.toFixed(2)]);
  const ws2 = XLSX.utils.aoa_to_sheet([['Category', 'Receipts', 'Tax', 'Total'], ...cat, ['TOTAL', receipts.length, +sum(receipts, 'tax').toFixed(2), +sum(receipts).toFixed(2)]]);
  ws2['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'By category');

  const items = [];
  receipts.forEach((r) => (r.lineItems || []).forEach((i) => items.push([r.date, r.merchant, i.description, i.qty, i.amount])));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Date', 'Merchant', 'Item', 'Qty', 'Amount'], ...items]), 'Line items');

  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

// ---------- PDF (HTML → PDF via expo-print) ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function imgData(uri) {
  try {
    if (dataUrlParts(uri)) return uri;
    const b = await FileSystem.readAsStringAsync(uri, { encoding: B64 });
    const ext = uri.split('.').pop().toLowerCase();
    return `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${b}`;
  } catch {
    return null;
  }
}

export async function buildReportHTML({ title, subtitle, receipts, settings, includeImages = false, notesBlock = '' }) {
  const cur = settings.currency;
  const cats = byCategory(receipts);
  const total = sum(receipts);
  const tax = sum(receipts, 'tax');

  let images = '';
  if (includeImages) {
    for (const r of receipts.filter((x) => x.imageUri)) {
      const src = await imgData(r.imageUri);
      if (src) images += `<div class="img"><img src="${src}"/><p>${esc(prettyDate(r.date))} · ${esc(r.merchant)} · ${esc(money(r.total, r.currency))}</p></div>`;
    }
  }

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    *{box-sizing:border-box} body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111827;margin:32px;font-size:12px}
    h1{font-size:22px;margin:0} .sub{color:#6B7280;margin:4px 0 20px}
    .meta{display:flex;justify-content:space-between;border-bottom:2px solid #FFB21E;padding-bottom:12px;margin-bottom:16px}
    .kpis{display:flex;gap:12px;margin:16px 0} .kpi{flex:1;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:10px}
    .kpi b{display:block;font-size:16px;margin-top:2px}
    table{width:100%;border-collapse:collapse;margin:8px 0 20px} th{background:#111827;color:#fff;text-align:left;padding:6px 8px;font-size:11px}
    td{padding:6px 8px;border-bottom:1px solid #E5E7EB} td.n,th.n{text-align:right} tr.tot td{font-weight:700;border-top:2px solid #111827}
    h2{font-size:14px;margin:18px 0 4px} .img{page-break-inside:avoid;margin:12px 0} .img img{max-width:60%;max-height:520px;border:1px solid #E5E7EB}
    .note{background:#FFF8E6;border:1px solid #FFE1A1;padding:10px;border-radius:8px} .sig{margin-top:40px;display:flex;gap:40px}
    .sig div{flex:1;border-top:1px solid #9CA3AF;padding-top:4px;color:#6B7280}
  </style></head><body>
    <div class="meta"><div><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div></div>
    <div style="text-align:right">${esc(settings.name || '')}<br/>${esc(settings.company || '')}<br/><span class="sub">Generated ${esc(prettyDate(new Date().toISOString().slice(0, 10)))}</span></div></div>
    <div class="kpis"><div class="kpi">Total spend<b>${money(total, cur)}</b></div><div class="kpi">Tax (SST/GST)<b>${money(tax, cur)}</b></div><div class="kpi">Receipts<b>${receipts.length}</b></div></div>
    ${notesBlock}
    <h2>Summary by category</h2>
    <table><tr><th>Category</th><th class="n">Receipts</th><th class="n">Tax</th><th class="n">Total</th></tr>
    ${cats.map((c) => `<tr><td>${esc(c.category)}</td><td class="n">${c.count}</td><td class="n">${money(c.tax, cur)}</td><td class="n">${money(c.total, cur)}</td></tr>`).join('')}
    <tr class="tot"><td>Total</td><td class="n">${receipts.length}</td><td class="n">${money(tax, cur)}</td><td class="n">${money(total, cur)}</td></tr></table>
    <h2>Itemised expenses</h2>
    <table><tr><th>Date</th><th>Merchant</th><th>Category</th><th>Payment</th><th class="n">Tax</th><th class="n">Total</th></tr>
    ${receipts.map((r) => `<tr><td>${esc(prettyDate(r.date))}</td><td>${esc(r.merchant)}${r.notes ? `<br/><span class="sub">${esc(r.notes)}</span>` : ''}</td><td>${esc(r.category)}</td><td>${esc(r.paymentMethod || '')}</td><td class="n">${money(r.tax, r.currency)}</td><td class="n">${money(r.total, r.currency)}</td></tr>`).join('')}
    </table>
    ${images ? `<h2 style="page-break-before:always">Receipt images</h2>${images}` : ''}
    <div class="sig"><div>Submitted by</div><div>Approved by</div><div>Date</div></div>
  </body></html>`;
}

// Phone: real PDF. Web: browsers in the artifact frame can't print, so the report is an HTML file.
async function htmlToPdf(html, fileName) {
  if (isWeb) return emit(fileName.replace(/\.pdf$/, '.html'), html, 'text/html');
  const { uri } = await Print.printToFileAsync({ html });
  const dest = await outPath(fileName);
  await FileSystem.moveAsync({ from: uri, to: dest }).catch(async () => FileSystem.copyAsync({ from: uri, to: dest }));
  return { uri: dest, mime: 'application/pdf' };
}

// ---------- public export API ----------
export async function exportReceipts(format, receipts, settings, baseName = 'receipts') {
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === 'csv') return emit(`${baseName}_${stamp}.csv`, buildCSV(receipts), 'text/csv');
  if (format === 'xlsx') return emit(`${baseName}_${stamp}.xlsx`, buildWorkbookBase64(receipts), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true);
  if (format === 'pdf') {
    const html = await buildReportHTML({ title: 'Receipts export', subtitle: `${receipts.length} receipts`, receipts, settings, includeImages: true });
    return htmlToPdf(html, `${baseName}_${stamp}.pdf`);
  }
  if (format === 'zip') {
    const zip = new JSZip();
    zip.file('receipts.csv', buildCSV(receipts));
    zip.file('receipts.xlsx', buildWorkbookBase64(receipts), { base64: true });
    await addImages(zip, receipts);
    return emit(`${baseName}_${stamp}.zip`, await zip.generateAsync({ type: 'base64' }), 'application/zip', true);
  }
  throw new Error('Unknown format');
}

async function addImages(zip, receipts) {
  const folder = zip.folder('images');
  for (const r of receipts.filter((x) => x.imageUri)) {
    try {
      folder.file(imageName(r), await readImageB64(r.imageUri), { base64: true });
    } catch {}
  }
}

export async function exportReportPDF(report, receipts, settings, includeImages) {
  const html = await buildReportHTML({
    title: report.name,
    subtitle: `Expense report · ${prettyDate(report.from)} – ${prettyDate(report.to)}${report.purpose ? ` · ${report.purpose}` : ''}`,
    receipts,
    settings,
    includeImages,
  });
  return htmlToPdf(html, `${report.name}.pdf`);
}

// Accountant hand-off: summary PDF + CSV + Excel + all images + open-issues list in one ZIP.
export async function buildAccountantPackage(receipts, settings, period) {
  const issues = findIssues(receipts);
  const notes = issues.length
    ? `<div class="note"><b>${issues.length} open item(s) for review:</b><br/>${issues
        .slice(0, 40)
        .map((i) => `• ${esc(ISSUE_LABELS[i.type])}: ${esc(i.receipt.merchant)} (${esc(prettyDate(i.receipt.date))}, ${money(i.receipt.total, i.receipt.currency)})`)
        .join('<br/>')}</div>`
    : `<div class="note">All receipts in this period are categorised and reviewed.</div>`;
  const html = await buildReportHTML({
    title: 'Bookkeeping package',
    subtitle: `${period.label} · ${prettyDate(period.from)} – ${prettyDate(period.to)}${settings.accountantName ? ` · Prepared for ${settings.accountantName}` : ''}`,
    receipts,
    settings,
    notesBlock: notes,
  });
  const zip = new JSZip();
  if (isWeb) {
    zip.file('summary.html', html);
  } else {
    const { uri: pdfTmp } = await Print.printToFileAsync({ html });
    zip.file('summary.pdf', await FileSystem.readAsStringAsync(pdfTmp, { encoding: B64 }), { base64: true });
  }
  zip.file('receipts.csv', buildCSV(receipts));
  zip.file('receipts.xlsx', buildWorkbookBase64(receipts), { base64: true });
  zip.file(
    'README.txt',
    `Bookkeeping package from ${settings.name || 'ScanTrack user'}${settings.company ? ` (${settings.company})` : ''}\n` +
      `Period: ${period.from} to ${period.to}\nReceipts: ${receipts.length}\nTotal: ${money(sum(receipts), settings.currency)}\nTax: ${money(sum(receipts, 'tax'), settings.currency)}\n\n` +
      `Files:\n  summary       - totals by category and itemised list\n  receipts.csv  - one row per receipt\n  receipts.xlsx - receipts, category summary, line items\n  images/       - original receipt photos (file names match the "Image file" column)\n`
  );
  await addImages(zip, receipts);
  return emit(`bookkeeping_${period.from}_${period.to}.zip`, await zip.generateAsync({ type: 'base64' }), 'application/zip', true);
}
