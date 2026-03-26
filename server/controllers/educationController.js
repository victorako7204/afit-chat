const Module = require('../models/Module');
const GEMINI_API_KEYS = [
  process.env.GEMINI_KEY_1,
  process.env.GEMINI_KEY_2,
  process.env.GEMINI_KEY_3,
  process.env.GEMINI_KEY_4,
  process.env.GEMINI_KEY_5
].filter(Boolean);

console.log('🔑 Gemini API keys loaded:', GEMINI_API_KEYS.length);

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_INSTRUCTION = `You are an AFIT Academic Expert for the Nigerian Air Force Institute of Technology. Generate a 5-stage university module for the given topic.

Use LaTeX for math (e.g., $E = mc^2$, $\\frac{dy}{dx}$). Output ONLY raw JSON in this format:
{"title":"","subject":"","description":"","tags":[""],"stages":[{"heading":"","content":"","quiz":[{"question":"","options":["","","",""],"answer":""}]}]}`;

const callGeminiAPI = async (topic, keyIndex = 0) => {
  const apiKey = GEMINI_API_KEYS[keyIndex];
  
  if (!apiKey) {
    throw new Error('Gemini API key not configured at index ' + keyIndex);
  }
  
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `${SYSTEM_INSTRUCTION}\n\nGenerate a comprehensive module for: ${topic}` }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        topP: 0.9,
        topK: 40
      }
    })
  });

  if (response.status === 429 && keyIndex < GEMINI_API_KEYS.length - 1) {
    console.log(`Rate limited with key ${keyIndex}, switching to key ${keyIndex + 1}`);
    return callGeminiAPI(topic, keyIndex + 1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data;
};

const sanitizeGeminiResponse = (text) => {
  if (!text) return null;
  
  let cleaned = text.replace(/```json\n?|```\n?/gi, '');
  cleaned = cleaned.replace(/```/g, '');
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.error('Failed to parse Gemini response:', err);
        return null;
      }
    }
    return null;
  }
};

const generateModule = async (req, res, next) => {
  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
      return res.status(400).json({ message: 'Topic must be at least 3 characters' });
    }

    // Check if API keys are configured
    if (GEMINI_API_KEYS.length === 0) {
      console.error('❌ No Gemini API keys configured');
      return res.status(503).json({ 
        message: 'AI service is currently unavailable. No API keys configured. Please contact the administrator.'
      });
    }

    const normalizedTopic = topic.trim().toLowerCase();

    const existingModules = await Module.find({
      isPublic: true,
      $or: [
        { title: { $regex: `^${normalizedTopic}$`, $options: 'i' } },
        { tags: { $in: [normalizedTopic] } }
      ]
    }).limit(1);

    if (existingModules.length > 0) {
      const cached = existingModules[0];
      cached.views = (cached.views || 0) + 1;
      await cached.save();
      
      return res.json({
        message: 'Module found in cache',
        module: cached,
        cached: true
      });
    }

    let moduleData;
    let attempts = 0;
    const maxAttempts = GEMINI_API_KEYS.length;
    let lastError = null;

    while (attempts < maxAttempts) {
      try {
        console.log(`🔄 Attempt ${attempts + 1}/${maxAttempts} with API key ${attempts}`);
        const data = await callGeminiAPI(topic.trim(), attempts);
        
        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          const rawText = data.candidates[0].content.parts[0].text;
          moduleData = sanitizeGeminiResponse(rawText);
          
          if (moduleData && moduleData.title && moduleData.stages) {
            console.log('✅ Module generated successfully');
            break;
          } else {
            console.log('⚠️ Invalid module structure, retrying...');
          }
        }
        
        attempts++;
      } catch (apiError) {
        attempts++;
        lastError = apiError.message;
        console.error(`❌ API call attempt ${attempts} failed:`, apiError.message);
        
        if (attempts >= maxAttempts) {
          console.log('❌ All API keys failed. Searching for similar modules...');
          
          const similarModules = await Module.find({
            isPublic: true,
            $or: [
              { title: { $regex: normalizedTopic.split(' ')[0], $options: 'i' } },
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
            message: 'AI service is temporarily unavailable. Please try again later or create a module manually.'
          });
        }
      }
    }

    if (!moduleData || !moduleData.stages) {
      return res.status(500).json({ 
        message: 'Failed to generate module content. Please try a different topic.' 
      });
    }

    const module = new Module({
      title: moduleData.title || topic.trim(),
      subject: moduleData.subject || 'Other',
      description: moduleData.description || `AI-generated module on ${topic}`,
      tags: moduleData.tags || [topic.trim().toLowerCase()],
      stages: moduleData.stages.map(stage => ({
        heading: stage.heading || 'Untitled Stage',
        content: stage.content || '',
        quiz: (stage.quiz || []).map(q => ({
          question: q.question || '',
          options: Array.isArray(q.options) ? q.options : [],
          answer: q.answer || q.options?.[0] || ''
        }))
      })),
      creator: req.user?._id,
      creatorName: 'AI-Gemini',
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
