const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const logAction = require('../utils/auditLog');

exports.search = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 25 } = req.query;
    const filter = search
      ? { $or: [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }] }
      : {};
    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();
    res.json({ data: customers, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ message: 'Not found' });

    const sales = await Sale.find({ 'customer.customerId': req.params.id })
      .select('invoiceNumber grandTotal saleDate status paymentMethod')
      .sort('-saleDate')
      .lean();

    res.json({ ...customer, sales });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, phone, cnic, email, address } = req.body;
    if (!name || !phone) return res.status(400).json({ message: 'Name and phone are required' });
    const customer = await Customer.create({ name, phone, cnic, email, address });
    await logAction(req.user._id, 'CREATE', 'Customer', customer._id, { name, phone });
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!customer) return res.status(404).json({ message: 'Not found' });
    await logAction(req.user._id, 'UPDATE', 'Customer', customer._id, req.body);
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
