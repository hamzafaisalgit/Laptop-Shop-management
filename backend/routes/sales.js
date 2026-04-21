const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/saleController');

router.use(requireAuth);

router.post('/', ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.get('/:id/invoice', ctrl.getInvoice);
router.post('/:id/cancel', requireAdmin, ctrl.cancel);

module.exports = router;
