const mongoose = require('mongoose');

const laptopSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    modelNumber: { type: String, trim: true },
    condition: {
      type: String,
      enum: ['New', 'Used', 'Refurbished', 'Open-box'],
      required: true,
    },
    specs: {
      processor: String,
      generation: String,
      ram: String,
      storage: String,
      gpu: String,
      display: String,
      battery: String,
      os: String,
      keyboard: String,
      ports: String,
      weight: String,
      color: String,
      touchscreen: { type: Boolean, default: false },
    },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    minSalePrice: { type: Number, min: 0 },
    supplier: String,
    purchaseDate: Date,
    warrantyMonths: { type: Number, default: 0 },
    quantity: { type: Number, required: true, default: 1, min: 0 },
    status: {
      type: String,
      enum: ['in_stock', 'sold', 'reserved', 'damaged', 'archived'],
      default: 'in_stock',
    },
    lowStockThreshold: { type: Number, default: 2 },
    notes: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

laptopSchema.index({ sku: 'text', brand: 'text', model: 'text' });

module.exports = mongoose.model('Laptop', laptopSchema);
