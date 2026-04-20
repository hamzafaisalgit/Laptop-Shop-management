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
    trackingMode: get(['TrackingMode', 'Tracking Mode', 'trackingMode']),
    serialNumber: get(['SerialNumber', 'Serial Number', 'serialNumber']),
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

  const trackingMode = row.trackingMode ||
    (row.condition === 'New' ? 'batch' : 'unit');

  if (trackingMode === 'unit' && !row.serialNumber) {
    errors.push('SerialNumber required for unit tracking');
  }

  const quantity = parseInt(row.quantity, 10);
  if (row.quantity && isNaN(quantity)) errors.push('Quantity must be an integer');

  return { errors, trackingMode };
}

async function parseLaptopExcel(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const valid = [];
  const errors = [];

  for (let i = 0; i < rawRows.length; i++) {
    const lineNum = i + 2; // 1 for header, 1-based
    const row = normalizeRow(rawRows[i]);
    const { errors: rowErrors, trackingMode } = validateRow(row, lineNum);

    if (rowErrors.length) {
      errors.push({ line: lineNum, sku: row.brand ? `${row.brand} ${row.model}` : '—', errors: rowErrors, raw: rawRows[i] });
      continue;
    }

    const incoming = {
      brand: row.brand,
      model: row.model,
      modelNumber: row.modelNumber,
      condition: row.condition,
      trackingMode,
      serialNumber: row.serialNumber,
      specs: {
        processor: row.processor,
        generation: row.generation,
        ram: row.ram,
        storage: row.storage,
        gpu: row.gpu,
        display: row.display,
        battery: row.battery,
        os: row.os,
        keyboard: row.keyboard,
        ports: row.ports,
        weight: row.weight,
        color: row.color,
        touchscreen: ['true', '1', 'yes'].includes((row.touchscreen || '').toLowerCase()),
      },
      costPrice: parseFloat(row.costPrice),
      sellingPrice: parseFloat(row.sellingPrice),
      minSalePrice: row.minSalePrice ? parseFloat(row.minSalePrice) : undefined,
      supplier: row.supplier,
      quantity: row.quantity ? parseInt(row.quantity, 10) : (trackingMode === 'batch' ? 1 : 1),
      warrantyMonths: row.warrantyMonths ? parseInt(row.warrantyMonths, 10) : 0,
      notes: row.notes,
    };

    const mergeTarget = await findMergeCandidate(incoming);
    valid.push({ row: incoming, mergeTargetId: mergeTarget?._id?.toString() || null, mergeTargetSku: mergeTarget?.sku || null, mergeTargetQty: mergeTarget?.quantity ?? null, line: lineNum });
  }

  return { valid, errors, total: rawRows.length };
}

async function commitImport(rows, userId) {
  let created = 0;
  let merged = 0;
  let skipped = 0;

  for (const item of rows) {
    try {
      if (item.mergeTargetId) {
        await Laptop.findByIdAndUpdate(item.mergeTargetId, {
          $inc: { quantity: item.row.quantity },
        });
        await logAction(userId, 'MERGE_IMPORT', 'Laptop', item.mergeTargetId, { addedQty: item.row.quantity });
        merged++;
      } else {
        const sku = await generateSku(item.row.brand, item.row.model, item.row.condition);
        const laptop = await Laptop.create({ ...item.row, sku, addedBy: userId });
        await logAction(userId, 'CREATE_IMPORT', 'Laptop', laptop._id, { sku });
        created++;
      }
    } catch {
      skipped++;
    }
  }

  return { created, merged, skipped };
}

module.exports = { parseLaptopExcel, commitImport };
