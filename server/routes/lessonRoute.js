const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Module = require('../models/Module');
const { generateEducationalContent } = require('../services/aiContentService');

router.post('/generate', auth, async (req, res) => {
  const { topic } = req.body;

  if (!topic || topic.trim() === '') {
    return res.status(400).json({ error: 'A valid learning topic parameter is required.' });
  }

  let messageContent;
  try {
    messageContent = await generateEducationalContent(topic);
  } catch (error) {
    console.error('Failed to communicate with OpenRouter:', error.message);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while crafting your lesson. Please try again.'
    });
  }

  try {
    const parsed = JSON.parse(messageContent);
    const module = new Module({
      title: parsed.courseTitle || topic.trim(),
      subject: parsed.subject || 'Other',
      description: parsed.description || `AI-generated lesson on ${topic}`,
      tags: parsed.tags || [topic.trim().toLowerCase()],
      stages: (parsed.modules || []).map(mod => ({
        moduleId: mod.moduleId || undefined,
        heading: mod.moduleTitle || 'Lesson',
        content: mod.content || messageContent,
        quiz: (mod.quiz || []).map(q => ({
          question: q.question || '',
          options: Array.isArray(q.options) ? q.options : [],
          answer: q.correctAnswer || q.options?.[0] || ''
        }))
      })),
      creator: req.user?._id,
      creatorName: 'AI-Qwen',
      isPublic: true,
      isVerified: false,
      views: 0
    });

    await module.save();
    await module.populate('creator', 'name matricNo');

    return res.status(201).json({
      success: true,
      message: 'Lesson generated and saved successfully',
      module,
      cached: false
    });
  } catch (parseError) {
    return res.status(200).json({
      success: true,
      topic: topic,
      content: messageContent
    });
  }
});

module.exports = router;
