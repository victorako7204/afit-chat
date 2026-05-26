const express = require('express');
const router = express.Router();
const Question = require('../models/Question');

router.get('/', async (req, res, next) => {
  try {
    const { courseCode, limit } = req.query;
    if (!courseCode) {
      return res.status(400).json({ message: 'courseCode query parameter is required' });
    }
    let query = Question.find({ courseCode });
    if (limit && Number(limit) > 0) {
      query = query.limit(Number(limit));
    }
    const questions = await query.lean();
    res.json(questions);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
