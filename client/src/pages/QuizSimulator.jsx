import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizAPI } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

const COURSES = [
  { value: 'PHY102', label: 'PHY 102 (General Physics II)' },
  { value: 'MTH102', label: 'MTH 102 (Functions, Differentiation, Integration)' }
];

const LIMITS = [5, 10, 20, 30, 50, 0];

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

const mdComponents = {
  p: ({ children }) => <span className="text-sm text-gray-900 leading-relaxed">{children}</span>,
};

const QuizSimulator = () => {
  const navigate = useNavigate();
  const [courseCode, setCourseCode] = useState('PHY102');
  const [questionLimit, setQuestionLimit] = useState(10);
  const [isQuizStarted, setIsQuizStarted] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStart = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSubmitted(false);
    setScore(null);
    setAnswers({});
    try {
      const cleanCode = courseCode.replace(/\s+/g, '');
      const res = await quizAPI.getQuestions(cleanCode, questionLimit);
      console.log('Frontend Received Questions Payload:', res.data);
      const data = Array.isArray(res.data) ? res.data : (res.data?.questions || []);
      if (data.length === 0) {
        setError('No questions found for this course code. Please ensure the database has been seeded.');
        setIsQuizStarted(false);
      } else {
        setQuestions(data);
        setIsQuizStarted(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [courseCode, questionLimit]);

  const handleSelect = useCallback((qIndex, option) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qIndex]: option }));
  }, [submitted]);

  const handleSubmit = useCallback(() => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (answers[i] === q.correctOption) correct++;
    });
    setScore(correct);
    setSubmitted(true);
  }, [questions, answers]);

  const handleReset = useCallback(() => {
    setIsQuizStarted(false);
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setError(null);
  }, []);

  if (!isQuizStarted) {
    return (
      <div className="flex flex-col min-h-screen bg-white pt-16 pb-28 px-4 max-w-[500px] mx-auto">
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col space-y-2">
            <h1 className="text-xl font-bold text-gray-900">Past Questions & Answers</h1>
            <p className="text-sm text-gray-500">Select a course and number of questions to begin</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col space-y-4">
            <label className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Course</span>
              <select
                value={courseCode}
                onChange={e => setCourseCode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white appearance-none"
              >
                {COURSES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col space-y-1.5">
              <span className="text-sm font-medium text-gray-700">Number of Questions</span>
              <select
                value={questionLimit}
                onChange={e => setQuestionLimit(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white appearance-none"
              >
                {LIMITS.map(n => (
                  <option key={n} value={n}>{n === 0 ? 'All Questions' : `${n} questions`}</option>
                ))}
              </select>
            </label>

            <button
              onClick={handleStart}
              disabled={loading}
              className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" viewBox="0 0 24 24" />
                  Fetching past questions...
                </span>
              ) : 'Start Quiz'}
            </button>

            <button
              onClick={() => navigate('/education')}
              className="w-full py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Return to Education Hub
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white pt-16 pb-28 px-4 max-w-[500px] mx-auto">
      <div className="flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-gray-900">{courseCode.replace(/(\d{3})/, ' $1')} Quiz</h1>
            <p className="text-xs text-gray-500">{questions.length} questions</p>
          </div>
          {!submitted && (
            <span className="text-xs text-gray-400">
              {Object.keys(answers).length}/{questions.length} answered
            </span>
          )}
        </div>

        {score !== null && (
          <div className="p-6 bg-gradient-to-br from-purple-600 to-blue-500 rounded-2xl text-white text-center space-y-2">
            <p className="text-4xl font-bold">{score}/{questions.length}</p>
            <p className="text-sm opacity-90">
              {score === questions.length
                ? 'Perfect score!'
                : score >= questions.length * 0.6
                  ? 'Good job!'
                  : 'Keep practicing!'}
            </p>
          </div>
        )}

        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            <p className="text-gray-500 font-medium">No questions loaded</p>
            <button onClick={handleReset} className="px-6 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              ← Go Back
            </button>
          </div>
        ) : (
          questions.map((q, qIndex) => {
          const selected = answers[qIndex];
          const isWrong = submitted && selected && selected !== q.correctOption;

          return (
            <div
              key={q._id || qIndex}
              className="flex flex-col space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100"
            >
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-purple-600 mt-0.5 shrink-0">
                  {qIndex + 1}.
                </span>
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
                  {q.questionText}
                </ReactMarkdown>
              </div>

              <div className="flex flex-col space-y-2">
                {q.options.map((option, optIndex) => {
                  const label = OPTION_LABELS[optIndex];
                  const isSelected = selected === label;
                  let rowClass = 'border border-gray-200 bg-white hover:border-purple-300';

                  if (submitted) {
                    if (label === q.correctOption) {
                      rowClass = 'border border-green-500 bg-green-50';
                    } else if (isSelected && isWrong) {
                      rowClass = 'border border-red-500 bg-red-50';
                    } else {
                      rowClass = 'border border-gray-200 bg-white opacity-60';
                    }
                  } else if (isSelected) {
                    rowClass = 'border-2 border-purple-600 bg-purple-50';
                  }

                  return (
                    <button
                      key={optIndex}
                      onClick={() => handleSelect(qIndex, label)}
                      disabled={submitted}
                      className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm text-left transition-colors ${rowClass}`}
                    >
                      <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
                        submitted
                          ? label === q.correctOption
                            ? 'bg-green-500 text-white'
                            : isSelected && isWrong
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-200 text-gray-500'
                          : isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-600'
                      }`}>
                        {label}
                      </span>
                      <span className="text-gray-800">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
                          {option}
                        </ReactMarkdown>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })  
        )}
        
        {!submitted ? (
          <button
            onClick={handleSubmit}
            className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg hover:opacity-90 transition-opacity"
          >
            Submit Simulation
          </button>
        ) : (
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleReset}
              className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg hover:opacity-90 transition-opacity"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/education')}
              className="w-full py-3 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ← Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizSimulator;
