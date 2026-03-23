const Group = require('../models/Group');

const createGroup = async (req, res, next) => {
  try {
    const { name, description, department } = req.body;

    const existingGroup = await Group.findOne({ name });
    if (existingGroup) {
      return res.status(400).json({ message: 'Group name already exists' });
    }

    const group = new Group({
      name,
      description: description || '',
      department: department || '',
      members: [req.user._id],
      admins: [req.user._id],
      createdBy: req.user._id
    });

    await group.save();
    await group.populate('createdBy', 'name matricNo');
    await group.populate('members', 'name matricNo');
    await group.populate('admins', 'name matricNo');

    res.status(201).json({
      message: 'Group created successfully',
      group
    });
  } catch (error) {
    next(error);
  }
};

const getGroups = async (req, res, next) => {
  try {
    const { department } = req.query;
    const query = department ? { department } : {};

    const groups = await Group.find(query)
      .populate('createdBy', 'name matricNo')
      .populate('members', 'name matricNo')
      .populate('admins', 'name matricNo')
      .sort({ createdAt: -1 });

    res.json(groups);
  } catch (error) {
    next(error);
  }
};

const getGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('createdBy', 'name matricNo')
      .populate('members', 'name matricNo')
      .populate('admins', 'name matricNo');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    res.json(group);
  } catch (error) {
    next(error);
  }
};

const joinGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const userId = req.user._id.toString();
    const isMember = group.members.some(m => m.toString() === userId);

    if (isMember) {
      return res.status(400).json({ message: 'Already a member' });
    }

    group.members.push(req.user._id);
    await group.save();
    await group.populate('createdBy', 'name matricNo');
    await group.populate('members', 'name matricNo');
    await group.populate('admins', 'name matricNo');

    res.json({ message: 'Joined group successfully', group });
  } catch (error) {
    next(error);
  }
};

const joinByInvite = async (req, res, next) => {
  try {
    const { inviteCode } = req.body;

    if (!inviteCode) {
      return res.status(400).json({ message: 'Invite code is required' });
    }

    const group = await Group.findOne({ inviteCode: inviteCode.toUpperCase() });

    if (!group) {
      return res.status(404).json({ message: 'Invalid invite code' });
    }

    const userId = req.user._id.toString();
    const isMember = group.members.some(m => m.toString() === userId);

    if (isMember) {
      return res.status(400).json({ message: 'Already a member of this group' });
    }

    group.members.push(req.user._id);
    await group.save();
    await group.populate('createdBy', 'name matricNo');
    await group.populate('members', 'name matricNo');
    await group.populate('admins', 'name matricNo');

    res.json({ message: 'Joined group successfully via invite', group });
  } catch (error) {
    next(error);
  }
};

const leaveGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const userId = req.user._id.toString();
    group.members = group.members.filter(m => m.toString() !== userId);
    group.admins = group.admins.filter(a => a.toString() !== userId);
    await group.save();

    res.json({ message: 'Left group successfully', group });
  } catch (error) {
    next(error);
  }
};

const deleteGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (group.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Group.findByIdAndDelete(req.params.id);

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getMyGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({ members: req.user._id })
      .populate('createdBy', 'name matricNo')
      .populate('members', 'name matricNo')
      .populate('admins', 'name matricNo');

    res.json(groups);
  } catch (error) {
    next(error);
  }
};

const toggleLock = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const userId = req.user._id.toString();
    const isAdmin = group.admins.some(a => a.toString() === userId);

    if (!isAdmin) {
      return res.status(403).json({ message: 'Only admins can toggle group lock' });
    }

    group.isLocked = !group.isLocked;
    await group.save();
    await group.populate('createdBy', 'name matricNo');
    await group.populate('members', 'name matricNo');
    await group.populate('admins', 'name matricNo');

    res.json({
      message: group.isLocked ? 'Group locked successfully' : 'Group unlocked successfully',
      group
    });
  } catch (error) {
    next(error);
  }
};

const makeAdmin = async (req, res, next) => {
  try {
    const { targetUserId } = req.body;
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const userId = req.user._id.toString();
    const isAdmin = group.admins.some(a => a.toString() === userId);

    if (!isAdmin) {
      return res.status(403).json({ message: 'Only admins can promote members' });
    }

    const targetId = targetUserId.toString();
    const targetIsMember = group.members.some(m => m.toString() === targetId);

    if (!targetIsMember) {
      return res.status(400).json({ message: 'User is not a member of this group' });
    }

    const targetIsAlreadyAdmin = group.admins.some(a => a.toString() === targetId);

    if (targetIsAlreadyAdmin) {
      return res.status(400).json({ message: 'User is already an admin' });
    }

    group.admins.push(targetUserId);
    await group.save();
    await group.populate('createdBy', 'name matricNo');
    await group.populate('members', 'name matricNo');
    await group.populate('admins', 'name matricNo');

    res.json({
      message: 'User promoted to admin successfully',
      group
    });
  } catch (error) {
    next(error);
  }
};

const regenerateInviteCode = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const userId = req.user._id.toString();
    const isAdmin = group.admins.some(a => a.toString() === userId);

    if (!isAdmin) {
      return res.status(403).json({ message: 'Only admins can regenerate invite codes' });
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let newCode = '';
    for (let i = 0; i < 6; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    group.inviteCode = newCode;
    await group.save();

    res.json({
      message: 'Invite code regenerated successfully',
      inviteCode: newCode
    });
  } catch (error) {
    next(error);
  }
};

const updateGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const userId = req.user._id.toString();
    const isAdmin = group.admins.some(a => a.toString() === userId);

    if (!isAdmin) {
      return res.status(403).json({ message: 'Only admins can update group settings' });
    }

    const { name, description, department } = req.body;

    if (name) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (department !== undefined) group.department = department.trim();

    await group.save();
    await group.populate('createdBy', 'name matricNo');
    await group.populate('members', 'name matricNo');
    await group.populate('admins', 'name matricNo');

    res.json({
      message: 'Group updated successfully',
      group
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroup,
  joinGroup,
  joinByInvite,
  leaveGroup,
  deleteGroup,
  getMyGroups,
  toggleLock,
  makeAdmin,
  regenerateInviteCode,
  updateGroup
};
