const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
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

const generateRateLimitMap = new Map();

function generateRateLimit(req, res, next) {
  const userId = req.user._id.toString();
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 5;

  const userRequests = generateRateLimitMap.get(userId) || [];
  const recentRequests = userRequests.filter(t => now - t < windowMs);

  if (recentRequests.length >= maxRequests) {
    const oldestRequest = recentRequests[0];
    const retryAfterSeconds = Math.ceil((windowMs - (now - oldestRequest)) / 1000);
    res.set('Retry-After', retryAfterSeconds.toString());
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`
      }
    });
  }

  recentRequests.push(now);
  generateRateLimitMap.set(userId, recentRequests);

  for (const [key, timestamps] of generateRateLimitMap.entries()) {
    const valid = timestamps.filter(t => now - t < windowMs);
    if (valid.length === 0) {
      generateRateLimitMap.delete(key);
    } else {
      generateRateLimitMap.set(key, valid);
    }
  }

  next();
}

router.get('/subjects', getSubjects);
router.get('/stats', getEducationStats);
router.get('/public', getPublicModules);
router.get('/my', auth, getMyModules);
router.get('/enrolled', auth, getEnrolledModules);
router.get('/title/:title', getModuleByTitle);
router.get('/:id', getModule);
router.post('/generate', auth, generateRateLimit, generateModule);
router.post('/', auth, createManualModule);
router.put('/:id', auth, updateModule);
router.put('/:id/enroll', auth, toggleEnrollment);
router.put('/:id/verify', auth, verifyModule);
router.delete('/:id', auth, deleteModule);

module.exports = router;
