const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema({
  laptopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Laptop' },
  sku: String,
  brand: String,
  model: String,
  modelNumber: String,
  serialNumber: String,
  condition: String,
  specs: mongoose.Schema.Types.Mixed,
  trackingMode: String,
  qty: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  costPrice: { type: Number },
  lineTotal: { type: Number, required: true },
}, { _id: false });

const accessoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  qty: { type: Number, required: true, min: 1 },
  lineTotal: { type: Number, required: true },
}, { _id: false });

const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    customer: {
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
      name: { type: String, required: true },
      phone: String,
      cnic: String,
      email: String,
      address: String,
    },
    items: [saleItemSchema],
    accessories: [accessoryItemSchema],
    subtotal: { type: Number, required: true },
    discountFlat: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxFlat: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    totalCost: { type: Number, default: 0 },
    profit: { type: Number, default: 0 },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'Card', 'Bank Transfer', 'Cheque'],
      required: true,
    },
    paymentReference: String,
    notes: String,
    salesperson: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    salespersonName: String,
    status: {
      type: String,
      enum: ['completed', 'cancelled'],
      default: 'completed',
    },
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelReason: String,
    saleDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Sale', saleSchema);
