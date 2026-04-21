const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/customerController');

router.use(requireAuth);

router.get('/', ctrl.search);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);

module.exports = router;
