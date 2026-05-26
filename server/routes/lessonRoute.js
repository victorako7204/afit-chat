const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Module = require('../models/Module');
const { generateEducationalContent } = require('../services/aiContentService');

router.post('/generate', auth, async (req, res, next) => {
  try {
    const { topic } = req.body;

    if (!topic || topic.trim() === '') {
      return res.status(400).json({ error: 'A valid learning topic parameter is required.' });
    }

    const systemPrompt = 'You are the AFIT Academic Engine. You must return a strict JSON object matching the exact requested structural schema. Do not include markdown code block formatting or introductory text.';

    const userPrompt = 'Generate a simplified learning module for the topic: "' + topic + '". Structure it explicitly as a JSON object matching this exact shape: {"courseTitle": "String", "subject": "Math|Physics|GST|COS|Chemistry|Biology|Engineering|Computer Science|Other", "description": "String", "tags": ["tag1", "tag2"], "modules": [{"moduleId": 1, "moduleTitle": "String", "content": "Step-by-step simplified explanations using plain text formulas...", "quiz": [{"question": "String", "options": ["A", "B", "C", "D"], "correctAnswer": "String"}]}]}';

    let messageContent = await generateEducationalContent([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    if (!messageContent) {
      return res.status(500).json({ error: 'Empty generation received from AI core.' });
    }

    let cleanJsonString = typeof messageContent === 'string' ? messageContent.trim() : JSON.stringify(messageContent);
    const jsonBlockMatch = cleanJsonString.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      cleanJsonString = jsonBlockMatch[1].trim();
    }

    res.json(JSON.parse(cleanJsonString));
  } catch (error) {
    console.error('AI Generation Route Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'An internal error occurred while crafting your lesson. Please try again.'
    });
  }
});

module.exports = router;
