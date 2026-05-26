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
    messageContent = await generateEducationalContent([
      {
        role: "system",
        content: "You are the AFIT Academic Engine. You must return a strict JSON object matching the exact requested structural schema. Do not include markdown code block formatting or introductory text."
      },
      {
        role: "user",
        content: `Generate a simplified learning module for the topic: \"${topic}\". Structure it explicitly as a JSON object with this shape:
      {
        \"courseTitle\": \"String\",
        \"subject\": \"Math|Physics|GST|COS|Chemistry|Biology|Engineering|Computer Science|Other\",
        \"description\": \"String\",
        \"tags\": [\"tag1\", \"tag2\"],
        \"modules\": [
          {
            \"moduleId\": 1,
            \"moduleTitle\": \"String\",
            \"content\": \"Step-by-step simplified explanations using LaTeX...\",
            \"quiz\": [
              {
                \"question\": \"String\",
                \"options\": [\"A\", \"B\", \"C\", \"D\"],
                \"correctAnswer\": \"String\"
              }
            ]
          }
        ]
      }`
      }
    ]);
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
    await module.populate('creator', 'name');

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
