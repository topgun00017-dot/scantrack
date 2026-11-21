// Export receipts as CSV, Excel, PDF or ZIP, build expense-report PDFs,
// and assemble the accountant hand-off package.
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { byCategory, money, prettyDate, sum, findIssues, ISSUE_LABELS } from './utils';
import { isWeb, dataUrlParts, base64ToBlob, webSave } from './platform';
import { L, catLabel, isZh } from './i18n';

const B64 = FileSystem.EncodingType?.Base64 || 'base64';
const OUT_DIR = () => FileSystem.cacheDirectory + 'exports/';

// Keep letters in any language (e.g. a Chinese report name); replace only characters file systems reject.
const safeName = (name) => String(name).replace(/[\\/:*?"<>|\s]+/g, '_');

async function outPath(name) {
  await FileSystem.makeDirectoryAsync(OUT_DIR(), { intermediates: true }).catch(() => {});
  return OUT_DIR() + safeName(name);
}

// Hand a finished file to the user: share sheet on the phone, download in the web build.
export async function deliver(out, dialogTitle = L('Share', '分享')) {
  if (out.web) return webSave(out.filename, out.data);
  if (!(await Sharing.isAvailableAsync())) throw new Error(L('Sharing is not available on this device', '此设备无法分享文件'));
  await Sharing.shareAsync(out.uri, { mimeType: out.mime, dialogTitle });
}

// Write text or base64 content to a file (phone) or wrap it for download (web).
async function emit(name, content, mime, isBase64 = false) {
  const filename = safeName(name);
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
// Column titles follow the app language (read when a file is built).
const headers = () =>
  isZh()
    ? ['日期', '商家', '类别', '小计', '税款', '总额', '货币', '付款方式', '标签', '备注', '状态', '图片文件名', '图片链接']
    : ['Date', 'Merchant', 'Category', 'Subtotal', 'Tax', 'Total', 'Currency', 'Payment', 'Tags', 'Notes', 'Status', 'Image file name', 'Image link'];
// Web link to the receipt photo in Google Drive (once it has been backed up there).
const imageLink = (r) => (r.driveFileId ? `https://drive.google.com/file/d/${r.driveFileId}/view` : '');
// Google Sheets layout (photos = true): the Image link column is replaced by
//   M Receipt photo (thumbnail) · N Preview (tick box) · O photo address (hidden)
// and a large preview box to the right shows whichever receipt is ticked (set up in drive.js).
export const SHEET_PHOTO_COL = 12;
const sheetHeaders = () => [...headers().slice(0, 12), L('Receipt photo', '收据照片'), L('Preview', '预览'), L('Photo address', '照片地址')];
const thumbUrl = (r, w) => (r.driveFileId ? `https://drive.google.com/thumbnail?id=${r.driveFileId}&sz=w${w}` : '');
const photoFormula = (r) => (r.driveFileId ? `=IMAGE("${thumbUrl(r, 400)}")` : '');

function rows(receipts, photos = false) {
  return receipts.map((r) => [
    r.date,
    r.merchant,
    catLabel(r.category),
    Number(r.subtotal ?? r.total - (r.tax || 0)).toFixed(2),
    Number(r.tax || 0).toFixed(2),
    Number(r.total || 0).toFixed(2),
    r.currency,
    r.paymentMethod || '',
    (r.tags || []).join('; '),
    r.notes || '',
    r.status === 'needs_review' ? L('Needs review', '需要审核') : L('OK', '正常'),
    r.imageUri ? imageName(r) : '',
    ...(photos ? [photoFormula(r), 'FALSE', thumbUrl(r, 1600)] : [imageLink(r)]),
  ]);
}

const imageName = (r) => `${r.date}_${(r.merchant || 'receipt').replace(/[^\w]+/g, '-').slice(0, 30)}_${r.id.slice(-4)}.${(r.imageUri || '.jpg').split('.').pop().slice(0, 4)}`;

const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// CSV saved as a file starts with a byte-order mark so Excel reads Chinese text as UTF-8.
const csvFile = (receipts) => (isZh() ? '\uFEFF' : '') + buildCSV(receipts);

export function buildCSV(receipts, photos = false) {
  return [photos ? sheetHeaders() : headers(), ...rows(receipts, photos)].map((r) => r.map(csvCell).join(',')).join('\n');
}

export function buildWorkbookBase64(receipts, photos = false) {
  const wb = XLSX.utils.book_new();
  const data = [photos ? sheetHeaders() : headers(), ...rows(receipts, photos).map((r) => r.map((v, i) => (i >= 3 && i <= 5 ? Number(v) : v)))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [12, 26, 16, 10, 10, 10, 8, 12, 20, 24, 12, 30, photos ? 10 : 48, 9, 20].map((w) => ({ wch: w }));
  receipts.forEach((r, i) => {
    const at = (c) => ws[XLSX.utils.encode_cell({ r: i + 1, c })];
    if (photos) {
      const f = photoFormula(r);
      ws[XLSX.utils.encode_cell({ r: i + 1, c: 12 })] = f ? { t: 's', v: '', f: f.slice(1) } : { t: 's', v: '' };
      ws[XLSX.utils.encode_cell({ r: i + 1, c: 13 })] = { t: 'b', v: false };
    } else {
      // Make the image links clickable.
      const url = imageLink(r);
      if (url && at(12)) at(12).l = { Target: url, Tooltip: L('Open receipt photo', '打开收据照片') };
    }
  });
  if (photos) ws['!rows'] = [{ hpx: 22 }, ...receipts.map(() => ({ hpx: 72 }))];
  XLSX.utils.book_append_sheet(wb, ws, L('Receipts', '收据'));

  const cat = byCategory(receipts).map((c) => [catLabel(c.category), c.count, +c.tax.toFixed(2), +c.total.toFixed(2)]);
  const ws2 = XLSX.utils.aoa_to_sheet([[L('Category', '类别'), L('Receipts', '收据'), L('Tax', '税款'), L('Total', '总额')], ...cat, [L('TOTAL', '合计'), receipts.length, +sum(receipts, 'tax').toFixed(2), +sum(receipts).toFixed(2)]]);
  ws2['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws2, L('By category', '按类别'));

  const items = [];
  receipts.forEach((r) => (r.lineItems || []).forEach((i) => items.push([r.date, r.merchant, i.description, i.qty, i.amount])));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[L('Date', '日期'), L('Merchant', '商家'), L('Item', '项目'), L('Qty', '数量'), L('Amount', '金额')], ...items]), L('Line items', '明细项目'));

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

// layout: 'summary' (totals + one line per receipt), 'detailed' (every receipt with its line
// items and photo) or 'statement' (bank-statement style, oldest first with a running total).
export async function buildReportHTML({ title, subtitle, receipts, settings, includeImages = false, notesBlock = '', layout = 'summary' }) {
  const cur = settings.currency;
  const cats = byCategory(receipts);
  const total = sum(receipts);
  const tax = sum(receipts, 'tax');

  const T = {
    byCat: L('Summary by category', '按类别汇总'),
    category: L('Category', '类别'),
    receipts: L('Receipts', '收据'),
    tax: L('Tax', '税款'),
    total: L('Total', '总额'),
    date: L('Date', '日期'),
    merchant: L('Merchant', '商家'),
    payment: L('Payment', '付款方式'),
  };
  const catTable = `<h2>${T.byCat}</h2>
    <table><tr><th>${T.category}</th><th class="n">${T.receipts}</th><th class="n">${T.tax}</th><th class="n">${T.total}</th></tr>
    ${cats.map((c) => `<tr><td>${esc(catLabel(c.category))}</td><td class="n">${c.count}</td><td class="n">${money(c.tax, cur)}</td><td class="n">${money(c.total, cur)}</td></tr>`).join('')}
    <tr class="tot"><td>${T.total}</td><td class="n">${receipts.length}</td><td class="n">${money(tax, cur)}</td><td class="n">${money(total, cur)}</td></tr></table>`;

  let body;
  if (layout === 'statement') {
    const rows = [...receipts].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0)));
    let bal = 0;
    body = `<h2>${L('Statement of expenses', '开支明细表')}</h2>
    <table><tr><th>${T.date}</th><th>${L('Description', '说明')}</th><th>${T.category}</th><th class="n">${T.tax}</th><th class="n">${L('Amount', '金额')}</th><th class="n">${L('Running total', '累计')}</th></tr>
    <tr class="open"><td></td><td>${L('Opening total', '期初合计')}</td><td></td><td></td><td></td><td class="n">${money(0, cur)}</td></tr>
    ${rows
      .map((r) => {
        bal += Number(r.total) || 0;
        const desc = [r.merchant, r.paymentMethod, r.notes].filter(Boolean).map(esc).join(' · ');
        return `<tr><td>${esc(prettyDate(r.date))}</td><td>${desc}</td><td>${esc(catLabel(r.category))}</td><td class="n">${money(r.tax, r.currency)}</td><td class="n">${money(r.total, r.currency)}</td><td class="n bal">${money(bal, cur)}</td></tr>`;
      })
      .join('')}
    <tr class="tot"><td></td><td>${L('Closing total', '期末合计')}</td><td></td><td class="n">${money(tax, cur)}</td><td class="n">${money(total, cur)}</td><td class="n">${money(bal, cur)}</td></tr></table>`;
  } else if (layout === 'detailed') {
    let cards = '';
    for (const r of receipts) {
      const items = (r.lineItems || []).filter((i) => i.description || i.amount);
      const src = r.imageUri ? await imgData(r.imageUri) : null;
      const meta = [prettyDate(r.date), catLabel(r.category), r.paymentMethod, (r.tags || []).map((t) => '#' + t).join(' ')].filter(Boolean).map(esc).join(' · ');
      cards += `<div class="rc"><div class="hd"><span>${esc(r.merchant)}</span><span>${money(r.total, r.currency)}</span></div>
        <div class="mt">${meta}${r.notes ? `<br/>${esc(r.notes)}` : ''}</div>
        ${items.length ? `<table><tr><th>${L('Item', '项目')}</th><th class="n">${L('Qty', '数量')}</th><th class="n">${L('Amount', '金额')}</th></tr>${items.map((i) => `<tr><td>${esc(i.description)}</td><td class="n">${esc(i.qty)}</td><td class="n">${money(i.amount, r.currency)}</td></tr>`).join('')}</table>` : ''}
        <table><tr><td>${L('Subtotal', '小计')}</td><td class="n">${money(r.subtotal ?? (r.total - (r.tax || 0)), r.currency)}</td></tr><tr><td>${L('Tax (SST)', '税款 (SST)')}</td><td class="n">${money(r.tax, r.currency)}</td></tr><tr class="tot"><td>${T.total}</td><td class="n">${money(r.total, r.currency)}</td></tr></table>
        ${src ? `<img src="${src}"/>` : ''}</div>`;
    }
    body = `${catTable}<h2 style="page-break-before:always">${L('Receipts in detail', '收据详情')}</h2>${cards}`;
  } else {
    body = `${catTable}
    <h2>${L('Itemised expenses', '开支明细')}</h2>
    <table><tr><th>${T.date}</th><th>${T.merchant}</th><th>${T.category}</th><th>${T.payment}</th><th class="n">${T.tax}</th><th class="n">${T.total}</th></tr>
    ${receipts.map((r) => `<tr><td>${esc(prettyDate(r.date))}</td><td>${esc(r.merchant)}${r.notes ? `<br/><span class="sub">${esc(r.notes)}</span>` : ''}</td><td>${esc(catLabel(r.category))}</td><td>${esc(r.paymentMethod || '')}</td><td class="n">${money(r.tax, r.currency)}</td><td class="n">${money(r.total, r.currency)}</td></tr>`).join('')}
    </table>`;
  }

  let images = '';
  if (includeImages && layout !== 'detailed') {
    for (const r of receipts.filter((x) => x.imageUri)) {
      const src = await imgData(r.imageUri);
      if (src) images += `<div class="img"><img src="${src}"/><p>${esc(prettyDate(r.date))} · ${esc(r.merchant)} · ${esc(money(r.total, r.currency))}</p></div>`;
    }
  }

  return `<!doctype html><html lang="${isZh() ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"/><style>
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
    .rc{border:1px solid #E5E7EB;border-radius:8px;padding:12px;margin:10px 0;page-break-inside:avoid}
    .rc .hd{display:flex;justify-content:space-between;font-size:14px;font-weight:700}
    .rc .mt{color:#6B7280;margin:4px 0 8px} .rc table{margin:6px 0} .rc img{max-width:45%;max-height:360px;border:1px solid #E5E7EB;margin-top:8px}
    tr.open td{color:#6B7280;font-style:italic} td.bal{font-weight:600}
  </style></head><body>
    <div class="meta"><div><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div></div>
    <div style="text-align:right">${esc(settings.name || '')}<br/>${esc(settings.company || '')}<br/><span class="sub">${L('Generated', '生成于')} ${esc(prettyDate(new Date().toISOString().slice(0, 10)))}</span></div></div>
    <div class="kpis"><div class="kpi">${L('Total spend', '总开支')}<b>${money(total, cur)}</b></div><div class="kpi">${L('Tax (SST/GST)', '税款 (SST/GST)')}<b>${money(tax, cur)}</b></div><div class="kpi">${T.receipts}<b>${receipts.length}</b></div></div>
    ${notesBlock}
    ${body}
    ${images ? `<h2 style="page-break-before:always">${L('Receipt images', '收据图片')}</h2>${images}` : ''}
    <div class="sig"><div>${L('Submitted by', '提交人')}</div><div>${L('Approved by', '批准人')}</div><div>${T.date}</div></div>
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
export async function exportReceipts(format, receipts, settings, baseName = 'receipts', opts = {}) {
  // Names that already carry their date range don't get today's date appended.
  const stamp = /\d{4}-\d{2}-\d{2}/.test(baseName) ? '' : new Date().toISOString().slice(0, 10);
  if (format === 'csv') return emit(`${baseName}${stamp ? '_' + stamp : ''}.csv`, csvFile(receipts), 'text/csv');
  if (format === 'xlsx') return emit(`${baseName}${stamp ? '_' + stamp : ''}.xlsx`, buildWorkbookBase64(receipts), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', true);
  if (format === 'pdf') {
    const layout = opts.layout || 'summary';
    const title = { summary: L('Expense summary', '开支汇总'), detailed: L('Expense report (detailed)', '开支报告（详细）'), statement: L('Expense statement', '开支明细表') }[layout];
    const html = await buildReportHTML({ title, subtitle: opts.subtitle || L(`${receipts.length} receipts`, `${receipts.length} 张收据`), receipts, settings, layout });
    return htmlToPdf(html, `${baseName}${stamp ? '_' + stamp : ''}.pdf`);
  }
  if (format === 'zip') {
    const zip = new JSZip();
    zip.file('receipts.csv', csvFile(receipts));
    zip.file('receipts.xlsx', buildWorkbookBase64(receipts), { base64: true });
    await addImages(zip, receipts);
    return emit(`${baseName}${stamp ? '_' + stamp : ''}.zip`, await zip.generateAsync({ type: 'base64' }), 'application/zip', true);
  }
  throw new Error(L('Unknown format', '未知格式'));
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
    subtitle: `${L('Expense report', '报销报告')} · ${prettyDate(report.from)} – ${prettyDate(report.to)}${report.purpose ? ` · ${report.purpose}` : ''}`,
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
    ? `<div class="note"><b>${L(`${issues.length} open item(s) for review:`, `有 ${issues.length} 个待审核项目：`)}</b><br/>${issues
        .slice(0, 40)
        .map((i) => `• ${esc(ISSUE_LABELS[i.type])}: ${esc(i.receipt.merchant)} (${esc(prettyDate(i.receipt.date))}, ${money(i.receipt.total, i.receipt.currency)})`)
        .join('<br/>')}</div>`
    : `<div class="note">${L('All receipts in this period are categorised and reviewed.', '此期间的所有收据均已分类并审核。')}</div>`;
  const html = await buildReportHTML({
    title: L('Bookkeeping package', '记账资料包'),
    subtitle: `${period.label} · ${prettyDate(period.from)} – ${prettyDate(period.to)}${settings.accountantEmail ? ` · ${L('Prepared for', '提供给')} ${settings.accountantEmail}` : ''}`,
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
  zip.file('receipts.csv', csvFile(receipts));
  zip.file('receipts.xlsx', buildWorkbookBase64(receipts), { base64: true });
  zip.file(
    'README.txt',
    isZh()
      ? `记账资料包，来自 ${settings.name || 'ScanTrack 用户'}${settings.company ? `（${settings.company}）` : ''}\n` +
          `期间：${period.from} 至 ${period.to}\n收据：${receipts.length}\n总额：${money(sum(receipts), settings.currency)}\n税款：${money(sum(receipts, 'tax'), settings.currency)}\n\n` +
          `文件：\n  summary       - 按类别汇总及开支明细\n  receipts.csv  - 每张收据一行\n  receipts.xlsx - 收据、类别汇总、明细项目\n  images/       - 原始收据照片（文件名与“图片文件名”一栏对应）\n`
      : `Bookkeeping package from ${settings.name || 'ScanTrack user'}${settings.company ? ` (${settings.company})` : ''}\n` +
          `Period: ${period.from} to ${period.to}\nReceipts: ${receipts.length}\nTotal: ${money(sum(receipts), settings.currency)}\nTax: ${money(sum(receipts, 'tax'), settings.currency)}\n\n` +
          `Files:\n  summary       - totals by category and itemised list\n  receipts.csv  - one row per receipt\n  receipts.xlsx - receipts, category summary, line items\n  images/       - original receipt photos (file names match the "Image file name" column)\n`
  );
  await addImages(zip, receipts);
  return emit(`bookkeeping_${period.from}_${period.to}.zip`, await zip.generateAsync({ type: 'base64' }), 'application/zip', true);
}
