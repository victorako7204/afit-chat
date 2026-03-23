const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, matricNo, department } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { matricNo }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email or matric number already exists.' });
    }

    const user = new User({
      name,
      email,
      password,
      matricNo,
      department: department || ''
    });

    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        matricNo: user.matricNo,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        matricNo: user.matricNo,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res) => {
  res.json({ user: req.user });
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, department, bio, skills } = req.body;
    
    const updateData = {};
    if (name) updateData.name = name;
    if (department !== undefined) updateData.department = department;
    if (bio !== undefined) updateData.bio = bio;
    if (skills !== undefined) updateData.skills = skills;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password');

    res.json({ message: 'Profile updated', user });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const currentUserIdStr = String(currentUserId);

    const users = await User.aggregate([
      { $match: { _id: { $ne: currentUserId } } },
      {
        $lookup: {
          from: 'chats',
          let: { targetUserId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$chatType', 'private'] },
                    {
                      $or: [
                        {
                          $and: [
                            { $eq: [{ $toString: '$senderId' }, { $toString: '$$targetUserId' }] },
                            { $eq: [{ $toString: '$recipientId' }, currentUserIdStr] }
                          ]
                        },
                        {
                          $and: [
                            { $eq: [{ $toString: '$senderId' }, currentUserIdStr] },
                            { $eq: [{ $toString: '$recipientId' }, { $toString: '$$targetUserId' }] }
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                _id: 0,
                lastMessage: '$message',
                lastMessageAt: '$createdAt',
                lastMessageSender: { $toString: '$senderId' }
              }
            }
          ],
          as: 'lastMessageData'
        }
      },
      {
        $addFields: {
          lastMessage: { $arrayElemAt: ['$lastMessageData.lastMessage', 0] },
          lastMessageAt: { $arrayElemAt: ['$lastMessageData.lastMessageAt', 0] },
          lastMessageSender: { $arrayElemAt: ['$lastMessageData.lastMessageSender', 0] }
        }
      },
      { $project: { password: 0, lastMessageData: 0 } },
      {
        $sort: { lastMessageAt: -1 }
      }
    ]);

    res.json(users);
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  getAllUsers,
  deleteUser
};
