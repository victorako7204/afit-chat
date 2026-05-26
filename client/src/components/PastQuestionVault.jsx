import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import PDFViewer from './PDFViewer';

const EXAM_TYPES = ['First Semester Exam', 'Second Semester Exam', 'Test', 'Quiz', 'Practice Sheet'];

const PastQuestionVault = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [filterCode, setFilterCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [form, setForm] = useState({
    courseCode: '', title: '', year: new Date().getFullYear(), examType: EXAM_TYPES[0], file: null
  });

  const fetchRecords = useCallback(async (courseCode) => {
    setLoading(true);
    try {
      const params = courseCode ? { courseCode } : {};
      const res = await api.get('/past-questions', { params });
      setRecords(res.data || []);
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const handleFilter = () => fetchRecords(filterCode.trim());

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!form.file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('pqFile', form.file);
      fd.append('courseCode', form.courseCode.toUpperCase());
      fd.append('title', form.title);
      fd.append('year', form.year);
      fd.append('examType', form.examType);
      await api.post('/past-questions/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowUpload(false);
      setForm({ courseCode: '', title: '', year: new Date().getFullYear(), examType: EXAM_TYPES[0], file: null });
      fetchRecords(filterCode.trim());
    } catch (err) {
      alert(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const isImage = (type) => ['image/jpeg', 'image/png'].includes(type);

  return (
    <div className="w-full max-w-[500px] mx-auto pt-16 pb-28 px-4 flex flex-col space-y-4">
      {previewFile && (
        isImage(previewFile.fileType) ? (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setPreviewFile(null)}>
            <img src={previewFile.fileUrl} alt={previewFile.title} className="max-w-full max-h-full object-contain" />
          </div>
        ) : (
          <PDFViewer fileUrl={previewFile.fileUrl} onClose={() => setPreviewFile(null)} />
        )
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Past Question Files</h1>
        <button onClick={() => setShowUpload(true)} className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg">
          Upload
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={filterCode}
          onChange={e => setFilterCode(e.target.value.toUpperCase())}
          placeholder="Filter by course code (e.g. PHY102)"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button onClick={handleFilter} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Search</button>
      </div>

      {showUpload && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900">Upload Past Question</h2>
            <form onSubmit={handleUpload} className="space-y-3">
              <input placeholder="Course Code *" value={form.courseCode} onChange={e => setForm({ ...form, courseCode: e.target.value.toUpperCase() })} required className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              <input type="number" placeholder="Year *" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} required className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" />
              <select value={form.examType} onChange={e => setForm({ ...form, examType: e.target.value })} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                {EXAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setForm({ ...form, file: e.target.files[0] })} required className="w-full text-sm" />
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={uploading} className="flex-1 py-2 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg disabled:opacity-50">
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
                <button type="button" onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No past question files found.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {records.map(r => (
            <div key={r._id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex flex-col space-y-2">
              <div className="flex items-start justify-between">
                <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">{r.courseCode}</span>
                {isImage(r.fileType) ? (
                  <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">{r.title}</p>
              <p className="text-xs text-gray-400">{r.year} · {r.examType}</p>
              <button onClick={() => setPreviewFile(r)} className="w-full py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg">
                Preview
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PastQuestionVault;
