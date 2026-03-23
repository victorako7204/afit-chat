import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { libraryAPI } from '../services/api';
import { format } from 'date-fns';
import { Button, Card, Input, Textarea, Modal } from '../components/UI';

const Library = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [filter, setFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newResource, setNewResource] = useState({
    title: '',
    description: '',
    department: '',
    file: null
  });
  const [error, setError] = useState('');

  const getPdfViewerUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return null;
    const encodedUrl = encodeURIComponent(trimmedUrl);
    return `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
  };

  const handleViewPdf = (resource) => {
    setSelectedPdf(resource);
    setShowPdfModal(true);
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

  const handleDownload = (url) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Library</h1>
          <p className="text-gray-500 mt-1">Access and share study materials</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload PDF
        </Button>
      </div>

      <div className="mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : resources.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="mt-4 text-gray-500">No resources available</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((resource) => (
            <Card key={resource._id} className="hover-lift">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{resource.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{resource.description}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-indigo-600 font-medium">{resource.department}</span>
                  <span className="text-gray-400">{format(new Date(resource.createdAt), 'MMM d')}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1 truncate">Uploaded by {resource.uploadedBy?.name}</p>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleViewPdf(resource)}
                >
                  View
                </Button>
                {(resource.uploadedBy?._id === user._id || user.role === 'admin') && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(resource._id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showPdfModal}
        onClose={() => {
          setShowPdfModal(false);
          setSelectedPdf(null);
        }}
        title={selectedPdf?.title || 'PDF Viewer'}
        size="xl"
      >
        {selectedPdf && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600">{selectedPdf.description}</p>
              <p className="text-xs text-gray-400 mt-2">
                {selectedPdf.department} · Uploaded by {selectedPdf.uploadedBy?.name}
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100" style={{ height: '70vh' }}>
              {(() => {
                const viewerUrl = getPdfViewerUrl(selectedPdf.fileUrl);
                if (!viewerUrl) {
                  return (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <p>Unable to load PDF. Please download instead.</p>
                    </div>
                  );
                }
                return (
                  <iframe
                    src={viewerUrl}
                    title={selectedPdf.title || 'PDF Viewer'}
                    className="w-full h-full"
                    style={{ minHeight: '60vh' }}
                    frameBorder="0"
                  />
                );
              })()}
            </div>
            <div className="flex justify-between items-center pt-2">
              <Button variant="secondary" size="sm" onClick={() => handleDownload(selectedPdf.fileUrl)}>
                Download PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowPdfModal(false); setSelectedPdf(null); }}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setError('');
        }}
        title="Upload Resource"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </>
        }
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <form onSubmit={handleUpload}>
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
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              PDF File
            </label>
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {newResource.file && (
              <p className="mt-2 text-sm text-green-600">Selected: {newResource.file.name}</p>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Library;
