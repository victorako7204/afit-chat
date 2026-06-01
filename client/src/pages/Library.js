import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { libraryAPI } from '../services/api';
import { format } from 'date-fns';
import { Input, Textarea, Modal } from '../components/UI';
import PDFViewer from '../components/PDFViewer';
import PastQuestionVault from '../components/PastQuestionVault';
import { Upload, FileText, Eye, Trash2, BookOpen, Loader2 } from 'lucide-react';

const Library = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('books');
  const [resources, setResources] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState(null);
  const [filter, setFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newResource, setNewResource] = useState({
    title: '',
    description: '',
    department: '',
    file: null
  });
  const [error, setError] = useState('');

  const handleViewPdf = (resource) => {
    setSelectedPdfUrl(resource.fileUrl);
    setShowPdfViewer(true);
  };

  const handleClosePdfViewer = () => {
    setShowPdfViewer(false);
    setSelectedPdfUrl(null);
  };

  const fetchResources = useCallback(async () => {
    try {
      const res = await libraryAPI.getResources(filter);
      setResources(res.data);
    } catch (err) {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const fetchDepartments = async () => {
    try {
      const res = await libraryAPI.getDepartments();
      setDepartments(res.data);
    } catch (err) {
      // Silently handle error
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setNewResource({ ...newResource, file });
      setError('');
    } else {
      setError('Please select a PDF file');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setError('');

    if (!newResource.file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append('title', newResource.title);
    formData.append('description', newResource.description);
    formData.append('department', newResource.department);
    formData.append('file', newResource.file);

    try {
      await libraryAPI.uploadResource(formData);
      setShowModal(false);
      setNewResource({ title: '', description: '', department: '', file: null });
      fetchResources();
      fetchDepartments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload resource');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (resourceId) => {
    try {
      await libraryAPI.deleteResource(resourceId);
      fetchResources();
    } catch (err) {
      // Silently handle error
    }
  };

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-lg font-bold">Library</span>
        {activeTab === 'books' && (
          <button
            onClick={() => { setShowModal(true); fetchDepartments(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg"
            style={{ backgroundColor: 'var(--accent)', color: 'white' }}
          >
            <Upload size={14} />
            Upload
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex px-4 pb-0" style={{ borderBottom: '1px solid var(--border)' }}>
        {['books', 'pq-vault'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2.5 text-xs font-semibold transition-colors relative"
            style={{ color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
          >
            {tab === 'books' ? 'Books & Resources' : 'Past Questions'}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
            )}
          </button>
        ))}
      </div>

      {activeTab === 'pq-vault' && <PastQuestionVault />}

      {activeTab === 'books' && (
        <div className="flex-1 overflow-y-auto px-4 pt-3 pb-8">
          {/* Department filter */}
          <div className="mb-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
            </div>
          ) : resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
              <BookOpen size={40} style={{ color: 'var(--text-tertiary)' }} />
              <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>No resources available</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Upload a PDF to get started</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {resources.map((resource) => (
                <div
                  key={resource._id}
                  className="flex flex-col rounded-xl p-4"
                  style={{ backgroundColor: 'var(--bg-secondary)' }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(0,149,246,0.15)' }}>
                      <FileText size={20} style={{ color: 'var(--accent)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate">{resource.title}</h3>
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{resource.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>{resource.department}</span>
                      <span className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        {format(new Date(resource.createdAt), 'MMM d')} · {resource.uploadedBy?.name}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleViewPdf(resource)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                        style={{ backgroundColor: 'var(--accent)', color: 'white' }}
                      >
                        <Eye size={13} className="inline mr-1" />
                        View
                      </button>
                      {(resource.uploadedBy?._id === user._id || user?.role === 'admin') && (
                        <button
                          onClick={() => handleDelete(resource._id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                          style={{ backgroundColor: 'rgba(237,73,86,0.15)', color: 'var(--danger)' }}
                        >
                          <Trash2 size={13} className="inline" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showPdfViewer && selectedPdfUrl && (
        <PDFViewer fileUrl={selectedPdfUrl} onClose={handleClosePdfViewer} />
      )}

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setError(''); }}
        title="Upload Resource"
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: 'rgba(237,73,86,0.1)', border: '1px solid var(--danger)' }}>
            <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}
        <form onSubmit={handleUpload} className="space-y-4">
          <Input
            label="Title"
            value={newResource.title}
            onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
            placeholder="Resource title"
            required
          />
          <Input
            label="Department"
            value={newResource.department}
            onChange={(e) => setNewResource({ ...newResource, department: e.target.value })}
            placeholder="e.g., Computer Science"
            required
          />
          <Textarea
            label="Description"
            value={newResource.description}
            onChange={(e) => setNewResource({ ...newResource, description: e.target.value })}
            placeholder="Brief description of the resource"
            rows={3}
          />
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>PDF File</label>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="w-full px-3 py-2 text-sm rounded-lg"
              style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            {newResource.file && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--success)' }}>Selected: {newResource.file.name}</p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => { setShowModal(false); setError(''); }} className="px-4 py-2 text-sm font-semibold rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              Cancel
            </button>
            <button type="submit" disabled={uploading} className="px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-1.5" style={{ backgroundColor: 'var(--accent)', color: 'white', opacity: uploading ? 0.5 : 1 }}>
              {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : 'Upload'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Library;
