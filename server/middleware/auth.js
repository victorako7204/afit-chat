const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

const checkNotSuspended = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    
    if (req.user.status === 'suspended') {
      const isStillSuspended = !req.user.suspensionExpiry || new Date() < req.user.suspensionExpiry;
      
      if (isStillSuspended) {
        return res.status(403).json({ 
          message: `Your account is suspended. ${req.user.suspensionReason ? `Reason: ${req.user.suspensionReason}` : ''}` 
        });
      }
      
      await User.findByIdAndUpdate(req.user._id, { status: 'active' });
      req.user.status = 'active';
    }
    
    if (req.user.status === 'restricted') {
      return res.status(403).json({ message: 'Your account has restricted access.' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ message: 'Error checking account status.' });
  }
};

const checkAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ message: 'Admin or Moderator access required.' });
  }
  next();
};

module.exports = { auth, checkNotSuspended, checkAdmin };
