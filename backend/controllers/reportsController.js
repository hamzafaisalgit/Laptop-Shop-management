const Sale = require('../models/Sale');
const Laptop = require('../models/Laptop');
const XLSX = require('xlsx');

function salesPipeline(match) {
  return Sale.aggregate([
    { $match: { status: 'completed', ...match } },
    {
      $addFields: {
        itemQtySum: { $sum: '$items.qty' },
      },
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: '$grandTotal' },
        cost: { $sum: '$totalCost' },
        profit: { $sum: '$profit' },
        salesCount: { $sum: 1 },
        unitsSold: { $sum: '$itemQtySum' },
      },
    },
  ]);
}

function delta(curr, prev) {
  if (prev === 0) return null;
  return parseFloat(((curr - prev) / prev * 100).toFixed(1));
}

exports.getDashboard = async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const trendStart = new Date(now);
    trendStart.setDate(trendStart.getDate() - 29);
    trendStart.setHours(0, 0, 0, 0);

    const [todayData, monthData, prevMonthData, yearData, invData, recentSales, topBrands, salesTrend, lowStockItems] =
      await Promise.all([
        salesPipeline({ saleDate: { $gte: todayStart, $lte: todayEnd } }),
        salesPipeline({ saleDate: { $gte: monthStart, $lte: monthEnd } }),
        salesPipeline({ saleDate: { $gte: prevMonthStart, $lte: prevMonthEnd } }),
        salesPipeline({ saleDate: { $gte: yearStart, $lte: yearEnd } }),

        Laptop.aggregate([
          { $match: { archived: false } },
          {
            $group: {
              _id: null,
              totalUnits: { $sum: { $cond: [{ $eq: ['$trackingMode', 'unit'] }, 1, 0] } },
              totalBatches: { $sum: { $cond: [{ $eq: ['$trackingMode', 'batch'] }, 1, 0] } },
              stockValueCost: { $sum: { $multiply: ['$quantity', '$costPrice'] } },
              stockValueRetail: { $sum: { $multiply: ['$quantity', '$sellingPrice'] } },
              lowStockCount: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$trackingMode', 'batch'] },
                        { $lte: ['$quantity', '$lowStockThreshold'] },
                        { $gt: ['$quantity', 0] },
                      ],
                    },
                    1, 0,
                  ],
                },
              },
            },
          },
        ]),

        Sale.find({ status: 'completed' })
          .sort({ saleDate: -1 })
          .limit(10)
          .select('invoiceNumber customer grandTotal saleDate paymentMethod')
          .lean(),

        Sale.aggregate([
          { $match: { status: 'completed', saleDate: { $gte: monthStart, $lte: monthEnd } } },
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.brand',
              unitsSold: { $sum: '$items.qty' },
              revenue: { $sum: '$items.lineTotal' },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 5 },
          { $project: { brand: '$_id', unitsSold: 1, revenue: 1, _id: 0 } },
        ]),

        Sale.aggregate([
          { $match: { status: 'completed', saleDate: { $gte: trendStart } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$saleDate' } },
              revenue: { $sum: '$grandTotal' },
              profit: { $sum: '$profit' },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { date: '$_id', revenue: 1, profit: 1, count: 1, _id: 0 } },
        ]),

        Laptop.find({
          archived: false,
          trackingMode: 'batch',
          $expr: { $lte: ['$quantity', '$lowStockThreshold'] },
          quantity: { $gt: 0 },
        })
          .select('sku brand model quantity lowStockThreshold')
          .lean(),
      ]);

    const today = todayData[0] || { revenue: 0, salesCount: 0, profit: 0, unitsSold: 0 };
    const month = monthData[0] || { revenue: 0, salesCount: 0, profit: 0, unitsSold: 0 };
    const prevMonth = prevMonthData[0] || { revenue: 0, salesCount: 0, profit: 0, unitsSold: 0 };
    const year = yearData[0] || { revenue: 0, salesCount: 0, profit: 0, unitsSold: 0 };
    const inv = invData[0] || { totalUnits: 0, totalBatches: 0, stockValueCost: 0, stockValueRetail: 0, lowStockCount: 0 };

    res.json({
      today,
      thisMonth: {
        ...month,
        avgSaleValue: month.salesCount > 0 ? month.revenue / month.salesCount : 0,
        revenueGrowth: delta(month.revenue, prevMonth.revenue),
        profitGrowth: delta(month.profit, prevMonth.profit),
      },
      thisYear: year,
      inventory: inv,
      recentSales,
      topBrands,
      salesTrend,
      lowStockItems,
    });
  } catch (err) {
    next(err);
  }
};

exports.getMonthly = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const data = await Sale.aggregate([
      { $match: { status: 'completed', saleDate: { $gte: yearStart, $lte: yearEnd } } },
      {
        $addFields: { itemQtySum: { $sum: '$items.qty' } },
      },
      {
        $group: {
          _id: { $month: '$saleDate' },
          revenue: { $sum: '$grandTotal' },
          cost: { $sum: '$totalCost' },
          profit: { $sum: '$profit' },
          salesCount: { $sum: 1 },
          unitsSold: { $sum: '$itemQtySum' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const byMonth = {};
    data.forEach((d) => { byMonth[d._id] = d; });

    let prevRevenue = 0;
    const rows = MONTHS.map((name, i) => {
      const m = byMonth[i + 1] || { revenue: 0, cost: 0, profit: 0, salesCount: 0, unitsSold: 0 };
      const margin = m.revenue > 0 ? parseFloat(((m.profit / m.revenue) * 100).toFixed(1)) : 0;
      const growth = prevRevenue > 0 ? parseFloat(((m.revenue - prevRevenue) / prevRevenue * 100).toFixed(1)) : null;
      prevRevenue = m.revenue;
      return { month: name, monthNum: i + 1, revenue: m.revenue, cost: m.cost, profit: m.profit, margin, salesCount: m.salesCount, unitsSold: m.unitsSold, growth };
    });

    res.json({ year, rows });
  } catch (err) {
    next(err);
  }
};

exports.getYearly = async (req, res, next) => {
  try {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 4;

    const data = await Sale.aggregate([
      { $match: { status: 'completed', saleDate: { $gte: new Date(startYear, 0, 1) } } },
      {
        $addFields: { itemQtySum: { $sum: '$items.qty' } },
      },
      {
        $group: {
          _id: { $year: '$saleDate' },
          revenue: { $sum: '$grandTotal' },
          cost: { $sum: '$totalCost' },
          profit: { $sum: '$profit' },
          salesCount: { $sum: 1 },
          unitsSold: { $sum: '$itemQtySum' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const byYear = {};
    data.forEach((d) => { byYear[d._id] = d; });

    const rows = [];
    for (let y = startYear; y <= currentYear; y++) {
      const d = byYear[y] || { revenue: 0, cost: 0, profit: 0, salesCount: 0, unitsSold: 0 };
      const margin = d.revenue > 0 ? parseFloat(((d.profit / d.revenue) * 100).toFixed(1)) : 0;
      rows.push({ year: y, revenue: d.revenue, cost: d.cost, profit: d.profit, margin, salesCount: d.salesCount, unitsSold: d.unitsSold || 0 });
    }

    res.json({ rows });
  } catch (err) {
    next(err);
  }
};

exports.getSalesByBrand = async (req, res, next) => {
  try {
    const match = { status: 'completed' };
    if (req.query.from || req.query.to) {
      match.saleDate = {};
      if (req.query.from) match.saleDate.$gte = new Date(req.query.from);
      if (req.query.to) match.saleDate.$lte = new Date(req.query.to + 'T23:59:59');
    }

    const data = await Sale.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.brand',
          unitsSold: { $sum: '$items.qty' },
          revenue: { $sum: '$items.lineTotal' },
          cost: {
            $sum: {
              $multiply: [
                { $ifNull: ['$items.costPrice', 0] },
                '$items.qty',
              ],
            },
          },
        },
      },
      {
        $addFields: {
          profit: { $subtract: ['$revenue', '$cost'] },
        },
      },
      { $sort: { revenue: -1 } },
      { $project: { brand: '$_id', unitsSold: 1, revenue: 1, cost: 1, profit: 1, _id: 0 } },
    ]);

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

exports.getSlowMovers = async (req, res, next) => {
  try {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 90);

    const data = await Laptop.find({
      archived: false,
      status: 'in_stock',
      createdAt: { $lte: threshold },
    })
      .sort({ createdAt: 1 })
      .select('sku brand model condition specs costPrice sellingPrice quantity createdAt')
      .lean();

    const now = new Date();
    const rows = data.map((l) => ({
      ...l,
      ageInDays: Math.floor((now - new Date(l.createdAt)) / (1000 * 60 * 60 * 24)),
    }));

    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

exports.getSalespersonPerformance = async (req, res, next) => {
  try {
    const match = { status: 'completed' };
    if (req.query.from || req.query.to) {
      match.saleDate = {};
      if (req.query.from) match.saleDate.$gte = new Date(req.query.from);
      if (req.query.to) match.saleDate.$lte = new Date(req.query.to + 'T23:59:59');
    }

    const data = await Sale.aggregate([
      { $match: match },
      {
        $addFields: { itemQtySum: { $sum: '$items.qty' } },
      },
      {
        $group: {
          _id: { id: '$salesperson', name: '$salespersonName' },
          salesCount: { $sum: 1 },
          revenue: { $sum: '$grandTotal' },
          profit: { $sum: '$profit' },
          unitsSold: { $sum: '$itemQtySum' },
        },
      },
      { $sort: { revenue: -1 } },
      {
        $project: {
          name: '$_id.name',
          salesCount: 1,
          revenue: 1,
          profit: 1,
          unitsSold: 1,
          profitMargin: {
            $cond: [
              { $gt: ['$revenue', 0] },
              { $multiply: [{ $divide: ['$profit', '$revenue'] }, 100] },
              0,
            ],
          },
          _id: 0,
        },
      },
    ]);

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

exports.exportSales = async (req, res, next) => {
  try {
    const match = { status: 'completed' };
    if (req.query.from || req.query.to) {
      match.saleDate = {};
      if (req.query.from) match.saleDate.$gte = new Date(req.query.from);
      if (req.query.to) match.saleDate.$lte = new Date(req.query.to + 'T23:59:59');
    }

    const sales = await Sale.find(match).sort({ saleDate: -1 }).lean();

    const rows = sales.map((s) => ({
      'Invoice Number': s.invoiceNumber,
      Date: new Date(s.saleDate).toLocaleDateString('en-GB'),
      Customer: s.customer.name,
      'Customer Phone': s.customer.phone || '',
      Items: s.items.map((i) => `${i.brand} ${i.model} x${i.qty}`).join('; '),
      Subtotal: s.subtotal,
      'Discount Amount': s.discountAmount,
      'Tax Amount': s.taxAmount,
      'Grand Total': s.grandTotal,
      Cost: s.totalCost,
      Profit: s.profit,
      'Payment Method': s.paymentMethod,
      Salesperson: s.salespersonName,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Sales');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `sales_export_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) {
    next(err);
  }
};
