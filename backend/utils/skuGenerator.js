const Laptop = require('../models/Laptop');

async function generateSku(brand, model, condition) {
  const brandPart = (brand || 'XX').replace(/\s+/g, '').slice(0, 3).toUpperCase();
  const modelPart = (model || 'XX').replace(/\s+/g, '').slice(0, 3).toUpperCase();
  const condPart = condition ? condition.slice(0, 1).toUpperCase() : 'X';
  const prefix = `${brandPart}-${modelPart}-${condPart}`;

  const existing = await Laptop.find({ sku: new RegExp(`^${prefix}-`) })
    .select('sku')
    .lean();
  const nums = existing
    .map((l) => {
      const parts = l.sku.split('-');
      return parseInt(parts[parts.length - 1], 10) || 0;
    })
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

module.exports = { generateSku };
