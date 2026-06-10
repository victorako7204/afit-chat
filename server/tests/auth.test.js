const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  process.env.JWT_SECRET = 'test-jwt-secret-min-32-chars-long!!!!!!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long!!';
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
});

const createTestUser = async (overrides = {}) => {
  const user = new User({
    name: overrides.name || 'Test User',
    email: (overrides.email || 'test@example.com').toLowerCase(),
    password: overrides.password || 'Password123!',
    matricNo: overrides.matricNo || 'AFIT/2024/0001',
    department: overrides.department || 'Computer Science',
    ...overrides
  });
  await user.save();
  return user;
};

describe('User Model', () => {
  describe('Password Hashing', () => {
    it('should hash password on save', async () => {
      const user = await createTestUser();
      expect(user.password).not.toBe('Password123!');
      const isMatch = await bcrypt.compare('Password123!', user.password);
      expect(isMatch).toBe(true);
    });

    it('should not re-hash if password not modified', async () => {
      const user = await createTestUser();
      const hash = user.password;
      user.name = 'Updated Name';
      await user.save();
      expect(user.password).toBe(hash);
    });

    it('should set passwordChangedAt when password is modified', async () => {
      const user = await createTestUser();
      expect(user.passwordChangedAt).toBeDefined();
      const oldChangedAt = user.passwordChangedAt;
      user.password = 'NewPass123!';
      await user.save();
      expect(user.passwordChangedAt.getTime()).toBeGreaterThan(oldChangedAt.getTime());
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const user = await createTestUser();
      const isMatch = await user.comparePassword('Password123!');
      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const user = await createTestUser();
      const isMatch = await user.comparePassword('WrongPassword1!');
      expect(isMatch).toBe(false);
    });
  });

  describe('Login Attempts and Lockout', () => {
    it('should increment login attempts', async () => {
      const user = await createTestUser();
      expect(user.loginAttempts).toBe(0);
      await user.incLoginAttempts();
      expect(user.loginAttempts).toBe(1);
    });

    it('should lock account after 5 failed attempts', async () => {
      const user = await createTestUser();
      for (let i = 0; i < 5; i++) {
        await user.incLoginAttempts();
      }
      expect(user.loginAttempts).toBe(5);
      expect(user.isLocked()).toBe(true);
    });

    it('should return false for isLocked when lockUntil is in the past', async () => {
      const user = await createTestUser();
      user.lockUntil = new Date(Date.now() - 1000);
      await user.save();
      expect(user.isLocked()).toBe(false);
    });

    it('should reset login attempts', async () => {
      const user = await createTestUser();
      user.loginAttempts = 3;
      user.lockUntil = new Date(Date.now() + 60000);
      await user.save();
      await user.resetLoginAttempts();
      expect(user.loginAttempts).toBe(0);
      expect(user.lockUntil).toBeNull();
    });
  });

  describe('findByCredentials', () => {
    it('should return user with valid credentials', async () => {
      await createTestUser();
      const user = await User.findByCredentials('test@example.com', 'Password123!');
      expect(user).toBeDefined();
      expect(user.email).toBe('test@example.com');
    });

    it('should throw INVALID_CREDENTIALS for wrong password', async () => {
      await createTestUser();
      await expect(
        User.findByCredentials('test@example.com', 'WrongPassword1!')
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('should throw INVALID_CREDENTIALS for non-existent user', async () => {
      await expect(
        User.findByCredentials('nonexistent@example.com', 'Password123!')
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('should throw ACCOUNT_LOCKED after 5 failed attempts', async () => {
      const user = await createTestUser();
      for (let i = 0; i < 5; i++) {
        try {
          await User.findByCredentials('test@example.com', 'WrongPassword1!');
        } catch (e) {
        }
      }
      await expect(
        User.findByCredentials('test@example.com', 'Password123!')
      ).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
    });

    it('should reset login attempts on successful login', async () => {
      const user = await createTestUser();
      for (let i = 0; i < 3; i++) {
        try {
          await User.findByCredentials('test@example.com', 'WrongPassword1!');
        } catch (e) {
        }
      }
      expect((await User.findById(user._id)).loginAttempts).toBe(3);
      await User.findByCredentials('test@example.com', 'Password123!');
      expect((await User.findById(user._id)).loginAttempts).toBe(0);
    });

    it('should be case-insensitive for email', async () => {
      await createTestUser();
      const user = await User.findByCredentials('TEST@EXAMPLE.COM', 'Password123!');
      expect(user).toBeDefined();
    });
  });

  describe('Refresh Token Management', () => {
    it('should add refresh token', async () => {
      const user = await createTestUser();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await user.addRefreshToken('hashedToken123', expiresAt);
      expect(user.refreshTokens.length).toBe(1);
      expect(user.refreshTokens[0].tokenHash).toBe('hashedToken123');
    });

    it('should remove refresh token', async () => {
      const user = await createTestUser();
      await user.addRefreshToken('token1', new Date(Date.now() + 86400000));
      await user.addRefreshToken('token2', new Date(Date.now() + 86400000));
      await user.removeRefreshToken('token1');
      expect(user.refreshTokens.length).toBe(1);
      expect(user.refreshTokens[0].tokenHash).toBe('token2');
    });

    it('should remove all refresh tokens', async () => {
      const user = await createTestUser();
      await user.addRefreshToken('token1', new Date(Date.now() + 86400000));
      await user.addRefreshToken('token2', new Date(Date.now() + 86400000));
      await user.removeAllRefreshTokens();
      expect(user.refreshTokens.length).toBe(0);
    });

    it('should keep max 10 refresh tokens', async () => {
      const user = await createTestUser();
      for (let i = 0; i < 15; i++) {
        await user.addRefreshToken(`token${i}`, new Date(Date.now() + 86400000));
      }
      expect(user.refreshTokens.length).toBe(10);
    });
  });

  describe('isPasswordChangedAfter', () => {
    it('should return true if password was changed after JWT issued', async () => {
      const user = await createTestUser();
      const oldIat = Math.floor((Date.now() - 60000) / 1000);
      user.passwordChangedAt = new Date(Date.now() - 30000);
      await user.save();
      expect(user.isPasswordChangedAfter(oldIat)).toBe(true);
    });

    it('should return false if password was not changed after JWT issued', async () => {
      const user = await createTestUser();
      user.passwordChangedAt = new Date(Date.now() - 60000);
      await user.save();
      const laterIat = Math.floor(Date.now() / 1000);
      expect(user.isPasswordChangedAfter(laterIat)).toBe(false);
    });

    it('should return false if passwordChangedAt is null', async () => {
      const user = await createTestUser();
      user.passwordChangedAt = null;
      await user.save();
      expect(user.isPasswordChangedAfter(1000000)).toBe(false);
    });
  });

  describe('Existing Methods Preserved', () => {
    it('should record a win', async () => {
      const user = await createTestUser();
      await user.recordWin();
      expect(user.points).toBe(10);
      expect(user.totalWins).toBe(1);
      expect(user.currentStreak).toBe(1);
    });

    it('should record a loss', async () => {
      const user = await createTestUser();
      user.points = 20;
      await user.save();
      await user.recordLoss();
      expect(user.points).toBe(15);
      expect(user.totalLosses).toBe(1);
      expect(user.currentStreak).toBe(0);
    });

    it('should record a draw', async () => {
      const user = await createTestUser();
      await user.recordDraw();
      expect(user.points).toBe(3);
      expect(user.totalDraws).toBe(1);
    });

    it('should get leaderboard', async () => {
      await createTestUser({ name: 'User A', points: 100 });
      await createTestUser({ name: 'User B', points: 50, email: 'b@test.com', matricNo: 'AFIT/2024/0002' });
      const leaderboard = await User.getLeaderboard('all', 2);
      expect(leaderboard.length).toBe(2);
      expect(leaderboard[0].name).toBe('User A');
    });

    it('should suspend and unsuspend user', async () => {
      const user = await createTestUser();
      await user.suspend('Violation', new Date(Date.now() + 86400000));
      expect(user.isSuspended()).toBe(true);
      await user.unsuspend();
      expect(user.isSuspended()).toBe(false);
    });

    it('should check not suspended', async () => {
      const user = await createTestUser();
      const result = await User.checkNotSuspended(user._id);
      expect(result._id.toString()).toBe(user._id.toString());
    });

    it('should throw for suspended user in checkNotSuspended', async () => {
      const user = await createTestUser();
      await user.suspend('Test', new Date(Date.now() + 86400000));
      await expect(User.checkNotSuspended(user._id)).rejects.toThrow('Account suspended');
    });
  });
});
