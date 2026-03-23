const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  uploadResource,
  getResources,
  getResource,
  deleteResource,
  getDepartments
} = require('../controllers/libraryController');

router.post('/', auth, upload.single('file'), uploadResource);
router.get('/', auth, getResources);
router.get('/departments', auth, getDepartments);
router.get('/:id', auth, getResource);
router.delete('/:id', auth, deleteResource);

module.exports = router;
