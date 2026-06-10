const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_TOKEN', message: 'Authentication required' }
      });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Access token expired' }
        });
      }
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_INVALID', message: 'Invalid token' }
      });
    }
    const user = await User.findById(decoded.userId).select('-password -matricNo');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_INVALID', message: 'User not found' }
      });
    }
    if (user.isPasswordChangedAfter(decoded.iat)) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_INVALID', message: 'Password changed. Please login again.' }
      });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_INVALID', message: 'Authentication failed' }
    });
  }
};

const checkNotSuspended = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_TOKEN', message: 'Authentication required' }
      });
    }
    if (req.user.status === 'suspended') {
      const isStillSuspended = !req.user.suspensionExpiry || new Date() < req.user.suspensionExpiry;
      if (isStillSuspended) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_SUSPENDED',
            message: `Your account is suspended. ${req.user.suspensionReason ? `Reason: ${req.user.suspensionReason}` : ''}`
          }
        });
      }
      await User.findByIdAndUpdate(req.user._id, { status: 'active' });
      req.user.status = 'active';
    }
    if (req.user.status === 'restricted') {
      return res.status(403).json({
        success: false,
        error: { code: 'ACCOUNT_RESTRICTED', message: 'Your account has restricted access.' }
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Error checking account status.' }
    });
  }
};

const checkAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: { code: 'NO_TOKEN', message: 'Authentication required.' }
    });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin or Moderator access required.' }
    });
  }
  next();
};

module.exports = { auth, checkNotSuspended, checkAdmin };
