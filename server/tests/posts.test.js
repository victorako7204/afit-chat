const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Post = require('../models/Post');
const User = require('../models/User');
const postController = require('../controllers/postController');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Post.deleteMany({});
  await User.deleteMany({});
});

const createUser = async () => {
  return User.create({
    name: 'Test User',
    email: 'test@afit.edu.ng',
    password: 'Password123!',
    matricNo: 'AFIT/2024/0001',
    department: 'Computer Science'
  });
};

const createPost = async (authorId, overrides = {}) => {
  return Post.create({
    authorId,
    authorName: overrides.authorName || 'Test User',
    content: overrides.content || 'Test post content',
    isAnonymous: overrides.isAnonymous || false,
    department: overrides.department || 'Computer Science',
    ...overrides
  });
};

describe('Post Model', () => {
  it('should create a post', async () => {
    const user = await createUser();
    const post = await createPost(user._id);
    expect(post.content).toBe('Test post content');
    expect(post.isDeleted).toBe(false);
    expect(post.commentCount).toBe(0);
  });

  it('should enforce maxLength of 500', async () => {
    const user = await createUser();
    await expect(Post.create({
      authorId: user._id,
      authorName: user.name,
      content: 'x'.repeat(501)
    })).rejects.toThrow();
  });

  it('should soft delete via softDelete method', async () => {
    const user = await createUser();
    const post = await createPost(user._id);
    await post.softDelete(user._id);
    expect(post.isDeleted).toBe(true);
    expect(post.deletedAt).toBeDefined();
    expect(String(post.deletedBy)).toBe(String(user._id));
  });

  it('should add comment and increment commentCount', async () => {
    const user = await createUser();
    const post = await createPost(user._id);
    const comment = await post.addComment({
      authorId: user._id,
      authorName: user.name,
      content: 'Nice post!'
    });
    expect(comment.content).toBe('Nice post!');
    expect(post.commentCount).toBe(1);
    expect(post.comments).toHaveLength(1);
  });

  it('should soft delete comment via removeComment', async () => {
    const user = await createUser();
    const post = await createPost(user._id);
    const comment = await post.addComment({
      authorId: user._id,
      authorName: user.name,
      content: 'Nice post!'
    });
    await post.removeComment(comment._id, user._id);
    const updated = await Post.findById(post._id);
    expect(updated.commentCount).toBe(0);
    expect(updated.comments[0].isDeleted).toBe(true);
  });

  it('should reject removeComment by non-owner', async () => {
    const user = await createUser();
    const other = await User.create({
      name: 'Other',
      email: 'other@afit.edu.ng',
      password: 'Password123!',
      matricNo: 'AFIT/2024/0002'
    });
    const post = await createPost(user._id);
    const comment = await post.addComment({
      authorId: user._id,
      authorName: user.name,
      content: 'My comment'
    });
    await expect(post.removeComment(comment._id, other._id))
      .rejects.toThrow('Not authorized');
  });

  it('should toggle like', async () => {
    const user = await createUser();
    const post = await createPost(user._id);
    let result = await post.toggleLike(user._id);
    expect(result.isLikedByUser).toBe(true);
    expect(result.likeCount).toBe(1);
    result = await post.toggleLike(user._id);
    expect(result.isLikedByUser).toBe(false);
    expect(result.likeCount).toBe(0);
  });

  it('should edit post within 15 minutes', async () => {
    const user = await createUser();
    const post = await createPost(user._id);
    await post.editPost('Updated content', user._id);
    expect(post.content).toBe('Updated content');
    expect(post.editedAt).toBeDefined();
  });

  it('should reject edit after 15 minutes', async () => {
    const user = await createUser();
    const post = await createPost(user._id);
    post.createdAt = new Date(Date.now() - 16 * 60 * 1000);
    await post.save();
    await expect(post.editPost('Updated', user._id))
      .rejects.toThrow('Cannot edit posts older than 15 minutes');
  });

  it('should reject edit by non-owner', async () => {
    const user = await createUser();
    const other = await User.create({
      name: 'Other',
      email: 'other2@afit.edu.ng',
      password: 'Password123!',
      matricNo: 'AFIT/2024/0003'
    });
    const post = await createPost(user._id);
    await expect(post.editPost('Hacked!', other._id))
      .rejects.toThrow('Not authorized');
  });

  it('should return likeCount virtual', async () => {
    const user = await createUser();
    const post = await createPost(user._id);
    post.likes.push(user._id);
    await post.save();
    expect(post.likeCount).toBe(1);
  });

  it('should respect isAnonymous field', async () => {
    const user = await createUser();
    const post = await createPost(user._id, { isAnonymous: true, authorName: 'Anonymous' });
    expect(post.isAnonymous).toBe(true);
    expect(post.authorName).toBe('Anonymous');
  });
});

describe('Post getPosts Controller', () => {
  it('should return empty list when no posts', async () => {
    const req = { user: { _id: new mongoose.Types.ObjectId() }, query: {} };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    await postController.getPosts(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { posts: [], nextCursor: null, hasMore: false }
    });
  });

  it('should return posts sorted by createdAt desc', async () => {
    const user = await createUser();
    const p1 = await createPost(user._id, { content: 'First' });
    await new Promise(r => setTimeout(r, 10));
    const p2 = await createPost(user._id, { content: 'Second' });

    const req = { user: { _id: user._id }, query: {} };
    const res = {
      json: jest.fn(data => {
        expect(data.data.posts).toHaveLength(2);
        expect(data.data.posts[0].content).toBe('Second');
        expect(data.data.posts[1].content).toBe('First');
      }),
      status: jest.fn().mockReturnThis()
    };
    await postController.getPosts(req, res);
  });

  it('should not return deleted posts', async () => {
    const user = await createUser();
    const post = await createPost(user._id);
    await post.softDelete(user._id);

    const req = { user: { _id: user._id }, query: {} };
    const res = {
      json: jest.fn(data => {
        expect(data.data.posts).toHaveLength(0);
      }),
      status: jest.fn().mockReturnThis()
    };
    await postController.getPosts(req, res);
  });

  it('should filter by department', async () => {
    const user = await createUser();
    await createPost(user._id, { content: 'CS', department: 'Computer Science' });
    await createPost(user._id, { content: 'EE', department: 'Electrical Engineering' });

    const req = { user: { _id: user._id }, query: { department: 'Computer Science' } };
    const res = {
      json: jest.fn(data => {
        expect(data.data.posts).toHaveLength(1);
        expect(data.data.posts[0].content).toBe('CS');
      }),
      status: jest.fn().mockReturnThis()
    };
    await postController.getPosts(req, res);
  });
});

describe('Post createPost Controller', () => {
  it('should create a post', async () => {
    const user = await createUser();
    const req = {
      user: { _id: user._id },
      body: { content: 'New post content' },
      app: { get: () => null }
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    await postController.createPost(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        content: 'New post content',
        authorName: 'Test User'
      })
    }));
  });

  it('should reject empty content', async () => {
    const user = await createUser();
    const req = {
      user: { _id: user._id },
      body: { content: '' },
      app: { get: () => null }
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    await postController.createPost(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should create anonymous post', async () => {
    const user = await createUser();
    const req = {
      user: { _id: user._id },
      body: { content: 'Anonymous post', isAnonymous: true },
      app: { get: () => null }
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };
    await postController.createPost(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const data = res.json.mock.calls[0][0];
    expect(data.data.authorName).toBe('Anonymous');
    expect(data.data.isAnonymous).toBe(true);
  });
});

describe('Post likePost Controller', () => {
  it('should like and unlike a post', async () => {
    const user = await createUser();
    const post = await createPost(user._id);

    const req = {
      user: { _id: user._id },
      params: { id: post._id },
      app: { get: () => null }
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    await postController.likePost(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { likeCount: 1, isLikedByUser: true }
    });
  });
});

describe('Post addComment Controller', () => {
  it('should add a comment', async () => {
    const user = await createUser();
    const post = await createPost(user._id);

    const req = {
      user: { _id: user._id },
      params: { id: post._id },
      body: { content: 'Great post!' },
      app: { get: () => null }
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    await postController.addComment(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ content: 'Great post!' })
    }));
  });

  it('should reject empty comment', async () => {
    const user = await createUser();
    const post = await createPost(user._id);

    const req = {
      user: { _id: user._id },
      params: { id: post._id },
      body: { content: '' },
      app: { get: () => null }
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis()
    };

    await postController.addComment(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
