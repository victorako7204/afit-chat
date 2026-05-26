const express = require('express');
const router = express.Router();
const Question = require('../models/Question');

router.get('/', async (req, res, next) => {
  try {
    const { courseCode, limit } = req.query;
    if (!courseCode) {
      return res.status(400).json({ message: 'courseCode query parameter is required' });
    }
    const questions = await Question.find({ courseCode }).lean();
    res.json(questions);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
