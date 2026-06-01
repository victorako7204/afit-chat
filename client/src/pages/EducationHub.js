import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { educationAPI } from '../services/api';
import { Input, Modal } from '../components/UI';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Search, Plus, Sparkles, BookOpen, Eye, ChevronLeft, Loader2, X, Check, ChevronDown } from 'lucide-react';

const SUBJECTS = [
  { value: 'All', label: 'All Subjects', icon: '📚', color: '#0095f6' },
  { value: 'Math', label: 'Mathematics', icon: '📐', color: '#0095f6' },
  { value: 'Physics', label: 'Physics', icon: '⚛️', color: '#00d26a' },
  { value: 'Chemistry', label: 'Chemistry', icon: '🧪', color: '#ed4956' },
  { value: 'Biology', label: 'Biology', icon: '🧬', color: '#00d26a' },
  { value: 'Engineering', label: 'Engineering', icon: '⚙️', color: '#0095f6' },
  { value: 'Computer Science', label: 'Computer Science', icon: '💻', color: '#0095f6' },
  { value: 'GST', label: 'General Studies', icon: '📖', color: '#a8a8a8' },
  { value: 'COS', label: 'College of Sciences', icon: '🔬', color: '#00d26a' },
  { value: 'Other', label: 'Other', icon: '📕', color: '#737373' }
];

const EducationHub = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('gallery');
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [stats, setStats] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [selectedModule, setSelectedModule] = useState(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [generateTopic, setGenerateTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [enrolledModules, setEnrolledModules] = useState([]);
  const [myModules, setMyModules] = useState([]);
  const [expandedQuiz, setExpandedQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});

  const searchTimeoutRef = useRef(null);
  const filterScrollRef = useRef(null);

  const fetchModules = useCallback(async (subject, search) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = {};
      if (subject !== 'All') params.subject = subject;
      if (search) params.search = search;

      const res = await educationAPI.getPublicModules(params);
      setModules(res.data?.modules || []);
    } catch (err) {
      console.error('Error fetching modules:', err);
      setErrorMessage('Failed to load modules. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = async () => {
    try {
      const res = await educationAPI.getStats();
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchEnrolledModules = async () => {
    if (!user) return;
    try {
      const res = await educationAPI.getEnrolledModules();
      setEnrolledModules(res.data || []);
    } catch (err) {
      console.error('Error fetching enrolled modules:', err);
    }
  };

  const fetchMyModules = async () => {
    if (!user) return;
    try {
      const res = await educationAPI.getMyModules();
      setMyModules(res.data || []);
    } catch (err) {
      console.error('Error fetching my modules:', err);
    }
  };

  useEffect(() => {
    fetchModules(selectedSubject, debouncedSearch);
    fetchStats();
    if (user) {
      fetchEnrolledModules();
      fetchMyModules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedSubject, debouncedSearch]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleGenerateModule = async () => {
    if (!generateTopic.trim() || !user) return;
    setGenerating(true);

    const generateWithRetry = async (retries = 2) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await educationAPI.generateModule(generateTopic.trim());
          if (res.data?.module) {
            setModules(prev => [res.data.module, ...prev]);
            setShowGenerateModal(false);
            setGenerateTopic('');
            setSelectedModule(res.data.module);
            setShowPlayerModal(true);
            fetchStats();
            fetchMyModules();
            return { success: true };
          }
        } catch (err) {
          console.error(`Generate attempt ${attempt} failed:`, err);
          if (err?.response?.status === 503 && attempt < retries) {
            const waitTime = attempt * 3000;
            console.log(`Server waking up, retrying in ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
          } else {
            const errorMsg = err?.response?.data?.message ||
                           err?.userMessage ||
                           'Failed to generate module';
            return { success: false, error: errorMsg };
          }
        }
      }
      return { success: false, error: 'Failed after multiple attempts. Please try again.' };
    };

    try {
      const result = await generateWithRetry(2);
      if (!result.success) {
        alert(result.error);
      }
    } catch (err) {
      console.error('Error generating module:', err);
      alert(err?.response?.data?.message || err?.userMessage || 'Failed to generate module');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenModule = async (moduleId) => {
    try {
      const res = await educationAPI.getModule(moduleId);
      if (res.data) {
        setSelectedModule(res.data);
        setCurrentStageIndex(0);
        setQuizAnswers({});
        setShowPlayerModal(true);
      }
    } catch (err) {
      console.error('Error opening module:', err);
    }
  };

  const handleEnroll = async (moduleId, e) => {
    if (e) e.stopPropagation();
    if (!user) return navigate('/login');
    try {
      const res = await educationAPI.toggleEnrollment(moduleId);
      if (res.data?.enrolled) {
        const moduleToAdd = modules.find(m => m._id === moduleId) || { _id: moduleId };
        setEnrolledModules(prev => {
          if (Array.isArray(prev) && prev.some(m => m._id === moduleId)) return prev;
          return [...prev, moduleToAdd];
        });
      } else {
        setEnrolledModules(prev => Array.isArray(prev) ? prev.filter(m => m._id !== moduleId) : []);
      }
      if (selectedModule?._id === moduleId) {
        setSelectedModule(prev => ({ ...prev, enrolled: res.data.enrolled }));
      }
    } catch (err) {
      console.error('Error toggling enrollment:', err);
    }
  };

  const handleClosePlayer = () => {
    setShowPlayerModal(false);
    setSelectedModule(null);
    setCurrentStageIndex(0);
    setQuizAnswers({});
  };

  const handleCheckQuiz = (stageIndex, quizIndex, selectedOption) => {
    setQuizAnswers(prev => ({ ...prev, [`${stageIndex}-${quizIndex}`]: selectedOption }));
  };

  const getQuizResult = (stageIndex, quizIndex, quiz) => {
    const answerKey = `${stageIndex}-${quizIndex}`;
    const selected = quizAnswers[answerKey];
    if (!selected) return null;
    return selected === quiz.answer ? 'correct' : 'incorrect';
  };

  const getSubjectInfo = (subject) => {
    return SUBJECTS.find(s => s.value === subject) || SUBJECTS[SUBJECTS.length - 1];
  };

  const viewCount = stats?.totalViews || 0;
  const moduleCount = stats?.totalModules || 0;

  const renderModuleCard = (module) => {
    if (!module) return null;
    const subjectInfo = getSubjectInfo(module.subject);
    const isEnrolled = Array.isArray(enrolledModules) && enrolledModules.some(m => m._id === module._id);
    const authorName = module.authorId?.name || module.authorName || 'Unknown';
    const initial = (authorName || 'U')[0];

    return (
      <div
        key={module._id}
        onClick={() => handleOpenModule(module._id)}
        className="flex flex-col rounded-xl overflow-hidden cursor-pointer active:scale-[0.97] transition-transform"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div
          className="aspect-[4/3] flex items-center justify-center relative"
          style={{ backgroundColor: subjectInfo.color + '20' }}
        >
          <span className="text-4xl">{subjectInfo.icon}</span>
          {module.isVerified && (
            <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
              <Check size={12} strokeWidth={3} color="white" />
            </div>
          )}
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: subjectInfo.color, color: 'white' }}>
            {module.subject || 'Other'}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 p-3">
          <h3 className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--text-primary)' }}>
            {module.title || 'Untitled Module'}
          </h3>
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>
            {module.description || 'No description available'}
          </p>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[9px] font-bold" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
                {initial}
              </div>
              <span className="text-[11px] truncate max-w-[100px]" style={{ color: 'var(--text-secondary)' }}>{authorName}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Eye size={12} style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{module.views || 0}</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen size={12} style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{module.stages?.length || 0}</span>
              </div>
            </div>
          </div>
          {user && (
            <button
              onClick={(e) => handleEnroll(module._id, e)}
              className="mt-1.5 w-full py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor: isEnrolled ? 'var(--bg-tertiary)' : 'var(--accent)',
                color: isEnrolled ? 'var(--text-primary)' : 'white'
              }}
            >
              {isEnrolled ? 'Enrolled' : 'Enroll'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderPlayer = () => {
    if (!selectedModule) return null;

    const stages = selectedModule?.stages || [];
    const currentStage = stages[currentStageIndex];

    return (
      <div className="fixed inset-0 z-50 flex flex-col animate-slide-up" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="sticky top-0 z-10 px-4 py-3" style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={handleClosePlayer} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <ChevronLeft size={18} />
              Back
            </button>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{selectedModule.subject} · {stages.length} stages</span>
          </div>
          <h2 className="text-base font-semibold truncate pr-4">{selectedModule.title || 'Module'}</h2>
          <div className="flex gap-1.5 mt-2 overflow-x-auto scrollbar-none pb-1">
            {stages.map((stage, index) => {
              if (!stage) return null;
              return (
                <button
                  key={stage.moduleId ?? index}
                  onClick={() => setCurrentStageIndex(index)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    currentStageIndex === index
                      ? 'text-white'
                      : ''
                  }`}
                  style={{
                    backgroundColor: currentStageIndex === index ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: currentStageIndex === index ? 'white' : 'var(--text-secondary)'
                  }}
                >
                  {stage.heading || `Stage ${index + 1}`}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-4">
            {currentStage ? (
              <div className="flex flex-col space-y-4">
                <div>
                  <h1 className="text-lg font-bold">{currentStage.heading || `Stage ${currentStageIndex + 1}`}</h1>
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                    Stage {currentStageIndex + 1} of {stages.length}
                  </p>
                </div>

                <div className="max-w-none mb-8 leading-relaxed text-sm" style={{ color: 'var(--text-primary)' }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <p className="mb-4 leading-relaxed">{children}</p>,
                      h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-semibold mt-5 mb-3">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      code: ({ inline, className, children }) => {
                        if (inline) {
                          return <code className="px-1 py-0.5 rounded text-sm" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent)' }}>{children}</code>;
                        }
                        return (
                          <code className="block p-4 rounded-lg overflow-x-auto text-sm mb-4" style={{ backgroundColor: '#0d0d0d', color: '#00d26a' }}>
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => <pre className="p-4 rounded-lg overflow-x-auto mb-4" style={{ backgroundColor: '#0d0d0d' }}>{children}</pre>,
                      blockquote: ({ children }) => (
                        <blockquote className="pl-4 italic my-4" style={{ borderLeft: '4px solid var(--accent)', color: 'var(--text-secondary)' }}>
                          {children}
                        </blockquote>
                      ),
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto mb-4">
                          <table className="min-w-full" style={{ border: '1px solid var(--border)' }}>{children}</table>
                        </div>
                      ),
                      th: ({ children }) => <th className="px-4 py-2 text-left font-semibold" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-tertiary)' }}>{children}</th>,
                      td: ({ children }) => <td className="px-4 py-2" style={{ border: '1px solid var(--border)' }}>{children}</td>,
                    }}
                  >
                    {currentStage.content || ''}
                  </ReactMarkdown>
                </div>

                {currentStage.quiz?.length > 0 && (
                  <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                    <h3 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                      Quiz
                    </h3>

                    {currentStage.quiz.map((quiz, quizIndex) => {
                      if (!quiz) return null;
                      const answerKey = `${currentStageIndex}-${quizIndex}`;
                      const result = getQuizResult(currentStageIndex, quizIndex, quiz);
                      const selectedAnswer = quizAnswers[answerKey];
                      const isExpanded = expandedQuiz === answerKey;

                      return (
                        <div key={quizIndex} className="rounded-lg p-4 mb-3" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                          <button
                            onClick={() => setExpandedQuiz(isExpanded ? null : answerKey)}
                            className="w-full text-left flex items-center justify-between"
                          >
                            <span className="font-medium text-sm">
                              {quizIndex + 1}. {quiz.question || 'Question'}
                            </span>
                            <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
                          </button>

                          {isExpanded && (
                            <div className="mt-4 space-y-2">
                              {quiz.options?.map((option, optIndex) => {
                                const isSelected = selectedAnswer === option;
                                const isCorrect = option === quiz.answer;
                                const showResult = selectedAnswer;

                                return (
                                  <button
                                    key={optIndex}
                                    onClick={() => !showResult && handleCheckQuiz(currentStageIndex, quizIndex, option)}
                                    disabled={!!showResult}
                                    className="w-full text-left p-3 rounded-lg text-sm transition-colors"
                                    style={{
                                      border: `1px solid ${
                                        isSelected
                                          ? result === 'correct' ? 'var(--success)' : 'var(--danger)'
                                          : isCorrect && showResult ? 'var(--success)' : 'var(--border)'
                                      }`,
                                      backgroundColor: isSelected || (isCorrect && showResult)
                                        ? (result === 'correct' || (isCorrect && showResult)) ? 'rgba(0,210,106,0.1)' : 'rgba(237,73,86,0.1)'
                                        : 'transparent'
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span style={{ color: isSelected && result === 'incorrect' ? 'var(--danger)' : 'var(--text-primary)' }}>
                                        {option}
                                      </span>
                                      {showResult && isCorrect && <Check size={16} style={{ color: 'var(--success)' }} strokeWidth={3} />}
                                      {isSelected && result === 'incorrect' && <X size={16} style={{ color: 'var(--danger)' }} strokeWidth={3} />}
                                    </div>
                                  </button>
                                );
                              })}
                              {selectedAnswer && (
                                <p className="mt-2 text-sm" style={{ color: result === 'correct' ? 'var(--success)' : 'var(--danger)' }}>
                                  {result === 'correct' ? 'Correct!' : `Incorrect. The correct answer is: ${quiz.answer}`}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setCurrentStageIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentStageIndex === 0}
                    className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    ← Previous
                  </button>
                  <button
                    onClick={() => setCurrentStageIndex(prev => Math.min(stages.length - 1, prev + 1))}
                    disabled={currentStageIndex === stages.length - 1}
                    className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-40 transition-opacity"
                    style={{ backgroundColor: 'var(--accent)', color: 'white' }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
                No content available for this stage.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const CreateModuleForm = () => {
    const [formData, setFormData] = useState({
      title: '',
      subject: 'Math',
      description: '',
      tags: ''
    });
    const [stages, setStages] = useState([{ heading: '', content: '', quiz: [] }]);
    const [submitting, setSubmitting] = useState(false);

    const handleAddStage = () => {
      setStages(prev => [...prev, { heading: '', content: '', quiz: [] }]);
    };

    const handleRemoveStage = (index) => {
      setStages(prev => prev.filter((_, i) => i !== index));
    };

    const handleStageChange = (index, field, value) => {
      setStages(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    };

    const handleAddQuiz = (stageIndex) => {
      setStages(prev => {
        const updated = [...prev];
        updated[stageIndex].quiz.push({ question: '', options: ['', '', '', ''], answer: '' });
        return updated;
      });
    };

    const handleQuizChange = (stageIndex, quizIndex, field, value) => {
      setStages(prev => {
        const updated = [...prev];
        if (field === 'options') {
          updated[stageIndex].quiz[quizIndex].options = value.split(',').map(o => o.trim());
        } else {
          updated[stageIndex].quiz[quizIndex][field] = value;
        }
        return updated;
      });
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!formData.title.trim() || stages.length === 0) return;
      setSubmitting(true);

      try {
        const data = {
          ...formData,
          tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
          stages: stages.filter(s => s.heading && s.content)
        };

        const res = await educationAPI.createModule(data);
        if (res.data?.module) {
          setModules(prev => [res.data.module, ...prev]);
          setMyModules(prev => [res.data.module, ...prev]);
          setShowCreateModal(false);
          setFormData({ title: '', subject: 'Math', description: '', tags: '' });
          setStages([{ heading: '', content: '', quiz: [] }]);
          fetchStats();
        }
      } catch (err) {
        console.error('Error creating module:', err);
        alert('Failed to create module');
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-5 max-h-96 overflow-y-auto pr-2">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Module Title *</label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g., Introduction to Calculus"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Subject *</label>
            <select
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              {SUBJECTS.filter(s => s.value !== 'All').map(subject => (
                <option key={subject.value} value={subject.value}>
                  {subject.icon} {subject.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Tags (comma-separated)</label>
            <Input
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="calculus, derivatives, math"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of the module..."
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg resize-none"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Stages *</label>
            <button type="button" onClick={handleAddStage} className="px-3 py-1 text-xs font-semibold rounded-lg" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
              + Add Stage
            </button>
          </div>

          {stages.map((stage, stageIndex) => (
            <div key={stageIndex} className="rounded-lg p-4 mb-3" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Stage {stageIndex + 1}</span>
                {stages.length > 1 && (
                  <button type="button" onClick={() => handleRemoveStage(stageIndex)} className="text-xs" style={{ color: 'var(--danger)' }}>
                    Remove
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <Input
                  value={stage.heading}
                  onChange={(e) => handleStageChange(stageIndex, 'heading', e.target.value)}
                  placeholder="Stage heading (e.g., Stage 1: Introduction)"
                  required
                />

                <textarea
                  value={stage.content}
                  onChange={(e) => handleStageChange(stageIndex, 'content', e.target.value)}
                  placeholder="Stage content (supports Markdown and LaTeX)"
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-lg resize-none"
                  style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                />

                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Tip: Use $formula$ for inline LaTeX and $$formula$$ for block equations
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handleAddQuiz(stageIndex)}
                    className="text-xs font-semibold" style={{ color: 'var(--accent)' }}
                  >
                    + Add Quiz Question
                  </button>

                  {stage.quiz.map((quiz, quizIndex) => (
                    <div key={quizIndex} className="mt-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                      <Input
                        value={quiz.question}
                        onChange={(e) => handleQuizChange(stageIndex, quizIndex, 'question', e.target.value)}
                        placeholder="Quiz question"
                        className="mb-2"
                      />
                      <Input
                        value={quiz.options?.join(', ')}
                        onChange={(e) => handleQuizChange(stageIndex, quizIndex, 'options', e.target.value)}
                        placeholder="Options (comma-separated)"
                        className="mb-2"
                      />
                      <Input
                        value={quiz.answer}
                        onChange={(e) => handleQuizChange(stageIndex, quizIndex, 'answer', e.target.value)}
                        placeholder="Correct answer"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
          <button type="submit" disabled={submitting || !formData.title.trim()} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ backgroundColor: 'var(--accent)', color: 'white', opacity: submitting || !formData.title.trim() ? 0.5 : 1 }}>
            {submitting ? 'Creating...' : 'Create Module'}
          </button>
        </div>
      </form>
    );
  };

  const currentModules = activeTab === 'gallery' ? modules :
    activeTab === 'enrolled' ? enrolledModules :
    activeTab === 'my' ? myModules : [];

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {showPlayerModal && (
        <div className="fixed inset-0 z-50">
          {renderPlayer()}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-lg font-bold">Education Hub</span>
      </div>

      {stats && (
        <div className="flex gap-2 px-4 pb-3">
          {[
            { label: 'Modules', value: moduleCount },
            { label: 'Views', value: viewCount },
            { label: 'Enrolled', value: Array.isArray(enrolledModules) ? enrolledModules.length : 0 },
            { label: 'Verified', value: stats.verifiedCount || 0 },
          ].map((s) => (
            <div key={s.label} className="flex-1 text-center py-2.5 rounded-xl" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <p className="text-base font-bold" style={{ color: 'var(--accent)' }}>{s.value}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div className="px-4 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search modules..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl outline-none"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: 'none' }}
          />
        </div>
      </div>

      {/* Subject filter pills */}
      <div ref={filterScrollRef} className="flex gap-2 overflow-x-auto scrollbar-none px-4 pb-3">
        {SUBJECTS.map(subject => (
          <button
            key={subject.value}
            onClick={() => setSelectedSubject(subject.value)}
            className="flex-shrink-0 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
            style={{
              backgroundColor: selectedSubject === subject.value ? subject.color : 'var(--bg-secondary)',
              color: selectedSubject === subject.value ? 'white' : 'var(--text-secondary)'
            }}
          >
            {subject.icon} {subject.label}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      {user && (
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg transition-opacity"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            <Sparkles size={16} style={{ color: 'var(--accent)' }} />
            AI Generate
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-lg"
            style={{ backgroundColor: 'var(--accent)', color: 'white' }}
          >
            <Plus size={16} />
            Create
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex px-4 pb-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {['gallery', 'enrolled', 'my'].map(tab => {
          if (tab === 'enrolled' && !user) return null;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2.5 text-xs font-semibold transition-colors relative"
              style={{ color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
            >
              {tab === 'gallery' ? 'All Modules' : tab === 'enrolled' ? 'Enrolled' : 'My Modules'}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mx-4 mt-3 p-3 rounded-lg flex items-center justify-between" style={{ backgroundColor: 'rgba(237,73,86,0.1)', border: '1px solid var(--danger)' }}>
          <span className="text-sm" style={{ color: 'var(--danger)' }}>{errorMessage}</span>
          <button onClick={() => { setErrorMessage(null); fetchModules(selectedSubject, debouncedSearch); }} className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8">
          {currentModules.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {currentModules.map(module => renderModuleCard(module))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
              <BookOpen size={40} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
                {activeTab === 'gallery' ? 'No modules found' :
                 activeTab === 'enrolled' ? 'No enrolled modules yet' :
                 'You haven\'t created any modules yet'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                {activeTab === 'gallery' ? 'Try a different search or create a new module' :
                 activeTab === 'enrolled' ? 'Enroll in modules from the gallery' :
                 'Share your knowledge by creating educational content'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* AI Generate Modal */}
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="AI Module Generator"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Enter a topic and our AI will generate a comprehensive 5-stage educational module with quizzes.
          </p>

          <Input
            value={generateTopic}
            onChange={(e) => setGenerateTopic(e.target.value)}
            placeholder="e.g., Introduction to Differential Equations"
            disabled={generating}
          />

          <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <h4 className="font-medium text-sm mb-2" style={{ color: 'var(--accent)' }}>What you'll get:</h4>
            <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>• 5 comprehensive stages with detailed content</li>
              <li>• LaTeX formulas for mathematical expressions</li>
              <li>• Quiz questions with multiple choice answers</li>
              <li>• Automatically saved to the public gallery</li>
            </ul>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setShowGenerateModal(false)} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              Cancel
            </button>
            <button onClick={handleGenerateModule} disabled={!generateTopic.trim() || generating} className="px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-1.5" style={{ backgroundColor: 'var(--accent)', color: 'white', opacity: !generateTopic.trim() || generating ? 0.5 : 1 }}>
              {generating ? (
                <><Loader2 size={14} className="animate-spin" /> Generating...</>
              ) : (
                'Generate'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Educational Module"
        size="lg"
      >
        <CreateModuleForm />
      </Modal>
    </div>
  );
};

export default EducationHub;
