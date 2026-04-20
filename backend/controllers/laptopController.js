const Laptop = require('../models/Laptop');
const { generateSku } = require('../utils/skuGenerator');
const { findMergeCandidate } = require('../services/mergeDetector');
const { parseLaptopExcel, commitImport } = require('../services/laptopImport');
const logAction = require('../utils/auditLog');
const XLSX = require('xlsx');

// Strip sensitive fields for salesperson
function sanitizeForRole(laptopObj, role) {
  if (role !== 'admin') {
    delete laptopObj.costPrice;
    delete laptopObj.minSalePrice;
  }
  return laptopObj;
}

// GET /api/laptops
exports.list = async (req, res) => {
  try {
    const { search, condition, status, page = 1, limit = 25, sort = '-createdAt' } = req.query;
    const filter = { archived: { $ne: true } };

    if (search) {
      const re = new RegExp(search, 'i');
      filter.$or = [
        { sku: re }, { brand: re }, { model: re },
        { serialNumber: re }, { 'specs.processor': re },
      ];
    }
    if (condition) filter.condition = condition;
    if (status) filter.status = status;

    const total = await Laptop.countDocuments(filter);
    const laptops = await Laptop.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const data = laptops.map((l) => sanitizeForRole(l, req.user.role));

    res.json({ data, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/laptops/:id
exports.getOne = async (req, res) => {
  try {
    const laptop = await Laptop.findById(req.params.id).lean();
    if (!laptop || laptop.archived) return res.status(404).json({ message: 'Not found' });
    res.json(sanitizeForRole(laptop, req.user.role));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/laptops
exports.create = async (req, res) => {
  try {
    const body = req.body;
    const { forceMerge, forceNew } = req.query;

    // Determine trackingMode default
    if (!body.trackingMode) {
      body.trackingMode = body.condition === 'New' ? 'batch' : 'unit';
    }

    // Check for merge candidate (only if not forced)
    if (!forceNew) {
      const candidate = await findMergeCandidate(body);
      if (candidate && !forceMerge) {
        return res.status(409).json({
          mergeAvailable: true,
          existingId: candidate._id,
          existingSku: candidate.sku,
          existingQty: candidate.quantity,
        });
      }
      if (candidate && forceMerge) {
        await Laptop.findByIdAndUpdate(candidate._id, {
          $inc: { quantity: body.quantity || 1 },
        });
        await logAction(req.user._id, 'MERGE', 'Laptop', candidate._id, { addedQty: body.quantity || 1 });
        const updated = await Laptop.findById(candidate._id).lean();
        return res.json(sanitizeForRole(updated, req.user.role));
      }
    }

    const sku = await generateSku(body.brand, body.model, body.condition);
    const laptop = await Laptop.create({ ...body, sku, addedBy: req.user._id });
    await logAction(req.user._id, 'CREATE', 'Laptop', laptop._id, { sku });
    res.status(201).json(sanitizeForRole(laptop.toObject(), req.user.role));
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'SKU already exists' });
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/laptops/:id
exports.update = async (req, res) => {
  try {
    const body = { ...req.body };
    // Salesperson cannot update price fields
    if (req.user.role !== 'admin') {
      delete body.costPrice;
      delete body.minSalePrice;
      delete body.sellingPrice;
    }
    const laptop = await Laptop.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true }).lean();
    if (!laptop) return res.status(404).json({ message: 'Not found' });
    await logAction(req.user._id, 'UPDATE', 'Laptop', laptop._id, body);
    res.json(sanitizeForRole(laptop, req.user.role));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PATCH /api/laptops/:id/quantity
exports.updateQuantity = async (req, res) => {
  try {
    const { delta } = req.body;
    if (typeof delta !== 'number' || !Number.isInteger(delta)) {
      return res.status(400).json({ message: 'delta must be an integer' });
    }
    // Salesperson can only increment
    if (req.user.role !== 'admin' && delta < 0) {
      return res.status(403).json({ message: 'Salespersons cannot decrease stock' });
    }

    const laptop = await Laptop.findById(req.params.id);
    if (!laptop) return res.status(404).json({ message: 'Not found' });
    if (laptop.quantity + delta < 0) {
      return res.status(400).json({ message: 'Quantity cannot go below 0' });
    }

    const updated = await Laptop.findByIdAndUpdate(
      req.params.id,
      { $inc: { quantity: delta } },
      { new: true }
    ).lean();

    await logAction(req.user._id, delta > 0 ? 'STOCK_IN' : 'STOCK_OUT', 'Laptop', updated._id, { delta, newQty: updated.quantity });
    res.json(sanitizeForRole(updated, req.user.role));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/laptops/:id (admin only, soft delete)
exports.remove = async (req, res) => {
  try {
    const laptop = await Laptop.findById(req.params.id);
    if (!laptop) return res.status(404).json({ message: 'Not found' });

    laptop.archived = true;
    laptop.status = 'archived';
    await laptop.save();
    await logAction(req.user._id, 'ARCHIVE', 'Laptop', laptop._id, {});
    res.json({ message: 'Archived' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/laptops/low-stock
exports.lowStock = async (req, res) => {
  try {
    const laptops = await Laptop.find({
      trackingMode: 'batch',
      archived: { $ne: true },
      $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
    }).lean();
    res.json(laptops.map((l) => sanitizeForRole(l, req.user.role)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/laptops/import/preview (no DB writes)
exports.importPreview = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const result = await parseLaptopExcel(req.file.buffer);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// POST /api/laptops/import/commit
exports.importCommit = async (req, res) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) return res.status(400).json({ message: 'rows array required' });
    const result = await commitImport(rows, req.user._id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/laptops/import/template  — returns xlsx template
exports.downloadTemplate = (_req, res) => {
  const headers = [
    'Brand', 'Model', 'ModelNumber', 'Condition', 'TrackingMode', 'SerialNumber',
    'Processor', 'Generation', 'RAM', 'Storage', 'GPU', 'Display', 'Battery',
    'OS', 'Keyboard', 'Ports', 'Weight', 'Color', 'Touchscreen',
    'CostPrice', 'SellingPrice', 'MinSalePrice', 'Supplier', 'Quantity', 'WarrantyMonths', 'Notes',
  ];
  const example = [
    'Dell', 'XPS 13', '9310', 'New', 'batch', '',
    'Intel Core i7-1165G7', '11th Gen', '16GB', '512GB SSD', 'Intel Iris Xe', '13.4" FHD', '52Wh',
    'Windows 11 Home', 'Backlit', 'USB-C x2, USB-A', '1.27kg', 'Platinum Silver', 'No',
    '85000', '110000', '95000', 'TechSource', '5', '12', '',
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  // Set column widths
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Laptops');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=laptop_import_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};

// GET /api/laptops/:id/audit
exports.getAudit = async (req, res) => {
  try {
    const AuditLog = require('../models/AuditLog');
    const logs = await AuditLog.find({ entity: 'Laptop', entityId: req.params.id })
      .sort('-createdAt')
      .limit(20)
      .populate('user', 'name email')
      .lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
