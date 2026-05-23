const Module = require('../models/Module');

const OpenAI = require('openai');

const qwenClient = new OpenAI({
  baseURL: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  apiKey: process.env.DASHSCOPE_API_KEY
});

const generateModule = async (req, res, next) => {
  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
      return res.status(400).json({ message: 'Topic must be at least 3 characters' });
    }

    if (!process.env.DASHSCOPE_API_KEY) {
      console.error('❌ No DASHSCOPE_API_KEY configured');
      return res.status(503).json({
        message: 'AI service is currently unavailable. No API key configured. Please contact the administrator.'
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
        message: 'Module found in cache',
        module: existingModule,
        cached: true
      });
    }

    let generatedCourse;
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;

    while (attempts < maxAttempts) {
      try {
        console.log(`🔄 Qwen generation attempt ${attempts + 1}/${maxAttempts}`);

        const completion = await qwenClient.chat.completions.create({
          model: "qwen3.5-flash",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "You are the AFIT Academic Engine. You must return a strict JSON object matching the exact requested structural schema. Do not include markdown code block formatting or introductory text."
            },
            {
              role: "user",
              content: `Generate a simplified learning module for the topic: "${topic}". Structure it explicitly as a JSON object with this shape:
      {
        "courseTitle": "String",
        "subject": "Math|Physics|GST|COS|Chemistry|Biology|Engineering|Computer Science|Other",
        "description": "String",
        "tags": ["tag1", "tag2"],
        "modules": [
          {
            "moduleId": 1,
            "moduleTitle": "String",
            "content": "Step-by-step simplified explanations using LaTeX where appropriate (e.g. $E = mc^2$, $\\\\frac{dy}{dx}$)...",
            "quiz": [
              {
                "question": "String",
                "options": ["A", "B", "C", "D"],
                "correctAnswer": "String"
              }
            ]
          }
        ]
      }`
            }
          ]
        });

        const rawText = completion.choices[0].message.content;
        console.log("📥 Raw Qwen response length:", rawText?.length);

        generatedCourse = JSON.parse(rawText);

        if (generatedCourse && generatedCourse.courseTitle && Array.isArray(generatedCourse.modules) && generatedCourse.modules.length > 0) {
          console.log('✅ Course generated successfully');
          break;
        } else {
          console.log('⚠️ Invalid course structure, retrying...');
        }

        attempts++;
      } catch (apiError) {
        attempts++;
        lastError = apiError.message;
        console.error(`❌ Qwen API call attempt ${attempts} failed:`, apiError.message);

        if (attempts >= maxAttempts) {
          console.log('❌ All Qwen attempts failed. Searching for similar modules...');

          const similarModules = await Module.find({
            isPublic: true,
            $or: [
              { title: { $regex: escapedTopic.split(' ')[0], $options: 'i' } },
              { tags: { $in: normalizedTopic.split(' ') } },
              { subject: { $in: ['Math', 'Physics', 'Engineering', 'Computer Science'] } }
            ]
          }).sort({ views: -1 }).limit(3);

          if (similarModules.length > 0) {
            const fallbackModule = similarModules[0];
            fallbackModule.views = (fallbackModule.views || 0) + 1;
            await fallbackModule.save();

            return res.json({
              message: 'AI service had issues. Here is a similar module:',
              module: fallbackModule,
              cached: true,
              fallback: true
            });
          }

          return res.status(503).json({
            message: 'AI service is temporarily unavailable. Please try again later or create a module manually.',
            error: lastError
          });
        }
      }
    }

    if (!generatedCourse || !generatedCourse.courseTitle || !Array.isArray(generatedCourse.modules)) {
      return res.status(500).json({
        message: 'Failed to generate module content. Please try a different topic.'
      });
    }

    const module = new Module({
      title: generatedCourse.courseTitle || topic.trim(),
      subject: generatedCourse.subject || 'Other',
      description: generatedCourse.description || `AI-generated module on ${topic}`,
      tags: generatedCourse.tags || [topic.trim().toLowerCase()],
      stages: generatedCourse.modules.map(mod => ({
        moduleId: mod.moduleId || undefined,
        heading: mod.moduleTitle || 'Untitled Stage',
        content: mod.content || '',
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

    res.status(201).json({
      message: 'Module generated and saved successfully',
      module,
      cached: false
    });

  } catch (error) {
    console.error('Error generating module:', error);
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
      .populate('creator', 'name matricNo')
      .populate('enrolledUsers', 'name matricNo');

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
      views: 0
    });

    await module.save();
    await module.populate('creator', 'name matricNo');

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
    await module.populate('creator', 'name matricNo');

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
