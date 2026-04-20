const express = require('express');
const router = express.Router();
const { register, login, logout, me } = require('../controllers/authController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

router.post('/register', optionalAuth, register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
