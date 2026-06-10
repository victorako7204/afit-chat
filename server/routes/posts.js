const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const postController = require('../controllers/postController');

router.get('/', auth, postController.getPosts);
router.post('/', auth, postController.createPost);
router.get('/:id', auth, postController.getPost);
router.put('/:id', auth, postController.editPost);
router.delete('/:id', auth, postController.deletePost);
router.post('/:id/like', auth, postController.likePost);
router.get('/:id/comments', auth, postController.getComments);
router.post('/:id/comments', auth, postController.addComment);
router.delete('/:id/comments/:commentId', auth, postController.deleteComment);
router.get('/:id/identify-author', auth, postController.identifyAuthor);

module.exports = router;
