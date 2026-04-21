const Laptop = require('../models/Laptop');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const { generateInvoiceNumber } = require('../utils/generateInvoiceNumber');
const { generateInvoicePdf } = require('../services/invoicePdf');
const logAction = require('../utils/auditLog');

// POST /api/sales
exports.create = async (req, res) => {
  try {
    const {
      customer: customerInput,
      items = [],
      accessories = [],
      discountFlat = 0, discountPercent = 0,
      taxFlat = 0, taxPercent = 0,
      paymentMethod, paymentReference, notes,
    } = req.body;

    if (!items.length) return res.status(400).json({ message: 'At least one item required' });
    if (!paymentMethod) return res.status(400).json({ message: 'Payment method required' });
    if (!customerInput?.name) return res.status(400).json({ message: 'Customer name required' });

    // Validate and snapshot laptop items
    const saleItems = [];
    let totalCost = 0;

    for (const item of items) {
      const laptop = await Laptop.findById(item.laptopId);
      if (!laptop || laptop.archived) return res.status(400).json({ message: `Laptop ${item.laptopId} not found` });
      if (laptop.status === 'sold') return res.status(400).json({ message: `${laptop.brand} ${laptop.model} is already sold` });

      const soldQty = item.qty || 1;
      if (laptop.trackingMode === 'batch' && laptop.quantity < soldQty) {
        return res.status(400).json({ message: `Not enough stock for ${laptop.brand} ${laptop.model} (have ${laptop.quantity})` });
      }
      if (laptop.trackingMode === 'unit' && soldQty !== 1) {
        return res.status(400).json({ message: `Unit items can only be sold as qty 1` });
      }

      const unitPrice = item.unitPrice ?? laptop.sellingPrice;
      saleItems.push({
        laptopId: laptop._id,
        sku: laptop.sku,
        brand: laptop.brand,
        model: laptop.model,
        modelNumber: laptop.modelNumber,
        serialNumber: laptop.serialNumber,
        condition: laptop.condition,
        specs: laptop.specs,
        trackingMode: laptop.trackingMode,
        qty: soldQty,
        unitPrice,
        costPrice: laptop.costPrice,
        lineTotal: unitPrice * soldQty,
      });
      totalCost += (laptop.costPrice || 0) * soldQty;
    }

    // Accessories
    const saleAccessories = accessories.map((a) => ({
      name: a.name,
      unitPrice: a.unitPrice,
      qty: a.qty || 1,
      lineTotal: a.unitPrice * (a.qty || 1),
    }));

    // Totals
    const itemsSubtotal = saleItems.reduce((s, i) => s + i.lineTotal, 0);
    const accSubtotal = saleAccessories.reduce((s, a) => s + a.lineTotal, 0);
    const subtotal = itemsSubtotal + accSubtotal;

    const discountAmount = (discountFlat || 0) + (subtotal * (discountPercent || 0) / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = (taxFlat || 0) + (afterDiscount * (taxPercent || 0) / 100);
    const grandTotal = afterDiscount + taxAmount;
    const profit = grandTotal - totalCost;

    // Handle customer
    let customerId = customerInput.customerId;
    if (!customerId) {
      const existing = customerInput.phone
        ? await Customer.findOne({ phone: customerInput.phone })
        : null;
      if (existing) {
        customerId = existing._id;
      } else {
        const newCust = await Customer.create({
          name: customerInput.name,
          phone: customerInput.phone,
          cnic: customerInput.cnic,
          email: customerInput.email,
          address: customerInput.address,
        });
        customerId = newCust._id;
      }
    }

    const invoiceNumber = await generateInvoiceNumber();

    const sale = await Sale.create({
      invoiceNumber,
      customer: {
        customerId,
        name: customerInput.name,
        phone: customerInput.phone,
        cnic: customerInput.cnic,
        email: customerInput.email,
        address: customerInput.address,
      },
      items: saleItems,
      accessories: saleAccessories,
      subtotal,
      discountFlat, discountPercent, discountAmount,
      taxFlat, taxPercent, taxAmount,
      grandTotal,
      totalCost,
      profit,
      paymentMethod,
      paymentReference,
      notes,
      salesperson: req.user._id,
      salespersonName: req.user.name,
    });

    // Update inventory
    for (const item of saleItems) {
      if (item.trackingMode === 'batch') {
        await Laptop.findByIdAndUpdate(item.laptopId, { $inc: { quantity: -item.qty } });
      } else {
        await Laptop.findByIdAndUpdate(item.laptopId, {
          status: 'sold',
          soldAt: new Date(),
          soldInvoiceId: sale._id,
        });
      }
    }

    // Update customer stats
    await Customer.findByIdAndUpdate(customerId, {
      $inc: { totalPurchases: 1, totalSpent: grandTotal },
    });

    await logAction(req.user._id, 'CREATE_SALE', 'Sale', sale._id, { invoiceNumber, grandTotal });

    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales
exports.list = async (req, res) => {
  try {
    const { from, to, customer, salesperson, paymentMethod, search, page = 1, limit = 25 } = req.query;
    const filter = {};

    if (from || to) {
      filter.saleDate = {};
      if (from) filter.saleDate.$gte = new Date(from);
      if (to) filter.saleDate.$lte = new Date(new Date(to).setHours(23, 59, 59));
    }
    if (customer) filter['customer.customerId'] = customer;
    if (salesperson && req.user.role === 'admin') filter.salesperson = salesperson;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (search) {
      filter.$or = [
        { invoiceNumber: new RegExp(search, 'i') },
        { 'customer.name': new RegExp(search, 'i') },
        { 'customer.phone': new RegExp(search, 'i') },
      ];
    }

    const total = await Sale.countDocuments(filter);
    const sales = await Sale.find(filter)
      .sort('-saleDate')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('salesperson', 'name')
      .lean();

    // Strip profit from salesperson
    const data = sales.map((s) => {
      if (req.user.role !== 'admin') {
        delete s.profit;
        delete s.totalCost;
        s.items = s.items.map((i) => { delete i.costPrice; return i; });
      }
      return s;
    });

    res.json({ data, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales/:id
exports.getOne = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).populate('salesperson', 'name').lean();
    if (!sale) return res.status(404).json({ message: 'Not found' });
    if (req.user.role !== 'admin') {
      delete sale.profit; delete sale.totalCost;
      sale.items = sale.items.map((i) => { delete i.costPrice; return i; });
    }
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/sales/:id/invoice
exports.getInvoice = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).lean();
    if (!sale) return res.status(404).json({ message: 'Not found' });
    const pdf = await generateInvoicePdf(sale);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${sale.invoiceNumber}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/sales/:id/cancel (admin only)
exports.cancel = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Not found' });
    if (sale.status === 'cancelled') return res.status(400).json({ message: 'Already cancelled' });

    // Restore inventory
    for (const item of sale.items) {
      if (item.trackingMode === 'batch') {
        await Laptop.findByIdAndUpdate(item.laptopId, { $inc: { quantity: item.qty } });
      } else {
        await Laptop.findByIdAndUpdate(item.laptopId, {
          status: 'in_stock',
          $unset: { soldAt: '', soldInvoiceId: '' },
        });
      }
    }

    // Reverse customer stats
    if (sale.customer.customerId) {
      await Customer.findByIdAndUpdate(sale.customer.customerId, {
        $inc: { totalPurchases: -1, totalSpent: -sale.grandTotal },
      });
    }

    sale.status = 'cancelled';
    sale.cancelledAt = new Date();
    sale.cancelledBy = req.user._id;
    sale.cancelReason = req.body.reason || '';
    await sale.save();

    await logAction(req.user._id, 'CANCEL_SALE', 'Sale', sale._id, { reason: sale.cancelReason });
    res.json({ message: 'Sale cancelled', sale });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
