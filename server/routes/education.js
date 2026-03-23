const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  generateModule,
  getPublicModules,
  getModule,
  getModuleByTitle,
  createManualModule,
  updateModule,
  deleteModule,
  toggleEnrollment,
  getMyModules,
  getEnrolledModules,
  getEducationStats,
  verifyModule,
  getSubjects
} = require('../controllers/educationController');

router.get('/subjects', getSubjects);
router.get('/stats', getEducationStats);
router.get('/public', getPublicModules);
router.get('/my', auth, getMyModules);
router.get('/enrolled', auth, getEnrolledModules);
router.get('/title/:title', getModuleByTitle);
router.get('/:id', getModule);
router.post('/generate', auth, generateModule);
router.post('/', auth, createManualModule);
router.put('/:id', auth, updateModule);
router.put('/:id/enroll', auth, toggleEnrollment);
router.put('/:id/verify', auth, verifyModule);
router.delete('/:id', auth, deleteModule);

module.exports = router;
