const express = require('express');
const router = express.Router();
const Question = require('../models/Question');

router.get('/', async (req, res, next) => {
  try {
    const { courseCode, limit } = req.query;
    if (!courseCode) {
      return res.status(400).json({ message: 'courseCode query parameter is required' });
    }
    const limitNum = limit ? parseInt(limit, 10) : 0;
    const query = Question.find({ courseCode }).lean();
    if (limitNum > 0) {
      query.limit(limitNum);
    }
    const questions = await query;
    res.json(questions);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
