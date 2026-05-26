const mongoose = require('mongoose');
const pastQuestionFileSchema = new mongoose.Schema({
  courseCode: { type: String, required: true, index: true, uppercase: true },
  title: { type: String, required: true },
  year: { type: Number, required: true },
  examType: { type: String, enum: ['First Semester Exam', 'Second Semester Exam', 'Test', 'Quiz', 'Practice Sheet'], required: true },
  fileUrl: { type: String, required: true },
  fileType: { type: String, enum: ['application/pdf', 'image/jpeg', 'image/png'], required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  downloadsCount: { type: Number, default: 0 }
}, { timestamps: true });
module.exports = mongoose.model('PastQuestionFile', pastQuestionFileSchema);
