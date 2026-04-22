/**
 * seedDemo.js — creates 50 sample laptops + 100 sales for dashboard/reports testing.
 * Safe to run multiple times — skips if demo data already exists (> 5 laptops).
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const User = require('../models/User');
const Laptop = require('../models/Laptop');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const Counter = require('../models/Counter');

// ---------- helpers ----------
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
async function genInvoice(year) {
  const key = `invoice_${year}`;
  const counter = await Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return `INV-${year}-${String(counter.seq).padStart(4, '0')}`;
}

// ---------- static data ----------
const LAPTOP_SPECS = [
  {
    brand: 'Dell', models: [
      { model: 'Latitude 5540', modelNumber: 'N001', proc: 'Intel Core i5-1335U', ram: '16GB DDR5', storage: '512GB NVMe', cost: 145000, sell: 175000 },
      { model: 'XPS 15', modelNumber: 'N002', proc: 'Intel Core i7-13700H', ram: '16GB DDR5', storage: '1TB NVMe', cost: 265000, sell: 310000 },
      { model: 'Inspiron 15', modelNumber: 'N003', proc: 'Intel Core i5-1235U', ram: '8GB DDR4', storage: '512GB SSD', cost: 95000, sell: 118000 },
      { model: 'Precision 3480', modelNumber: 'N004', proc: 'Intel Core i7-1370P', ram: '32GB DDR5', storage: '1TB NVMe', cost: 290000, sell: 340000 },
      { model: 'Vostro 3520', modelNumber: 'N005', proc: 'Intel Core i3-1215U', ram: '8GB DDR4', storage: '256GB SSD', cost: 72000, sell: 92000 },
    ],
  },
  {
    brand: 'HP', models: [
      { model: 'EliteBook 840 G10', modelNumber: 'H001', proc: 'Intel Core i7-1355U', ram: '16GB DDR5', storage: '512GB NVMe', cost: 155000, sell: 188000 },
      { model: 'ProBook 450 G10', modelNumber: 'H002', proc: 'Intel Core i5-1335U', ram: '16GB DDR4', storage: '512GB SSD', cost: 118000, sell: 145000 },
      { model: 'Envy 15', modelNumber: 'H003', proc: 'Intel Core i7-13700H', ram: '16GB DDR5', storage: '1TB NVMe', cost: 195000, sell: 235000 },
      { model: 'Pavilion 15', modelNumber: 'H004', proc: 'Intel Core i5-1235U', ram: '8GB DDR4', storage: '512GB SSD', cost: 85000, sell: 108000 },
      { model: 'ZBook Fury 16 G10', modelNumber: 'H005', proc: 'Intel Core i9-13950HX', ram: '32GB DDR5', storage: '2TB NVMe', cost: 395000, sell: 460000 },
    ],
  },
  {
    brand: 'Lenovo', models: [
      { model: 'ThinkPad X1 Carbon', modelNumber: 'L001', proc: 'Intel Core i7-1365U', ram: '16GB LPDDR5', storage: '512GB NVMe', cost: 215000, sell: 258000 },
      { model: 'IdeaPad 5 Pro', modelNumber: 'L002', proc: 'AMD Ryzen 5 7530U', ram: '16GB DDR4', storage: '512GB SSD', cost: 105000, sell: 130000 },
      { model: 'ThinkBook 14', modelNumber: 'L003', proc: 'Intel Core i5-1335U', ram: '16GB DDR4', storage: '512GB SSD', cost: 112000, sell: 138000 },
      { model: 'Legion 5 Pro', modelNumber: 'L004', proc: 'AMD Ryzen 7 7745HX', ram: '16GB DDR5', storage: '1TB NVMe', cost: 185000, sell: 225000 },
      { model: 'Yoga 9i', modelNumber: 'L005', proc: 'Intel Core i7-1360P', ram: '16GB LPDDR5', storage: '1TB NVMe', cost: 235000, sell: 280000 },
    ],
  },
  {
    brand: 'Apple', models: [
      { model: 'MacBook Pro 14"', modelNumber: 'A001', proc: 'Apple M3 Pro', ram: '18GB Unified', storage: '512GB SSD', cost: 370000, sell: 425000 },
      { model: 'MacBook Air M2', modelNumber: 'A002', proc: 'Apple M2', ram: '8GB Unified', storage: '256GB SSD', cost: 220000, sell: 262000 },
      { model: 'MacBook Pro 16"', modelNumber: 'A003', proc: 'Apple M3 Max', ram: '36GB Unified', storage: '1TB SSD', cost: 560000, sell: 640000 },
      { model: 'MacBook Air M3', modelNumber: 'A004', proc: 'Apple M3', ram: '8GB Unified', storage: '256GB SSD', cost: 248000, sell: 295000 },
      { model: 'MacBook Pro 13"', modelNumber: 'A005', proc: 'Apple M2', ram: '16GB Unified', storage: '512GB SSD', cost: 295000, sell: 348000 },
    ],
  },
  {
    brand: 'Asus', models: [
      { model: 'ZenBook 14 OLED', modelNumber: 'U001', proc: 'Intel Core i5-1340P', ram: '16GB LPDDR5', storage: '512GB NVMe', cost: 118000, sell: 145000 },
      { model: 'VivoBook 15', modelNumber: 'U002', proc: 'AMD Ryzen 5 7520U', ram: '8GB DDR4', storage: '512GB SSD', cost: 82000, sell: 102000 },
      { model: 'ROG Strix G16', modelNumber: 'U003', proc: 'Intel Core i7-13650HX', ram: '16GB DDR5', storage: '1TB NVMe', cost: 195000, sell: 238000 },
      { model: 'ExpertBook B5', modelNumber: 'U004', proc: 'Intel Core i7-1355U', ram: '16GB DDR4', storage: '512GB SSD', cost: 145000, sell: 178000 },
      { model: 'ProArt Studiobook 16', modelNumber: 'U005', proc: 'AMD Ryzen 9 7945HX', ram: '32GB DDR5', storage: '2TB NVMe', cost: 420000, sell: 495000 },
    ],
  },
];

const PAYMENT_METHODS = ['Cash', 'Cash', 'Cash', 'Card', 'Bank Transfer'];
const CUSTOMERS_DATA = [
  { name: 'Ali Hassan', phone: '0312-1234567' },
  { name: 'Sara Khan', phone: '0321-9876543' },
  { name: 'Usman Ahmed', phone: '0333-4455667' },
  { name: 'Ayesha Malik', phone: '0345-1122334' },
  { name: 'Zain Ul Abideen', phone: '0300-7788990' },
];

// Monthly distribution: 2025-Jan to 2026-Apr
const MONTH_DIST = [
  { year: 2025, month: 0, count: 5 },
  { year: 2025, month: 1, count: 6 },
  { year: 2025, month: 2, count: 8 },
  { year: 2025, month: 3, count: 7 },
  { year: 2025, month: 4, count: 9 },
  { year: 2025, month: 5, count: 8 },
  { year: 2025, month: 6, count: 7 },
  { year: 2025, month: 7, count: 9 },
  { year: 2025, month: 8, count: 10 },
  { year: 2025, month: 9, count: 9 },
  { year: 2025, month: 10, count: 8 },
  { year: 2025, month: 11, count: 7 },
  { year: 2026, month: 0, count: 5 },
  { year: 2026, month: 1, count: 4 },
  { year: 2026, month: 2, count: 4 },
  // April 2026 — last 3 sales today
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  const laptopCount = await Laptop.countDocuments();
  if (laptopCount > 5) {
    console.log(`Demo data already exists (${laptopCount} laptops found) — skipping.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  // Ensure admin user
  let adminUser = await User.findOne({ email: 'admin@shop.local' });
  if (!adminUser) {
    const hash = await bcrypt.hash('Admin@123', 12);
    adminUser = await User.create({ name: 'Admin', email: 'admin@shop.local', passwordHash: hash, role: 'admin' });
    console.log('Created admin@shop.local');
  }

  // Ensure salesperson
  let salesperson = await User.findOne({ email: 'john@shop.local' });
  if (!salesperson) {
    const hash = await bcrypt.hash('Sales@123', 12);
    salesperson = await User.create({ name: 'John Sales', email: 'john@shop.local', passwordHash: hash, role: 'salesperson' });
    console.log('Created john@shop.local');
  }

  const users = [adminUser, adminUser, salesperson]; // 2/3 chance admin

  // Create customers
  const customers = [];
  for (const cd of CUSTOMERS_DATA) {
    let c = await Customer.findOne({ phone: cd.phone });
    if (!c) c = await Customer.create(cd);
    customers.push(c);
  }
  console.log(`Customers ready: ${customers.length}`);

  // Create 25 batch laptops (New) + 25 unit laptops (Used/Refurbished/Open-box)
  const batchLaptops = [];
  let skuSeq = 100;

  for (const brand of LAPTOP_SPECS) {
    for (const m of brand.models) {
      skuSeq++;
      const sku = `DEMO-${brand.brand.substring(0, 3).toUpperCase()}-N-${String(skuSeq).padStart(3, '0')}`;
      const laptop = await Laptop.create({
        sku,
        
        brand: brand.brand,
        model: m.model,
        modelNumber: m.modelNumber,
        condition: 'New',
        specs: { processor: m.proc, ram: m.ram, storage: m.storage, display: '15.6" FHD', os: brand.brand === 'Apple' ? 'macOS' : 'Windows 11 Pro' },
        costPrice: m.cost,
        sellingPrice: m.sell,
        minSalePrice: Math.round(m.cost * 1.03),
        quantity: 20,
        lowStockThreshold: 3,
        addedBy: adminUser._id,
      });
      batchLaptops.push(laptop);
    }
  }
  console.log(`Created ${batchLaptops.length} batch laptops`);

  // 25 unit laptops (Used/Refurbished/Open-box)
  const unitConditions = ['Used', 'Refurbished', 'Open-box'];
  for (let i = 0; i < 25; i++) {
    skuSeq++;
    const brandData = LAPTOP_SPECS[i % 5];
    const modelData = brandData.models[Math.floor(i / 5)];
    const cond = unitConditions[i % 3];
    const costDiscount = cond === 'Used' ? 0.55 : cond === 'Refurbished' ? 0.65 : 0.75;
    const cost = Math.round(modelData.cost * costDiscount / 1000) * 1000;
    const sell = Math.round(cost * 1.22 / 1000) * 1000;
    const sku = `DEMO-${brandData.brand.substring(0, 3).toUpperCase()}-U-${String(skuSeq).padStart(3, '0')}`;
    await Laptop.create({
      sku,
      brand: brandData.brand,
      model: modelData.model,
      modelNumber: modelData.modelNumber,
      condition: cond,
      specs: { processor: modelData.proc, ram: modelData.ram, storage: modelData.storage },
      costPrice: cost,
      sellingPrice: sell,
      minSalePrice: Math.round(cost * 1.05),
      quantity: 1,
      status: 'in_stock',
      addedBy: adminUser._id,
    });
  }
  console.log('Created 25 unit laptops');

  // Create 100 sales across months
  let totalSales = 0;

  for (const { year, month, count } of MONTH_DIST) {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 20, 0, 0);

    for (let i = 0; i < count; i++) {
      const saleDate = randDate(monthStart, monthEnd);
      const laptop = rand(batchLaptops);
      const qty = 1;
      const unitPrice = laptop.sellingPrice;
      const costPrice = laptop.costPrice;
      const lineTotal = unitPrice * qty;
      const discountAmount = Math.random() < 0.3 ? randInt(1000, 8000) : 0;
      const grandTotal = lineTotal - discountAmount;
      const totalCost = costPrice * qty;
      const profit = grandTotal - totalCost;
      const customer = rand(customers);
      const seller = rand(users);
      const invoiceNumber = await genInvoice(year);

      await Sale.create({
        invoiceNumber,
        customer: {
          customerId: customer._id,
          name: customer.name,
          phone: customer.phone,
        },
        items: [{
          laptopId: laptop._id,
          sku: laptop.sku,
          brand: laptop.brand,
          model: laptop.model,
          condition: laptop.condition,
          specs: laptop.specs,
          
          qty,
          unitPrice,
          costPrice,
          lineTotal,
        }],
        accessories: [],
        subtotal: lineTotal,
        discountFlat: discountAmount,
        discountAmount,
        taxAmount: 0,
        grandTotal,
        totalCost,
        profit,
        paymentMethod: rand(PAYMENT_METHODS),
        salesperson: seller._id,
        salespersonName: seller.name,
        status: 'completed',
        saleDate,
      });

      // Decrement batch quantity (minimal — each has 20 units)
      await Laptop.findByIdAndUpdate(laptop._id, { $inc: { quantity: -qty } });
      totalSales++;
    }
    console.log(`  ${year}-${String(month + 1).padStart(2, '0')}: ${count} sales`);
  }

  // Add 3 sales today (2026-04-21)
  const today = new Date();
  today.setHours(10, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    const saleDate = new Date(today.getTime() + i * 2 * 3600 * 1000);
    const laptop = batchLaptops[i];
    const unitPrice = laptop.sellingPrice;
    const costPrice = laptop.costPrice;
    const grandTotal = unitPrice;
    const totalCost = costPrice;
    const profit = grandTotal - totalCost;
    const customer = customers[i % customers.length];
    const invoiceNumber = await genInvoice(2026);

    await Sale.create({
      invoiceNumber,
      customer: { customerId: customer._id, name: customer.name, phone: customer.phone },
      items: [{
        laptopId: laptop._id,
        sku: laptop.sku,
        brand: laptop.brand,
        model: laptop.model,
        condition: laptop.condition,
        specs: laptop.specs,
        
        qty: 1,
        unitPrice,
        costPrice,
        lineTotal: unitPrice,
      }],
      accessories: [],
      subtotal: unitPrice,
      discountFlat: 0,
      discountAmount: 0,
      taxAmount: 0,
      grandTotal,
      totalCost,
      profit,
      paymentMethod: rand(PAYMENT_METHODS),
      salesperson: adminUser._id,
      salespersonName: adminUser.name,
      status: 'completed',
      saleDate,
    });
    await Laptop.findByIdAndUpdate(laptop._id, { $inc: { quantity: -1 } });
    totalSales++;
  }

  console.log(`\nDemo seed complete!`);
  console.log(`  Batch laptops: ${batchLaptops.length}`);
  console.log(`  Unit laptops: 25`);
  console.log(`  Sales created: ${totalSales}`);
  console.log(`\nCredentials:`);
  console.log(`  Admin:       admin@shop.local  /  Admin@123`);
  console.log(`  Salesperson: john@shop.local   /  Sales@123`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
