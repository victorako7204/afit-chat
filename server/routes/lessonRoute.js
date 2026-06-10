const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { z } = require('zod');
const { auth } = require('../middleware/auth');
const Module = require('../models/Module');
const { generateEducationalContent } = require('../services/aiContentService');

const generateRateLimitMap = new Map();

function generateRateLimit(req, res, next) {
  const userId = req.user._id.toString();
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 5;

  const userRequests = generateRateLimitMap.get(userId) || [];
  const recentRequests = userRequests.filter(t => now - t < windowMs);

  if (recentRequests.length >= maxRequests) {
    const oldestRequest = recentRequests[0];
    const retryAfterSeconds = Math.ceil((windowMs - (now - oldestRequest)) / 1000);
    res.set('Retry-After', retryAfterSeconds.toString());
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`
      }
    });
  }

  recentRequests.push(now);
  generateRateLimitMap.set(userId, recentRequests);

  for (const [key, timestamps] of generateRateLimitMap.entries()) {
    const valid = timestamps.filter(t => now - t < windowMs);
    if (valid.length === 0) {
      generateRateLimitMap.delete(key);
    } else {
      generateRateLimitMap.set(key, valid);
    }
  }

  next();
}

router.post('/generate', auth, generateRateLimit, async (req, res, next) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const { topic } = req.body;

    const topicValidation = z.string().min(3).max(100).safeParse(topic);
    if (!topicValidation.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOPIC',
          message: 'Topic must be between 3 and 100 characters'
        }
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured on Render. Add GEMINI_API_KEY to Render env vars.');
      return res.status(503).json({
        success: false,
        error: {
          code: 'AI_NOT_CONFIGURED',
          message: 'AI service is not configured. Please add GEMINI_API_KEY to the server environment variables.'
        }
      });
    }

    console.log(`[${requestId}] Generating module for topic: "${topic}" by user: ${req.user._id}`);

    const normalizedTopic = topic.trim().toLowerCase();
    const escapedTopic = normalizedTopic.replace(/[-\/\\^$*+%.()|[\]{}]/g, '\\$&');

    let existingModule = await Module.findOne({
      isPublic: true,
      $or: [
        { title: { $regex: `^${escapedTopic}$`, $options: 'i' } },
        { tags: { $in: [normalizedTopic] } }
      ]
    }).limit(1);

    if (existingModule) {
      existingModule.views = (existingModule.views || 0) + 1;
      await existingModule.save();

      console.log(`[${requestId}] Cache hit — module "${existingModule.title}" found`);
      return res.json({
        success: true,
        data: { module: existingModule },
        cached: true
      });
    }

    const result = await generateEducationalContent(topic, {
      userId: req.user._id,
      requestId,
      onProgress: (status) => {
        console.log(`[${requestId}] Progress: ${status}`);
      }
    });

    if (!result.success) {
      console.error(`[${requestId}] Generation failed:`, result.error);
      return res.status(result.error.code === 'RATE_LIMITED' ? 429 : 503).json({
        success: false,
        error: result.error
      });
    }

    const moduleData = result.data;

    const module = new Module({
      title: moduleData.title || topic.trim(),
      subject: moduleData.subject || 'Other',
      description: moduleData.description || `AI-generated module on ${topic}`,
      tags: [topic.trim().toLowerCase()],
      stages: (moduleData.stages || []).map((stage, index) => ({
        moduleId: index + 1,
        heading: stage.heading || `Stage ${index + 1}`,
        content: stage.content || '',
        quiz: (stage.quiz || []).map(q => ({
          question: q.question || '',
          options: Array.isArray(q.options) ? q.options : [],
          answer: q.answer || q.options?.[0] || ''
        }))
      })),
      creator: req.user._id,
      creatorName: 'AI-Gemini',
      isPublic: true,
      isVerified: false,
      views: 0,
      aiProvider: result.provider || 'gemini',
      aiModel: result.model || 'gemini-3.5-flash',
      aiGeneratedAt: new Date(),
      isAIGenerated: true,
      generationRequestId: requestId
    });

    await module.save();
    await module.populate('creator', 'name');

    const elapsed = Date.now() - startTime;
    console.log(`[${requestId}] Module generated successfully in ${elapsed}ms via ${result.model}`);

    res.status(201).json({
      success: true,
      data: { module },
      cached: false
    });

  } catch (error) {
    console.error(`[${requestId}] Error generating module:`, error);
    next(error);
  }
});

module.exports = router;
