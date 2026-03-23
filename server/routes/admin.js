const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, checkAdmin } = require('../middleware/auth');

router.patch('/user-status', auth, checkAdmin, async (req, res) => {
  const { targetUserId, newStatus, reason } = req.body;
  
  if (!targetUserId || !newStatus) {
    return res.status(400).json({ message: "targetUserId and newStatus are required" });
  }

  const validStatuses = ['active', 'suspended', 'restricted'];
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const user = await User.findByIdAndUpdate(
      targetUserId,
      { 
        status: newStatus, 
        suspensionReason: newStatus === 'suspended' ? (reason || "No reason provided") : null 
      },
      { new: true }
    ).select('name email matricNo status role suspensionReason');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetUserId}`).emit('accountStatusUpdate', { 
        status: newStatus,
        reason: reason || null
      });
    }

    res.json({ message: `User status updated to ${newStatus}`, user });
  } catch (err) {
    console.error('Admin status update error:', err);
    res.status(500).json({ message: "Server error executing command" });
  }
});

router.patch('/user-role', auth, checkAdmin, async (req, res) => {
  const { targetUserId, newRole } = req.body;
  
  if (!targetUserId || !newRole) {
    return res.status(400).json({ message: "targetUserId and newRole are required" });
  }

  const validRoles = ['student', 'moderator', 'admin'];
  if (!validRoles.includes(newRole)) {
    return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  try {
    const user = await User.findByIdAndUpdate(
      targetUserId,
      { role: newRole },
      { new: true }
    ).select('name email matricNo status role');

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${targetUserId}`).emit('accountRoleUpdate', { 
        role: newRole
      });
    }

    res.json({ message: `User role updated to ${newRole}`, user });
  } catch (err) {
    console.error('Admin role update error:', err);
    res.status(500).json({ message: "Server error executing command" });
  }
});

router.get('/users', auth, checkAdmin, async (req, res) => {
  try {
    const { status, role, search, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { matricNo: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Admin get users error:', err);
    res.status(500).json({ message: "Server error fetching users" });
  }
});

router.get('/user/:userId', auth, checkAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (err) {
    console.error('Admin get user error:', err);
    res.status(500).json({ message: "Server error fetching user" });
  }
});

module.exports = router;
