const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  createPost,
  getPosts,
  getPost,
  markAsFound,
  deletePost,
  getMyPosts
} = require('../controllers/lostAndFoundController');

router.post('/', auth, createPost);
router.get('/', auth, getPosts);
router.get('/my', auth, getMyPosts);
router.get('/:id', auth, getPost);
router.put('/:id/found', auth, markAsFound);
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const LostAndFound = require('../models/LostAndFound');
    const post = await LostAndFound.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    if (post.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    await LostAndFound.findByIdAndDelete(req.params.id);
    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
