import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { lostAndFoundAPI } from '../services/api';
import { format } from 'date-fns';
import { Button, Card, Input, Textarea, Select, Modal } from '../components/UI';

const LostAndFound = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState('');
  const [newPost, setNewPost] = useState({
    title: '',
    description: '',
    location: '',
    status: 'lost',
    contact: ''
  });
  const [error, setError] = useState('');

  const fetchPosts = useCallback(async () => {
    try {
      const res = await lostAndFoundAPI.getPosts(filter);
      setPosts(res.data);
    } catch (err) {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await lostAndFoundAPI.createPost(newPost);
      setShowModal(false);
      setNewPost({ title: '', description: '', location: '', status: 'lost', contact: '' });
      fetchPosts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create post');
    }
  };

  const handleMarkAsFound = async (postId) => {
    try {
      await lostAndFoundAPI.markAsFound(postId);
      fetchPosts();
    } catch (err) {
      // Silently handle error
    }
  };

  const handleDelete = async (postId) => {
    try {
      await lostAndFoundAPI.deletePost(postId);
      fetchPosts();
    } catch (err) {
      // Silently handle error
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lost & Found</h1>
          <p className="text-gray-500 mt-1">Report and find lost items on campus</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Report Item
        </Button>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setFilter('')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filter === '' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('lost')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filter === 'lost' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Lost
        </button>
        <button
          onClick={() => setFilter('found')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filter === 'found' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Found
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : posts.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="mt-4 text-gray-500">No items found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => (
            <Card key={post._id} className={`relative ${post.status === 'found' ? 'opacity-60' : ''}`}>
              <div className="absolute top-4 right-4">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    post.status === 'lost' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                </span>
              </div>

              <div className="pr-16">
                <h3 className="font-semibold text-gray-900 mb-2">{post.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{post.description}</p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-500">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {post.location}
                  </div>
                  {post.contact && (
                    <div className="flex items-center text-gray-500">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {post.contact}
                    </div>
                  )}
                  <div className="flex items-center text-gray-400 text-xs">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {post.userId?.name} · {format(new Date(post.createdAt), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>

              {post.userId?._id === user._id && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  {post.status === 'lost' && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleMarkAsFound(post._id)}
                    >
                      Mark Found
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(post._id)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Report Lost or Found Item"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreatePost}>Submit Report</Button>
          </>
        }
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <form onSubmit={handleCreatePost}>
          <Select
            label="Status"
            value={newPost.status}
            onChange={(e) => setNewPost({ ...newPost, status: e.target.value })}
          >
            <option value="lost">Lost</option>
            <option value="found">Found</option>
          </Select>
          <Input
            label="Title"
            value={newPost.title}
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
            placeholder="Item name"
            required
          />
          <Textarea
            label="Description"
            value={newPost.description}
            onChange={(e) => setNewPost({ ...newPost, description: e.target.value })}
            placeholder="Describe the item..."
            rows={3}
            required
          />
          <Input
            label="Location"
            value={newPost.location}
            onChange={(e) => setNewPost({ ...newPost, location: e.target.value })}
            placeholder="Where was it lost/found?"
            required
          />
          <Input
            label="Contact Info (optional)"
            value={newPost.contact}
            onChange={(e) => setNewPost({ ...newPost, contact: e.target.value })}
            placeholder="Phone number or email"
          />
        </form>
      </Modal>
    </div>
  );
};

export default LostAndFound;
