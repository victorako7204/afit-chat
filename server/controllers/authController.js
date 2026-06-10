const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { z } = require('zod');
const User = require('../models/User');
const logger = require('../utils/logger');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const registerSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/, 'Must contain 1 uppercase letter').regex(/[a-z]/, 'Must contain 1 lowercase letter').regex(/[0-9]/, 'Must contain 1 number').regex(/[^A-Za-z0-9]/, 'Must contain 1 symbol'),
  department: z.enum(['Aerospace Engineering', 'Civil Engineering', 'Electrical Engineering', 'Mechanical Engineering', 'Computer Science', 'Cyber Security', 'Information Technology', 'Physics', 'Mathematics', 'GST', 'Other'])
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const forgotPasswordSchema = z.object({
  email: z.string().email()
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).regex(/[A-Z]/, 'Must contain 1 uppercase letter').regex(/[a-z]/, 'Must contain 1 lowercase letter').regex(/[0-9]/, 'Must contain 1 number').regex(/[^A-Za-z0-9]/, 'Must contain 1 symbol')
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    path: '/',
    maxAge: 15 * 60 * 1000
  });
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'none',
    path: '/',
    maxAge: REFRESH_TOKEN_EXPIRY_MS
  });
};

const clearAuthCookies = (res) => {
  res.cookie('accessToken', '', { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 0 });
  res.cookie('refreshToken', '', { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge: 0 });
};

const sanitizeUser = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    department: user.department,
    avatar: user.avatar,
    points: user.points,
    totalWins: user.totalWins,
    bio: user.bio,
    skills: user.skills,
    createdAt: user.createdAt
  };
};

const generateMatricNo = async () => {
  const year = new Date().getFullYear();
  const count = await User.countDocuments();
  return `AFIT/${year}/${String(count + 1).padStart(4, '0')}`;
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, department } = registerSchema.parse(req.body);
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' }
      });
    }
    const matricNo = await generateMatricNo();
    const user = new User({ name, email, password, matricNo, department });
    await user.save();
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    const refreshHash = hashToken(refreshToken);
    await user.addRefreshToken(refreshHash, new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS));
    setAuthCookies(res, accessToken, refreshToken);
    res.status(201).json({
      success: true,
      data: { user: sanitizeUser(user) }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message, details: error.errors }
      });
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    let user;
    try {
      user = await User.findByCredentials(email, password);
    } catch (credError) {
      if (credError.code === 'ACCOUNT_LOCKED') {
        return res.status(423).json({
          success: false,
          error: { code: 'ACCOUNT_LOCKED', message: credError.message, details: { remainingMinutes: credError.remainingMinutes } }
        });
      }
      if (credError.code === 'INVALID_CREDENTIALS') {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' }
        });
      }
      throw credError;
    }
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    const refreshHash = hashToken(refreshToken);
    await user.addRefreshToken(refreshHash, new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS));
    setAuthCookies(res, accessToken, refreshToken);
    res.json({
      success: true,
      data: { user: sanitizeUser(user) }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
      });
    }
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'NO_TOKEN', message: 'Refresh token required' }
      });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Refresh token expired' }
      });
    }
    const user = await User.findById(decoded.userId);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_INVALID', message: 'User not found' }
      });
    }
    const tokenHash = hashToken(token);
    const storedToken = user.refreshTokens.find(t => t.tokenHash === tokenHash);
    if (!storedToken) {
      await user.removeAllRefreshTokens();
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_REUSE', message: 'Token has been revoked. Please login again.' }
      });
    }
    if (new Date() > storedToken.expiresAt) {
      await user.removeRefreshToken(tokenHash);
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        error: { code: 'TOKEN_EXPIRED', message: 'Refresh token expired' }
      });
    }
    await user.removeRefreshToken(tokenHash);
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    const newRefreshHash = hashToken(newRefreshToken);
    await user.addRefreshToken(newRefreshHash, new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS));
    setAuthCookies(res, newAccessToken, newRefreshToken);
    res.json({
      success: true,
      data: { user: sanitizeUser(user) }
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decoded.userId);
        if (user) {
          const tokenHash = hashToken(token);
          await user.removeRefreshToken(tokenHash);
        }
      } catch (e) {
      }
    }
    clearAuthCookies(res);
    res.json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res, next) => {
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
    res.json({
      success: true,
      data: { user: sanitizeUser(user) }
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.json({ success: true, data: { message: 'If an account with that email exists, a reset link has been sent.' } });
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    await user.save();
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;
    try {
      await transporter.sendMail({
        to: user.email,
        from: process.env.SMTP_FROM || 'noreply@afitchat.com',
        subject: 'AFIT Chat - Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #f9fafb; border-radius: 16px;">
            <div style="background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <h2 style="font-size: 18px; color: #111827; margin: 0 0 16px;">Hi ${user.name},</h2>
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 16px;">
                We received a request to reset your AFIT Chat password.
              </p>
              <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px;">
                Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
              </p>
              <div style="text-align: center; margin-bottom: 20px;">
                <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background: #0095F6; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                  Reset Password
                </a>
              </div>
            </div>
            <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
              AFIT Chat — Campus Communication Hub
            </p>
          </div>
        `,
      });
    } catch (mailError) {
      logger.error('Failed to send reset email:', mailError.message);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({
        success: false,
        error: { code: 'EMAIL_FAILED', message: 'Failed to send reset email. Please try again later.' }
      });
    }
    res.json({ success: true, data: { message: 'If an account with that email exists, a reset link has been sent.' } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
      });
    }
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({
        success: false,
        error: { code: 'TOKEN_INVALID', message: 'Reset token is invalid or has expired.' }
      });
    }
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.removeAllRefreshTokens();
    await user.save();
    res.json({ success: true, data: { message: 'Password has been reset successfully.' } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
      });
    }
    next(error);
  }
};

const getProfile = async (req, res) => {
  let user = req.user;
  if (user.role === 'admin' || user.role === 'moderator') {
    user = await User.findById(user._id).select('+matricNo');
  }
  res.json({ success: true, data: { user: sanitizeUser(user) } });
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, department, bio, skills, matricNo, role } = req.body;
    if (matricNo !== undefined) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Matric number cannot be modified.' }
      });
    }
    if (role !== undefined) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Role cannot be modified.' }
      });
    }
    const updateData = {};
    if (name) updateData.name = name;
    if (department !== undefined) updateData.department = department;
    if (bio !== undefined) updateData.bio = bio;
    if (skills !== undefined) updateData.skills = skills;
    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true }).select('-password -matricNo');
    res.json({ success: true, data: { user: sanitizeUser(user) } });
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
                        { $and: [{ $eq: [{ $toString: '$senderId' }, { $toString: '$$targetUserId' }] }, { $eq: [{ $toString: '$recipientId' }, currentUserIdStr] }] },
                        { $and: [{ $eq: [{ $toString: '$senderId' }, currentUserIdStr] }, { $eq: [{ $toString: '$recipientId' }, { $toString: '$$targetUserId' }] }] }
                      ]
                    }
                  ]
                }
              }
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            { $project: { _id: 0, lastMessage: '$message', lastMessageAt: '$createdAt', lastMessageSender: { $toString: '$senderId' } } }
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
      { $sort: { lastMessageAt: -1 } }
    ]);
    res.json({ success: true, data: { users } });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      });
    }
    res.json({ success: true, data: { message: 'User deleted successfully' } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register, login, refresh, logout, me,
  forgotPassword, resetPassword,
  getProfile, updateProfile, getAllUsers, deleteUser
};
