const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { auth } = require('../middleware/auth');
const PastQuestionFile = require('../models/PastQuestionFile');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/past-questions/'),
  filename: (req, file, cb) => cb(null, `pq-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file format. Only PDFs and images are permitted.'));
  },
  limits: { fileSize: 15 * 1024 * 1024 }
});

router.post('/upload', auth, upload.single('pqFile'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file document uploaded.' });
    const { courseCode, title, year, examType } = req.body;
    const newPQ = new PastQuestionFile({
      courseCode, title, year, examType,
      fileUrl: `/uploads/past-questions/${req.file.filename}`,
      fileType: req.file.mimetype,
      uploadedBy: req.user.id
    });
    await newPQ.save();
    res.status(201).json({ success: true, data: newPQ });
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { courseCode } = req.query;
    const filter = courseCode ? { courseCode: courseCode.toUpperCase() } : {};
    const pqs = await PastQuestionFile.find(filter).populate('uploadedBy', 'name').sort({ year: -1, createdAt: -1 }).lean();
    res.json(pqs);
  } catch (err) { next(err); }
});
module.exports = router;
