const Counter = require('../models/Counter');

async function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const key = `invoice_${year}`;
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `INV-${year}-${String(counter.seq).padStart(4, '0')}`;
}

module.exports = { generateInvoiceNumber };
