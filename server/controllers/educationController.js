const crypto = require('crypto');
const Module = require('../models/Module');
const { generateEducationalContent } = require('../services/aiContentService');

const generateModule = async (req, res, next) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOPIC', message: 'Topic must be at least 3 characters' }
      });
    }

    if (topic.trim().length > 100) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TOPIC', message: 'Topic must be under 100 characters' }
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return res.status(503).json({
        success: false,
        error: {
          code: 'AI_NOT_CONFIGURED',
          message: 'AI service is not configured. Please add GEMINI_API_KEY to the server environment variables.'
        }
      });
    }

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

      return res.json({
        success: true,
        data: { module: existingModule },
        cached: true
      });
    }

    const result = await generateEducationalContent(topic, {
      userId: req.user._id,
      requestId
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
    console.log(`[${requestId}] Module generated in ${elapsed}ms via ${result.model}`);

    res.status(201).json({
      success: true,
      data: { module },
      cached: false
    });

  } catch (error) {
    console.error(`[${requestId}] Error generating module:`, error);
    next(error);
  }
};

const getPublicModules = async (req, res, next) => {
  try {
    const { subject, search, page = 1, limit = 20 } = req.query;

    const result = await Module.getPublicModules({
      subject,
      search,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
};

const getModule = async (req, res, next) => {
  try {
    const module = await Module.findById(req.params.id)
      .populate('creator', 'name')
      .populate('enrolledUsers', 'name');

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    module.views = (module.views || 0) + 1;
    await module.save();

    res.json(module);
  } catch (error) {
    next(error);
  }
};

const getModuleByTitle = async (req, res, next) => {
  try {
    const { title } = req.params;

    const modules = await Module.searchByTitle(decodeURIComponent(title));

    if (modules.length === 0) {
      return res.status(404).json({ message: 'No modules found for this topic' });
    }

    modules.forEach(m => {
      m.views = (m.views || 0) + 1;
    });
    await Module.bulkSave(modules);

    res.json({ modules, count: modules.length });
  } catch (error) {
    next(error);
  }
};

const createManualModule = async (req, res, next) => {
  try {
    const { title, subject, description, tags, stages } = req.body;

    if (!title || !subject || !stages || !Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({
        message: 'Title, subject, and at least one stage are required'
      });
    }

    const module = new Module({
      title: title.trim(),
      subject,
      description: description?.trim() || '',
      tags: Array.isArray(tags) ? tags.map(t => t.trim().toLowerCase()) : [],
      stages: stages.map((stage, index) => ({
        heading: stage.heading || `Stage ${index + 1}`,
        content: stage.content || '',
        quiz: (stage.quiz || []).map(q => ({
          question: q.question || '',
          options: Array.isArray(q.options) ? q.options : [],
          answer: q.answer || q.options?.[0] || ''
        }))
      })),
      creator: req.user._id,
      creatorName: req.user.name || 'Student',
      isPublic: true,
      isVerified: false,
      views: 0,
      isAIGenerated: false
    });

    await module.save();
    await module.populate('creator', 'name');

    res.status(201).json({
      message: 'Module created successfully',
      module
    });
  } catch (error) {
    next(error);
  }
};

const updateModule = async (req, res, next) => {
  try {
    const module = await Module.findById(req.params.id);

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    if (module.creator?.toString() !== req.user._id?.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this module' });
    }

    const { title, subject, description, tags, stages, isPublic } = req.body;

    if (title) module.title = title.trim();
    if (subject) module.subject = subject;
    if (description !== undefined) module.description = description.trim();
    if (tags) module.tags = tags.map(t => t.trim().toLowerCase());
    if (stages && Array.isArray(stages)) {
      module.stages = stages.map((stage, index) => ({
        heading: stage.heading || `Stage ${index + 1}`,
        content: stage.content || '',
        quiz: (stage.quiz || []).map(q => ({
          question: q.question || '',
          options: Array.isArray(q.options) ? q.options : [],
          answer: q.answer || ''
        }))
      }));
    }
    if (typeof isPublic === 'boolean') module.isPublic = isPublic;

    module.isVerified = false;
    await module.save();
    await module.populate('creator', 'name');

    res.json({
      message: 'Module updated successfully',
      module
    });
  } catch (error) {
    next(error);
  }
};

const deleteModule = async (req, res, next) => {
  try {
    const module = await Module.findById(req.params.id);

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    if (module.creator?.toString() !== req.user._id?.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this module' });
    }

    await Module.findByIdAndDelete(req.params.id);

    res.json({ message: 'Module deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const toggleEnrollment = async (req, res, next) => {
  try {
    const module = await Module.findById(req.params.id);

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const isEnrolled = await module.toggleEnrollment(req.user._id);

    res.json({
      message: isEnrolled ? 'Enrolled successfully' : 'Unenrolled successfully',
      enrolled: isEnrolled,
      enrolledCount: module.enrolledUsers?.length || 0
    });
  } catch (error) {
    next(error);
  }
};

const getMyModules = async (req, res, next) => {
  try {
    const modules = await Module.findByCreator(req.user._id);
    res.json(modules);
  } catch (error) {
    next(error);
  }
};

const getEnrolledModules = async (req, res, next) => {
  try {
    const modules = await Module.findEnrolled(req.user._id);
    res.json(modules);
  } catch (error) {
    next(error);
  }
};

const getEducationStats = async (req, res, next) => {
  try {
    const stats = await Module.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const verifyModule = async (req, res, next) => {
  try {
    const module = await Module.verifyModule(req.params.id);

    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    res.json({
      message: 'Module verified successfully',
      module
    });
  } catch (error) {
    next(error);
  }
};

const getSubjects = async (req, res, next) => {
  try {
    const subjects = [
      { value: 'Math', label: 'Mathematics', icon: '📐' },
      { value: 'Physics', label: 'Physics', icon: '⚛️' },
      { value: 'Chemistry', label: 'Chemistry', icon: '🧪' },
      { value: 'Biology', label: 'Biology', icon: '🧬' },
      { value: 'Engineering', label: 'Engineering', icon: '⚙️' },
      { value: 'Computer Science', label: 'Computer Science', icon: '💻' },
      { value: 'GST', label: 'General Studies', icon: '📚' },
      { value: 'COS', label: 'College of Sciences', icon: '🔬' },
      { value: 'Other', label: 'Other', icon: '📖' }
    ];
    res.json(subjects);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  generateModule,
  getPublicModules,
  getModule,
  getModuleByTitle,
  createManualModule,
  updateModule,
  deleteModule,
  toggleEnrollment,
  getMyModules,
  getEnrolledModules,
  getEducationStats,
  verifyModule,
  getSubjects
};
