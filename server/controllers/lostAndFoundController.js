const LostAndFound = require('../models/LostAndFound');

const createPost = async (req, res, next) => {
  try {
    const { title, description, location, status, contact } = req.body;

    const post = new LostAndFound({
      title,
      description,
      location,
      status,
      userId: req.user._id,
      contact: contact || ''
    });

    await post.save();

    res.status(201).json({
      message: 'Post created successfully',
      post
    });
  } catch (error) {
    next(error);
  }
};

const getPosts = async (req, res, next) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};

    const posts = await LostAndFound.find(query)
      .populate('userId', 'name matricNo')
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    next(error);
  }
};

const getPost = async (req, res, next) => {
  try {
    const post = await LostAndFound.findById(req.params.id)
      .populate('userId', 'name matricNo');

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json(post);
  } catch (error) {
    next(error);
  }
};

const markAsFound = async (req, res, next) => {
  try {
    const post = await LostAndFound.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    post.status = 'found';
    await post.save();

    res.json({ message: 'Marked as found', post });
  } catch (error) {
    next(error);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const post = await LostAndFound.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getMyPosts = async (req, res, next) => {
  try {
    const posts = await LostAndFound.find({ userId: req.user._id })
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPost,
  getPosts,
  getPost,
  markAsFound,
  deletePost,
  getMyPosts
};
