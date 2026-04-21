const PDFDocument = require('pdfkit');

const SHOP_NAME = process.env.SHOP_NAME || 'Laptop Shop';
const SHOP_ADDRESS = process.env.SHOP_ADDRESS || '123 Tech Street, Lahore, Pakistan';
const SHOP_PHONE = process.env.SHOP_PHONE || '+92-300-0000000';

function formatPKR(n) {
  return `PKR ${Number(n || 0).toLocaleString('en-PK')}`;
}

function formatDate(d) {
  return new Date(d || Date.now()).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

async function generateInvoicePdf(sale) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100; // usable width
    const L = 50; // left margin

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(20).font('Helvetica-Bold').fillColor('#4f46e5').text(SHOP_NAME, L, 50);
    doc.fontSize(9).font('Helvetica').fillColor('#64748b')
      .text(SHOP_ADDRESS, L, 76)
      .text(SHOP_PHONE, L, 88);

    // Invoice meta (top right)
    const metaX = 380;
    doc.fontSize(9).font('Helvetica').fillColor('#64748b');
    doc.text('INVOICE', metaX, 50, { align: 'right', width: W - (metaX - L) });
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a')
      .text(sale.invoiceNumber, metaX, 62, { align: 'right', width: W - (metaX - L) });
    doc.fontSize(9).font('Helvetica').fillColor('#64748b')
      .text(`Date: ${formatDate(sale.saleDate)}`, metaX, 86, { align: 'right', width: W - (metaX - L) })
      .text(`Payment: ${sale.paymentMethod}`, metaX, 98, { align: 'right', width: W - (metaX - L) });

    // Divider
    doc.moveDown(0.5);
    const lineY = 115;
    doc.moveTo(L, lineY).lineTo(L + W, lineY).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // ── Bill To ──────────────────────────────────────────────────────────────
    const billY = lineY + 14;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#94a3b8').text('BILL TO', L, billY);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a')
      .text(sale.customer.name, L, billY + 12);
    let custY = billY + 26;
    doc.fontSize(9).font('Helvetica').fillColor('#475569');
    if (sale.customer.phone) { doc.text(`Phone: ${sale.customer.phone}`, L, custY); custY += 12; }
    if (sale.customer.cnic) { doc.text(`CNIC: ${sale.customer.cnic}`, L, custY); custY += 12; }
    if (sale.customer.address) { doc.text(sale.customer.address, L, custY); custY += 12; }

    // ── Items Table ──────────────────────────────────────────────────────────
    const tableY = Math.max(custY + 20, billY + 70);
    const cols = { num: L, desc: L + 20, sku: L + 240, qty: L + 330, price: L + 370, total: L + 420 };

    // Table header background
    doc.rect(L, tableY, W, 18).fillColor('#f1f5f9').fill();
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569');
    doc.text('#', cols.num, tableY + 5);
    doc.text('Description', cols.desc, tableY + 5);
    doc.text('SKU / Serial', cols.sku, tableY + 5);
    doc.text('Qty', cols.qty, tableY + 5);
    doc.text('Unit Price', cols.price, tableY + 5);
    doc.text('Total', cols.total, tableY + 5);

    let rowY = tableY + 20;
    doc.font('Helvetica').fillColor('#0f172a');
    sale.items.forEach((item, i) => {
      const specStr = [item.specs?.processor, item.specs?.ram, item.specs?.storage].filter(Boolean).join(' / ');
      const desc = `${item.brand} ${item.model}${item.condition ? ` (${item.condition})` : ''}${specStr ? '\n' + specStr : ''}`;
      const descH = specStr ? 26 : 14;

      if (rowY + descH > doc.page.height - 120) {
        doc.addPage();
        rowY = 50;
      }

      if (i % 2 === 1) doc.rect(L, rowY - 2, W, descH + 4).fillColor('#f8fafc').fill();
      doc.fillColor('#0f172a').fontSize(8);
      doc.text(String(i + 1), cols.num, rowY);
      doc.text(desc, cols.desc, rowY, { width: 210 });
      doc.text(item.serialNumber || item.sku || '—', cols.sku, rowY, { width: 80 });
      doc.text(String(item.qty), cols.qty, rowY);
      doc.text(formatPKR(item.unitPrice), cols.price, rowY, { width: 60 });
      doc.text(formatPKR(item.lineTotal), cols.total, rowY, { width: 60 });
      rowY += descH + 6;
    });

    // Accessories
    if (sale.accessories?.length) {
      rowY += 6;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('ACCESSORIES', cols.desc, rowY);
      rowY += 14;
      sale.accessories.forEach((acc, i) => {
        if (i % 2 === 0) doc.rect(L, rowY - 2, W, 16).fillColor('#f8fafc').fill();
        doc.font('Helvetica').fillColor('#0f172a').fontSize(8);
        doc.text(String(sale.items.length + i + 1), cols.num, rowY);
        doc.text(acc.name, cols.desc, rowY, { width: 210 });
        doc.text('—', cols.sku, rowY);
        doc.text(String(acc.qty), cols.qty, rowY);
        doc.text(formatPKR(acc.unitPrice), cols.price, rowY, { width: 60 });
        doc.text(formatPKR(acc.lineTotal), cols.total, rowY, { width: 60 });
        rowY += 18;
      });
    }

    // Divider
    rowY += 4;
    doc.moveTo(L, rowY).lineTo(L + W, rowY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    rowY += 8;

    // ── Totals block ─────────────────────────────────────────────────────────
    const totX = L + W - 180;
    const addTotalRow = (label, value, bold = false, large = false) => {
      doc.fontSize(bold || large ? 9 : 8)
        .font(bold || large ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(large ? '#4f46e5' : '#0f172a');
      doc.text(label, totX, rowY, { width: 100 });
      doc.text(value, totX + 100, rowY, { width: 80, align: 'right' });
      rowY += large ? 18 : 14;
    };

    addTotalRow('Subtotal', formatPKR(sale.subtotal));
    if (sale.discountAmount > 0) addTotalRow(`Discount`, `- ${formatPKR(sale.discountAmount)}`);
    if (sale.taxAmount > 0) addTotalRow(`Tax`, `+ ${formatPKR(sale.taxAmount)}`);
    doc.moveTo(totX, rowY).lineTo(totX + 180, rowY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    rowY += 6;
    addTotalRow('GRAND TOTAL', formatPKR(sale.grandTotal), true, true);
    if (sale.paymentReference) {
      doc.fontSize(8).font('Helvetica').fillColor('#64748b')
        .text(`Ref: ${sale.paymentReference}`, totX, rowY, { width: 180 });
      rowY += 12;
    }

    // ── Footer ───────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 80;
    doc.moveTo(L, footerY).lineTo(L + W, footerY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
      .text('Thank you for your purchase!', L, footerY + 8, { align: 'center', width: W });
    if (sale.items.some((i) => i.warrantyMonths > 0)) {
      doc.text('Warranty applies as per manufacturer terms. Retain this invoice for warranty claims.', L, footerY + 20, { align: 'center', width: W });
    }
    doc.text(`Salesperson: ${sale.salespersonName || '—'}`, L, footerY + 34);
    doc.moveTo(L + W - 120, footerY + 42).lineTo(L + W, footerY + 42).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    doc.text('Signature', L + W - 120, footerY + 46, { width: 120, align: 'center' });

    doc.end();
  });
}

module.exports = { generateInvoicePdf };
