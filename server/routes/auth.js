const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  register,
  login,
  getProfile,
  updateProfile,
  getAllUsers,
  deleteUser
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.get('/users', auth, getAllUsers);
router.delete('/users/:id', auth, admin, deleteUser);

module.exports = router;
