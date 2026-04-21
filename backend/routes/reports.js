const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/reportsController');

router.use(requireAuth, requireAdmin);

router.get('/dashboard', ctrl.getDashboard);
router.get('/monthly', ctrl.getMonthly);
router.get('/yearly', ctrl.getYearly);
router.get('/sales-by-brand', ctrl.getSalesByBrand);
router.get('/slow-movers', ctrl.getSlowMovers);
router.get('/salesperson-performance', ctrl.getSalespersonPerformance);
router.get('/export/sales', ctrl.exportSales);

module.exports = router;
