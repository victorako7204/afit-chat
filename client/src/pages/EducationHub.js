import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { educationAPI } from '../services/api';
import { Button, Card, Input, Modal } from '../components/UI';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const SUBJECTS = [
  { value: 'All', label: 'All Subjects', icon: '📚' },
  { value: 'Math', label: 'Mathematics', icon: '📐' },
  { value: 'Physics', label: 'Physics', icon: '⚛️' },
  { value: 'Chemistry', label: 'Chemistry', icon: '🧪' },
  { value: 'Biology', label: 'Biology', icon: '🧬' },
  { value: 'Engineering', label: 'Engineering', icon: '⚙️' },
  { value: 'Computer Science', label: 'Computer Science', icon: '💻' },
  { value: 'GST', label: 'General Studies', icon: '📖' },
  { value: 'COS', label: 'College of Sciences', icon: '🔬' },
  { value: 'Other', label: 'Other', icon: '📕' }
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

  const fetchModules = useCallback(async (subject, search) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params = {};
      if (subject !== 'All') params.subject = subject;
      if (search) params.search = search;
      
      const res = await educationAPI.getPublicModules(params);
      setModules(res.data?.modules || res.data || []);
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
          
          // Check if it's a server unavailable error (503)
          if (err?.response?.status === 503 && attempt < retries) {
            const waitTime = attempt * 3000; // 3s, 6s
            console.log(`Server waking up, retrying in ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
          } else {
            // Get the most helpful error message
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

  const renderModuleCard = (module) => {
    if (!module) return null;
    
    const isEnrolled = Array.isArray(enrolledModules) && enrolledModules.some(m => m._id === module._id);
    
    return (
      <Card
        key={module._id}
        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-purple-300"
        onClick={() => handleOpenModule(module._id)}
      >
        <div className="flex items-start justify-between mb-3">
          <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
            {module.subject || 'Other'}
          </span>
          <div className="flex items-center gap-2">
            {module.isVerified && (
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Verified
              </span>
            )}
          </div>
        </div>
        
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
          {module.title || 'Untitled Module'}
        </h3>
        
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
          {module.description || 'No description available'}
        </p>
        
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {module.views || 0} views
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {module.stages?.length || 0} stages
          </span>
        </div>
        
        {user && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Button
              size="sm"
              variant={isEnrolled ? 'outline' : 'primary'}
              onClick={(e) => handleEnroll(module._id, e)}
              className="w-full"
            >
              {isEnrolled ? 'Enrolled' : 'Enroll Now'}
            </Button>
          </div>
        )}
      </Card>
    );
  };

  const renderPlayer = () => {
    if (!selectedModule) return null;
    
    const stages = selectedModule?.stages || [];
    const currentStage = stages[currentStageIndex];
    
    return (
      <div className="fixed inset-0 bg-white z-50 flex">
        <div className="w-72 bg-gray-50 border-r border-gray-200 overflow-y-auto">
          <div className="p-4 border-b border-gray-200 sticky top-0 bg-gray-50 z-10">
            <button
              onClick={handleClosePlayer}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Gallery
            </button>
            <h2 className="font-semibold text-gray-900 line-clamp-2">
              {selectedModule.title || 'Module'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {stages.length} stages · {selectedModule.subject}
            </p>
          </div>
          
          <div className="p-2">
            {stages.map((stage, index) => {
              if (!stage) return null;
              return (
                <button
                  key={index}
                  onClick={() => setCurrentStageIndex(index)}
                  className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                    currentStageIndex === index
                      ? 'bg-purple-100 text-purple-900'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      currentStageIndex === index
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium truncate">{stage.heading || `Stage ${index + 1}`}</span>
                  </div>
                  {stage.quiz?.length > 0 && (
                    <span className="ml-8 text-xs text-gray-400">
                      {stage.quiz.length} quiz questions
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-8">
            {currentStage ? (
              <>
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">
                    {currentStage.heading || `Stage ${currentStageIndex + 1}`}
                  </h1>
                  <p className="text-gray-500">
                    Stage {currentStageIndex + 1} of {stages.length}
                  </p>
                </div>
                
                <div className="prose prose-purple max-w-none mb-8">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      p: ({ children }) => <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>,
                      h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-4">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xl font-semibold text-gray-900 mt-5 mb-3">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">{children}</h3>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-4 text-gray-700 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-4 text-gray-700 space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-gray-700">{children}</li>,
                      code: ({ inline, className, children }) => {
                        if (inline) {
                          return <code className="bg-gray-100 px-1 py-0.5 rounded text-purple-600 text-sm">{children}</code>;
                        }
                        return (
                          <code className="block bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm mb-4">
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-purple-500 pl-4 italic text-gray-600 my-4">
                          {children}
                        </blockquote>
                      ),
                      strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto mb-4">
                          <table className="min-w-full border border-gray-200 rounded-lg">{children}</table>
                        </div>
                      ),
                      th: ({ children }) => <th className="border border-gray-200 bg-gray-50 px-4 py-2 text-left font-semibold">{children}</th>,
                      td: ({ children }) => <td className="border border-gray-200 px-4 py-2">{children}</td>,
                    }}
                  >
                    {currentStage.content || ''}
                  </ReactMarkdown>
                </div>
                
                {currentStage.quiz?.length > 0 && (
                  <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                    <h3 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Quiz - Test Your Knowledge
                    </h3>
                    
                    {currentStage.quiz.map((quiz, quizIndex) => {
                      if (!quiz) return null;
                      const answerKey = `${currentStageIndex}-${quizIndex}`;
                      const result = getQuizResult(currentStageIndex, quizIndex, quiz);
                      const selectedAnswer = quizAnswers[answerKey];
                      const isExpanded = expandedQuiz === answerKey;
                      
                      return (
                        <div key={quizIndex} className="bg-white rounded-lg p-4 mb-3 shadow-sm">
                          <button
                            onClick={() => setExpandedQuiz(isExpanded ? null : answerKey)}
                            className="w-full text-left flex items-center justify-between"
                          >
                            <span className="font-medium text-gray-900">
                              {quizIndex + 1}. {quiz.question || 'Question'}
                            </span>
                            <svg
                              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
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
                                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                      isSelected
                                        ? result === 'correct'
                                          ? 'border-green-500 bg-green-50'
                                          : 'border-red-500 bg-red-50'
                                        : isCorrect && showResult
                                          ? 'border-green-500 bg-green-50'
                                          : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className={isSelected && result === 'correct' ? 'text-green-700' : isSelected && result === 'incorrect' ? 'text-red-700' : 'text-gray-700'}>
                                        {option}
                                      </span>
                                      {showResult && isCorrect && (
                                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                      {isSelected && result === 'incorrect' && (
                                        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                              {selectedAnswer && (
                                <p className={`mt-2 text-sm ${result === 'correct' ? 'text-green-600' : 'text-red-600'}`}>
                                  {result === 'correct' ? '✓ Correct!' : `✗ Incorrect. The correct answer is: ${quiz.answer}`}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStageIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentStageIndex === 0}
                  >
                    ← Previous Stage
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => setCurrentStageIndex(prev => Math.min(stages.length - 1, prev + 1))}
                    disabled={currentStageIndex === stages.length - 1}
                  >
                    Next Stage →
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
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
      <form onSubmit={handleSubmit} className="space-y-6 max-h-96 overflow-y-auto pr-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Module Title *</label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g., Introduction to Calculus"
            required
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
            <select
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {SUBJECTS.filter(s => s.value !== 'All').map(subject => (
                <option key={subject.value} value={subject.value}>
                  {subject.icon} {subject.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <Input
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="calculus, derivatives, math"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of the module..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">Stages *</label>
            <Button type="button" size="sm" variant="outline" onClick={handleAddStage}>
              + Add Stage
            </Button>
          </div>
          
          {stages.map((stage, stageIndex) => (
            <div key={stageIndex} className="bg-gray-50 rounded-lg p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Stage {stageIndex + 1}</span>
                {stages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveStage(stageIndex)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
                
                <div className="text-xs text-gray-500">
                  Tip: Use $formula$ for inline LaTeX and $$formula$$ for block equations
                </div>
                
                <div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddQuiz(stageIndex)}
                  >
                    + Add Quiz Question
                  </Button>
                  
                  {stage.quiz.map((quiz, quizIndex) => (
                    <div key={quizIndex} className="mt-2 p-3 bg-white rounded border border-gray-200">
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
        
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !formData.title.trim()}>
            {submitting ? 'Creating...' : 'Create Module'}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showPlayerModal && (
        <div className="fixed inset-0 z-50">
          {renderPlayer()}
        </div>
      )}
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">AFIT Education Hub</h1>
            <p className="text-gray-500 mt-1">Learn, create, and share educational modules</p>
          </div>
          
          {user && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowGenerateModal(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Generate
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Module
              </Button>
            </div>
          )}
        </div>
        
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <Card className="text-center py-4">
              <p className="text-3xl font-bold text-purple-600">{stats.totalModules || 0}</p>
              <p className="text-sm text-gray-500">Total Modules</p>
            </Card>
            <Card className="text-center py-4">
              <p className="text-3xl font-bold text-blue-600">{stats.totalViews || 0}</p>
              <p className="text-sm text-gray-500">Total Views</p>
            </Card>
            <Card className="text-center py-4">
              <p className="text-3xl font-bold text-green-600">{stats.verifiedCount || 0}</p>
              <p className="text-sm text-gray-500">Verified</p>
            </Card>
            <Card className="text-center py-4">
              <p className="text-3xl font-bold text-orange-600">{Array.isArray(enrolledModules) ? enrolledModules.length : 0}</p>
              <p className="text-sm text-gray-500">Enrolled</p>
            </Card>
          </div>
        )}
        
        <div className="flex gap-6 mb-6">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search modules..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            {SUBJECTS.map(subject => (
              <button
                key={subject.value}
                onClick={() => setSelectedSubject(subject.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedSubject === subject.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300'
                }`}
              >
                {subject.icon} {subject.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          {['gallery', 'enrolled', 'my'].map(tab => {
            if (tab === 'enrolled' && !user) return null;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'gallery' ? '📚 Public Modules' : tab === 'enrolled' ? '📖 Enrolled' : '👤 My Modules'}
              </button>
            );
          })}
        </div>
        
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => { setErrorMessage(null); fetchModules(selectedSubject, debouncedSearch); }} className="text-red-500 hover:text-red-700">
              Retry
            </button>
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-purple-600 border-t-transparent" />
          </div>
        ) : (
          <>
            {activeTab === 'gallery' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules?.length > 0 ? (
                  modules.map(module => renderModuleCard(module))
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <p className="text-lg">No modules found</p>
                    <p className="text-sm">Try a different search or create a new module</p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'enrolled' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enrolledModules?.length > 0 ? (
                  enrolledModules.map(module => renderModuleCard(module))
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <p className="text-lg">No enrolled modules yet</p>
                    <p className="text-sm">Enroll in modules from the gallery to track your progress</p>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'my' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myModules?.length > 0 ? (
                  myModules.map(module => (
                    <div key={module._id} className="relative">
                      {renderModuleCard(module)}
                      {user?.role === 'admin' && !module.isVerified && (
                        <button
                          onClick={async () => {
                            try {
                              await educationAPI.verifyModule(module._id);
                              fetchMyModules();
                            } catch (err) {
                              console.error('Error verifying module:', err);
                            }
                          }}
                          className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <p className="text-lg">You haven't created any modules yet</p>
                    <p className="text-sm">Share your knowledge by creating educational content</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      <Modal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        title="AI Module Generator"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter a topic and our AI will generate a comprehensive 5-stage educational module with quizzes.
          </p>
          
          <Input
            value={generateTopic}
            onChange={(e) => setGenerateTopic(e.target.value)}
            placeholder="e.g., Introduction to Differential Equations"
            disabled={generating}
          />
          
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-medium text-purple-900 mb-2">What you'll get:</h4>
            <ul className="text-sm text-purple-700 space-y-1">
              <li>• 5 comprehensive stages with detailed content</li>
              <li>• LaTeX formulas for mathematical expressions</li>
              <li>• Quiz questions with multiple choice answers</li>
              <li>• Automatically saved to the public gallery</li>
            </ul>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowGenerateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateModule} disabled={!generateTopic.trim() || generating}>
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Generating...
                </>
              ) : (
                'Generate Module'
              )}
            </Button>
          </div>
        </div>
      </Modal>
      
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
