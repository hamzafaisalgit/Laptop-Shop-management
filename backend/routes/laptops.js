const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/laptopController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// All routes require auth
router.use(requireAuth);

// Static routes before :id param routes
router.get('/low-stock', ctrl.lowStock);
router.get('/import/template', ctrl.downloadTemplate);
router.post('/import/preview', requireAdmin, upload.single('file'), ctrl.importPreview);
router.post('/import/commit', requireAdmin, ctrl.importCommit);

router.get('/', ctrl.list);
router.post('/', requireAdmin, ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.patch('/:id/quantity', ctrl.updateQuantity);
router.delete('/:id', requireAdmin, ctrl.remove);
router.get('/:id/audit', ctrl.getAudit);

module.exports = router;
