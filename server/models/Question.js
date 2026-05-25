const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  courseCode: {
    type: String,
    required: true,
    enum: ['PHY102', 'MTH102'],
    index: true
  },
  topic: { type: String, required: true },
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctOption: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Question', questionSchema);
