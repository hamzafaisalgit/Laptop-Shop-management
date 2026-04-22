const XLSX = require('xlsx');
const Laptop = require('../models/Laptop');
const { generateSku } = require('../utils/skuGenerator');
const { findMergeCandidate } = require('./mergeDetector');
const logAction = require('../utils/auditLog');

const CONDITIONS = ['New', 'Used', 'Refurbished', 'Open-box'];

function normalizeRow(raw) {
  const get = (keys) => {
    for (const k of keys) {
      const val = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (val !== undefined && val !== null && val !== '') return String(val).trim();
    }
    return undefined;
  };

  return {
    brand: get(['Brand', 'brand']),
    model: get(['Model', 'model']),
    modelNumber: get(['ModelNumber', 'Model Number', 'modelNumber']),
    condition: get(['Condition', 'condition']),
    processor: get(['Processor', 'processor', 'CPU', 'cpu']),
    generation: get(['Generation', 'generation', 'Gen']),
    ram: get(['RAM', 'Ram', 'ram', 'Memory']),
    storage: get(['Storage', 'storage', 'HDD', 'SSD']),
    gpu: get(['GPU', 'gpu', 'Graphics']),
    display: get(['Display', 'display', 'Screen']),
    battery: get(['Battery', 'battery']),
    os: get(['OS', 'os', 'Operating System']),
    keyboard: get(['Keyboard', 'keyboard']),
    ports: get(['Ports', 'ports']),
    weight: get(['Weight', 'weight']),
    color: get(['Color', 'color', 'Colour']),
    touchscreen: get(['Touchscreen', 'touchscreen', 'Touch']),
    costPrice: get(['CostPrice', 'Cost Price', 'costPrice', 'Cost']),
    sellingPrice: get(['SellingPrice', 'Selling Price', 'sellingPrice', 'Price']),
    minSalePrice: get(['MinSalePrice', 'Min Sale Price', 'minSalePrice']),
    supplier: get(['Supplier', 'supplier']),
    quantity: get(['Quantity', 'quantity', 'Qty', 'qty']),
    warrantyMonths: get(['WarrantyMonths', 'Warranty Months', 'Warranty']),
    notes: get(['Notes', 'notes']),
  };
}

function validateRow(row, lineNum) {
  const errors = [];

  if (!row.brand) errors.push('Brand is required');
  if (!row.model) errors.push('Model is required');
  if (!row.condition) errors.push('Condition is required');
  else if (!CONDITIONS.includes(row.condition)) errors.push(`Condition must be one of: ${CONDITIONS.join(', ')}`);

  const costPrice = parseFloat(row.costPrice);
  const sellingPrice = parseFloat(row.sellingPrice);
  if (!row.costPrice || isNaN(costPrice)) errors.push('CostPrice must be a valid number');
  if (!row.sellingPrice || isNaN(sellingPrice)) errors.push('SellingPrice must be a valid number');

  const quantity = parseInt(row.quantity, 10);
  if (row.quantity && isNaN(quantity)) errors.push('Quantity must be an integer');

  return { errors };
}

async function parseLaptopExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const valid = [];
  const errors = [];

  for (let i = 0; i < rawRows.length; i++) {
    const lineNum = i + 2;
    const row = normalizeRow(rawRows[i]);
    const { errors: rowErrors } = validateRow(row, lineNum);

    if (rowErrors.length) {
      errors.push({ line: lineNum, sku: row.brand ? `${row.brand} ${row.model}` : '—', errors: rowErrors, raw: rawRows[i] });
      continue;
    }

    const incoming = {
      brand: row.brand,
      model: row.model,
      modelNumber: row.modelNumber || undefined,
      condition: row.condition,
      specs: {
        processor: row.processor || undefined,
        generation: row.generation || undefined,
        ram: row.ram || undefined,
        storage: row.storage || undefined,
        gpu: row.gpu || undefined,
        display: row.display || undefined,
        battery: row.battery || undefined,
        os: row.os || undefined,
        keyboard: row.keyboard || undefined,
        ports: row.ports || undefined,
        weight: row.weight || undefined,
        color: row.color || undefined,
        touchscreen: ['true', '1', 'yes'].includes((row.touchscreen || '').toLowerCase()),
      },
      costPrice: parseFloat(row.costPrice),
      sellingPrice: parseFloat(row.sellingPrice),
      minSalePrice: row.minSalePrice ? parseFloat(row.minSalePrice) : undefined,
      supplier: row.supplier || undefined,
      quantity: row.quantity ? parseInt(row.quantity, 10) : 1,
      warrantyMonths: row.warrantyMonths ? parseInt(row.warrantyMonths, 10) : 0,
      notes: row.notes || undefined,
    };

    const mergeTarget = await findMergeCandidate(incoming);
    valid.push({
      row: incoming,
      mergeTargetId: mergeTarget?._id?.toString() || null,
      mergeTargetSku: mergeTarget?.sku || null,
      mergeTargetQty: mergeTarget?.quantity ?? null,
      line: lineNum,
    });
  }

  return { valid, errors, total: rawRows.length };
}

async function commitImport(rows, userId) {
  let created = 0;
  let merged = 0;
  let skipped = 0;
  const importErrors = [];

  for (const item of rows) {
    try {
      if (item.mergeTargetId) {
        await Laptop.findByIdAndUpdate(item.mergeTargetId, {
          $inc: { quantity: item.row.quantity || 1 },
        });
        await logAction(userId, 'MERGE_IMPORT', 'Laptop', item.mergeTargetId, { addedQty: item.row.quantity });
        merged++;
      } else {
        const sku = await generateSku(item.row.brand, item.row.model, item.row.condition);
        const laptopData = {
          sku,
          addedBy: userId,
          brand: item.row.brand,
          model: item.row.model,
          modelNumber: item.row.modelNumber,
          condition: item.row.condition,
          specs: item.row.specs,
          costPrice: Number(item.row.costPrice),
          sellingPrice: Number(item.row.sellingPrice),
          minSalePrice: item.row.minSalePrice ? Number(item.row.minSalePrice) : undefined,
          supplier: item.row.supplier,
          quantity: Number(item.row.quantity) || 1,
          warrantyMonths: Number(item.row.warrantyMonths) || 0,
          notes: item.row.notes,
        };
        const laptop = await Laptop.create(laptopData);
        await logAction(userId, 'CREATE_IMPORT', 'Laptop', laptop._id, { sku });
        created++;
      }
    } catch (err) {
      console.error(`[Import] Failed to import ${item.row?.brand} ${item.row?.model}:`, err.message);
      importErrors.push({ brand: item.row?.brand, model: item.row?.model, error: err.message });
      skipped++;
    }
  }

  return { created, merged, skipped, errors: importErrors };
}

module.exports = { parseLaptopExcel, commitImport };
