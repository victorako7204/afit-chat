const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');

router.post('/', auth, async (req, res) => {
  try {
    const { content, isAnonymous, replyTo } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Content is required' });
    }
    
    if (content.length > 500) {
      return res.status(400).json({ message: 'Content must be 500 characters or less' });
    }
    
    const user = await User.findById(req.user.id);
    
    let replyToAuthor = null;
    if (replyTo) {
      const parentPost = await Post.findById(replyTo);
      if (parentPost) {
        replyToAuthor = parentPost.isAnonymous ? 'Anonymous' : (parentPost.authorId?.name || 'Unknown');
      }
    }
    
    const post = new Post({
      authorId: req.user.id,
      content: content.trim(),
      isAnonymous: isAnonymous || false,
      department: user?.department || '',
      replyTo: replyTo || null,
      replyToAuthor
    });
    
    await post.save();
    await post.populate('authorId', 'name matricNo department');
    
    const postObj = post.toJSON();
    if (post.isAnonymous) {
      postObj.authorName = 'Anonymous';
      postObj.authorMatricNo = '';
      postObj.authorDepartment = '';
    } else {
      postObj.authorName = post.authorId?.name || 'Unknown';
      postObj.authorMatricNo = post.authorId?.matricNo || '';
      postObj.authorDepartment = post.authorId?.department || '';
    }
    
    const app = req.app;
    const io = app.get('io');
    if (io) {
      io.emit('newPost', postObj);
    }
    
    res.status(201).json(postObj);
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('authorId', 'name matricNo department')
      .lean();
    
    const postsWithAuthors = posts.map(post => {
      if (post.isAnonymous) {
        return {
          ...post,
          authorName: 'Anonymous',
          authorMatricNo: '',
          authorDepartment: ''
        };
      }
      return {
        ...post,
        authorName: post.authorId?.name || 'Unknown',
        authorMatricNo: post.authorId?.matricNo || '',
        authorDepartment: post.authorId?.department || ''
      };
    });
    
    const total = await Post.countDocuments();
    const hasMore = skip + posts.length < total;
    
    res.json({
      posts: postsWithAuthors,
      page,
      hasMore,
      total
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('authorId', 'name matricNo department')
      .lean();
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const postWithAuthor = post.isAnonymous ? {
      ...post,
      authorName: 'Anonymous',
      authorMatricNo: '',
      authorDepartment: ''
    } : {
      ...post,
      authorName: post.authorId?.name || 'Unknown',
      authorMatricNo: post.authorId?.matricNo || '',
      authorDepartment: post.authorId?.department || ''
    };
    
    res.json(postWithAuthor);
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    const userId = req.user.id;
    const likeIndex = post.likes.indexOf(userId);
    
    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(userId);
    }
    
    await post.save();
    
    const app = req.app;
    const io = app.get('io');
    if (io) {
      io.emit('postLiked', {
        postId: post._id,
        likes: post.likes,
        userId
      });
    }
    
    res.json({ likes: post.likes, liked: likeIndex === -1 });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:id/comment', auth, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: 'Comment content is required' });
    }
    
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    post.comments.push({
      authorId: req.user.id,
      content: content.trim()
    });
    
    await post.save();
    await post.populate('comments.authorId', 'name matricNo');
    
    const app = req.app;
    const io = app.get('io');
    if (io) {
      io.emit('newComment', {
        postId: post._id,
        comment: post.comments[post.comments.length - 1]
      });
    }
    
    res.json(post.comments);
  } catch (error) {
    console.error('Comment post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    if (post.authorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    await Post.findByIdAndDelete(req.params.id);
    
    const app = req.app;
    const io = app.get('io');
    if (io) {
      io.emit('postDeleted', { postId: req.params.id });
    }
    
    res.json({ message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
