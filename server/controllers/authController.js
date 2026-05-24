const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Chat = require('../models/Chat');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

    const user = await User.findOne({ email }).select('+matricNo');
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

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email address.' });
    }

    const rawToken = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 20 * 60 * 1000;
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

    try {
      await transporter.sendMail({
        to: user.email,
        from: process.env.SMTP_FROM || 'noreply@afitchat.com',
        subject: 'Afit Chat - Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f9fafb; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #9333ea); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                <span style="color: white; font-size: 24px; font-weight: bold;">Λ</span>
              </div>
              <h1 style="font-size: 20px; color: #111827; margin: 0;">Afit Chat</h1>
            </div>
            <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="font-size: 18px; color: #111827; margin: 0 0 16px;">Hi ${user.name},</h2>
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px;">
                We received a request to reset the password for your Afit Chat account associated with <strong>${user.email}</strong>.
              </p>
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">
                Click the button below to set a new password. This link expires in <strong>20 minutes</strong>.
              </p>
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(135deg, #3b82f6, #9333ea); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                  Reset Password
                </a>
              </div>
              <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0;">
                If you did not request this, please ignore this email and your password will remain unchanged.
              </p>
            </div>
            <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
              Afit Chat — Campus Communication Hub
            </p>
          </div>
        `,
      });
    } catch (mailError) {
      console.error('Failed to send reset email:', mailError.message);

      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return res.status(500).json({ message: 'Failed to send reset email. Please try again later.' });
    }

    res.json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Reset token is invalid or has expired.' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully.' });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res) => {
  let user = req.user;

  if (user.role === 'admin' || user.role === 'moderator') {
    user = await User.findById(user._id).select('+matricNo');
  }

  res.json({ user });
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, department, bio, skills, matricNo, role } = req.body;

    if (matricNo !== undefined) {
      return res.status(403).json({ message: 'Matric number cannot be modified.' });
    }
    if (role !== undefined) {
      return res.status(403).json({ message: 'Role cannot be modified.' });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (department !== undefined) updateData.department = department;
    if (bio !== undefined) updateData.bio = bio;
    if (skills !== undefined) updateData.skills = skills;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true }
    ).select('-password -matricNo');

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
      { $project: { password: 0, matricNo: 0, lastMessageData: 0 } },
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
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
  getAllUsers,
  deleteUser
};
