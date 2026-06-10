const Post = require('../models/Post');
const User = require('../models/User');
const { z } = require('zod');
const { cloudinary } = require('../config/cloudinary');

const createPostSchema = z.object({
  content: z.string().min(1, 'Content is required').max(500, 'Content must be 500 characters or less'),
  image: z.string().optional().nullable(),
  imagePublicId: z.string().optional().nullable(),
  isAnonymous: z.boolean().optional().default(false),
  department: z.string().optional().default('')
});

const editPostSchema = z.object({
  content: z.string().min(1, 'Content is required').max(500, 'Content must be 500 characters or less')
});

const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment is required').max(500, 'Comment must be 500 characters or less'),
  isAnonymous: z.boolean().optional().default(false)
});

const uploadImageToCloudinary = async (base64Image) => {
  if (!base64Image || !base64Image.startsWith('data:image/')) return null;
  try {
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'afit-chat/posts',
      resource_type: 'image',
      transformation: [{ quality: 'auto:good', fetch_format: 'auto' }]
    });
    return { url: result.secure_url, publicId: result.public_id };
  } catch {
    return null;
  }
};

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

exports.getPosts = async (req, res, next) => {
  try {
    const { cursor, limit = 10, department, authorId } = req.query;
    const limitNum = Math.min(parseInt(limit) || 10, 50);

    const query = { isDeleted: false };
    if (cursor) {
      query.createdAt = { $lt: new Date(cursor) };
    }
    if (department) {
      query.department = department;
    }
    if (authorId) {
      query.authorId = authorId;
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum + 1)
      .populate('authorId', 'name avatar department')
      .lean();

    const hasMore = posts.length > limitNum;
    if (hasMore) posts.pop();

    const result = posts.map(post => {
      const isLiked = post.likes?.some(id => String(id) === String(req.user._id)) || false;
      const base = {
        _id: post._id,
        authorName: post.isAnonymous ? 'Anonymous' : (post.authorId?.name || 'Unknown'),
        authorAvatar: post.isAnonymous ? null : (post.authorId?.avatar || null),
        authorDepartment: post.isAnonymous ? '' : (post.authorId?.department || ''),
        content: post.content,
        image: post.image || null,
        isAnonymous: post.isAnonymous,
        department: post.department,
        likeCount: post.likes?.length || 0,
        commentCount: post.commentCount || 0,
        isLikedByUser: isLiked,
        editedAt: post.editedAt,
        createdAt: post.createdAt,
        replyTo: post.replyTo,
        replyToAuthor: post.replyToAuthor,
        comments: post.comments?.slice(0, 2).map(c => ({
          _id: c._id,
          authorId: c.authorId,
          authorName: c.isAnonymous ? 'Anonymous' : (c.authorName || 'Unknown'),
          content: c.isDeleted ? '[deleted]' : c.content,
          isAnonymous: c.isAnonymous,
          isDeleted: c.isDeleted,
          createdAt: c.createdAt
        })) || []
      };
      return base;
    });

    const nextCursor = posts.length > 0 ? posts[posts.length - 1].createdAt : null;

    res.json({
      success: true,
      data: { posts: result, nextCursor, hasMore }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPost = async (req, res, next) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, isDeleted: false })
      .populate('authorId', 'name avatar department')
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        error: { code: 'POST_NOT_FOUND', message: 'Post not found' }
      });
    }

    const isLiked = post.likes?.some(id => String(id) === String(req.user._id)) || false;
    const firstComments = (post.comments || []).slice(0, 20).map(c => ({
      _id: c._id,
      authorId: c.authorId,
      authorName: c.isAnonymous ? 'Anonymous' : (c.authorName || 'Unknown'),
      content: c.isDeleted ? '[deleted]' : c.content,
      isAnonymous: c.isAnonymous,
      isDeleted: c.isDeleted,
      createdAt: c.createdAt,
      editedAt: c.editedAt
    }));

    res.json({
      success: true,
      data: {
        _id: post._id,
        authorId: post.authorId,
        authorName: post.isAnonymous ? 'Anonymous' : (post.authorId?.name || 'Unknown'),
        authorAvatar: post.isAnonymous ? null : (post.authorId?.avatar || null),
        authorDepartment: post.isAnonymous ? '' : (post.authorId?.department || ''),
        content: post.content,
        image: post.image || null,
        isAnonymous: post.isAnonymous,
        department: post.department,
        likeCount: post.likes?.length || 0,
        commentCount: post.commentCount || 0,
        isLikedByUser: isLiked,
        editedAt: post.editedAt,
        createdAt: post.createdAt,
        replyTo: post.replyTo,
        replyToAuthor: post.replyToAuthor,
        comments: firstComments,
        hasMoreComments: (post.comments?.length || 0) > 20
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.createPost = async (req, res, next) => {
  try {
    const validated = createPostSchema.parse(req.body);

    const oneHourAgo = Date.now() - RATE_LIMIT_WINDOW;
    const recentCount = await Post.countDocuments({
      authorId: req.user._id,
      createdAt: { $gte: new Date(oneHourAgo) }
    });

    if (recentCount >= RATE_LIMIT_MAX) {
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Maximum 10 posts per hour' }
      });
    }

    const user = await User.findById(req.user._id).lean();

    let imageUrl = null;
    let imagePublicId = null;
    if (validated.image) {
      const uploaded = await uploadImageToCloudinary(validated.image);
      if (uploaded) {
        imageUrl = uploaded.url;
        imagePublicId = uploaded.publicId;
      }
    }

    const post = new Post({
      authorId: req.user._id,
      authorName: user?.name || 'Unknown',
      content: validated.content.trim(),
      image: imageUrl,
      imagePublicId,
      isAnonymous: validated.isAnonymous,
      department: validated.department || user?.department || ''
    });

    await post.save();

    const populated = await Post.findById(post._id)
      .populate('authorId', 'name avatar department')
      .lean();

    const result = {
      _id: populated._id,
      authorName: populated.isAnonymous ? 'Anonymous' : (populated.authorId?.name || 'Unknown'),
      authorAvatar: populated.isAnonymous ? null : (populated.authorId?.avatar || null),
      authorDepartment: populated.isAnonymous ? '' : (populated.authorId?.department || ''),
      content: populated.content,
      image: populated.image || null,
      imagePublicId: populated.imagePublicId || null,
      isAnonymous: populated.isAnonymous,
      department: populated.department,
      likeCount: 0,
      commentCount: 0,
      isLikedByUser: false,
      createdAt: populated.createdAt,
      editedAt: null,
      replyTo: null,
      replyToAuthor: null,
      comments: []
    };

    const io = req.app.get('io');
    if (io) {
      io.emit('newPost', result);
    }

    res.status(201).json({ success: true, data: result });
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

exports.editPost = async (req, res, next) => {
  try {
    const validated = editPostSchema.parse(req.body);

    const post = await Post.findOne({ _id: req.params.id, isDeleted: false });
    if (!post) {
      return res.status(404).json({
        success: false,
        error: { code: 'POST_NOT_FOUND', message: 'Post not found' }
      });
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'moderator';
    if (String(post.authorId) !== String(req.user._id) && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_AUTHORIZED', message: 'Not authorized to edit this post' }
      });
    }

    await post.editPost(validated.content, req.user._id);

    const io = req.app.get('io');
    if (io) {
      io.emit('postEdited', {
        _id: post._id,
        content: post.content,
        editedAt: post.editedAt
      });
    }

    res.json({
      success: true,
      data: {
        _id: post._id,
        content: post.content,
        editedAt: post.editedAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message }
      });
    }
    if (error.code === 'NOT_AUTHORIZED' || error.code === 'EDIT_WINDOW_EXPIRED') {
      return res.status(403).json({
        success: false,
        error: { code: error.code, message: error.message }
      });
    }
    next(error);
  }
};

exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: { code: 'POST_NOT_FOUND', message: 'Post not found' }
      });
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'moderator';
    if (String(post.authorId) !== String(req.user._id) && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_AUTHORIZED', message: 'Not authorized to delete this post' }
      });
    }

    if (post.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(post.imagePublicId);
      } catch (e) {
      }
    }

    await post.softDelete(req.user._id, isAdmin);

    const io = req.app.get('io');
    if (io) {
      io.emit('postDeleted', { postId: req.params.id });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

exports.likePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: { code: 'POST_NOT_FOUND', message: 'Post not found' }
      });
    }

    const result = await post.toggleLike(req.user._id);

    const io = req.app.get('io');
    if (io) {
      io.emit('postLiked', {
        postId: post._id,
        likeCount: result.likeCount
      });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const validated = createCommentSchema.parse(req.body);

    const post = await Post.findById(req.params.id);
    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'POST_NOT_FOUND', message: 'Post not found' }
      });
    }

    const user = await User.findById(req.user._id).lean();
    const authorName = validated.isAnonymous ? 'Anonymous' : (user?.name || 'Unknown');

    const comment = await post.addComment({
      authorId: req.user._id,
      authorName,
      content: validated.content.trim(),
      isAnonymous: validated.isAnonymous
    });

    const populatedComment = {
      _id: comment._id,
      authorId: comment.authorId,
      authorName: comment.isAnonymous ? 'Anonymous' : authorName,
      content: comment.content,
      isAnonymous: comment.isAnonymous,
      createdAt: comment.createdAt
    };

    const io = req.app.get('io');
    if (io) {
      io.emit('newComment', {
        postId: post._id,
        comment: populatedComment
      });
    }

    res.status(201).json({ success: true, data: populatedComment });
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

exports.getComments = async (req, res, next) => {
  try {
    const { cursor, limit = 20 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 20, 50);

    const post = await Post.findById(req.params.id).lean();
    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'POST_NOT_FOUND', message: 'Post not found' }
      });
    }

    let comments = (post.comments || []).filter(c => !c.isDeleted);

    if (cursor) {
      const cursorIdx = comments.findIndex(c => String(c._id) === cursor);
      if (cursorIdx > -1) {
        comments = comments.slice(cursorIdx + 1);
      }
    }

    const hasMore = comments.length > limitNum;
    if (hasMore) comments = comments.slice(0, limitNum);

    const result = comments.map(c => ({
      _id: c._id,
      authorId: c.authorId,
      authorName: c.isAnonymous ? 'Anonymous' : (c.authorName || 'Unknown'),
      content: c.content,
      isAnonymous: c.isAnonymous,
      createdAt: c.createdAt,
      editedAt: c.editedAt
    }));

    const nextCursor = result.length > 0 ? result[result.length - 1]._id : null;

    res.json({
      success: true,
      data: { comments: result, nextCursor, hasMore }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.isDeleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'POST_NOT_FOUND', message: 'Post not found' }
      });
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'moderator';
    await post.removeComment(req.params.commentId, req.user._id, isAdmin);

    const io = req.app.get('io');
    if (io) {
      io.emit('commentDeleted', {
        postId: post._id,
        commentId: req.params.commentId
      });
    }

    res.json({ success: true });
  } catch (error) {
    if (error.code === 'COMMENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: { code: 'COMMENT_NOT_FOUND', message: error.message }
      });
    }
    if (error.code === 'NOT_AUTHORIZED') {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_AUTHORIZED', message: error.message }
      });
    }
    next(error);
  }
};

exports.identifyAuthor = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id).populate('authorId', 'name email department matricNo').lean();
    if (!post) {
      return res.status(404).json({
        success: false,
        error: { code: 'POST_NOT_FOUND', message: 'Post not found' }
      });
    }

    const isAdmin = req.user.role === 'admin' || req.user.role === 'moderator';
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: 'NOT_AUTHORIZED', message: 'Only admins can identify anonymous authors' }
      });
    }

    res.json({
      success: true,
      data: {
        _id: post._id,
        authorId: post.authorId?._id || post.authorId,
        authorName: post.authorId?.name || post.authorName,
        email: post.authorId?.email,
        department: post.authorId?.department || post.department,
        isAnonymous: post.isAnonymous
      }
    });
  } catch (error) {
    next(error);
  }
};
