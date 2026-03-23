import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { chatAPI, userAPI } from '../services/api';
import { format } from 'date-fns';
import { Button, Card, Input } from '../components/UI';

const AdminPanel = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [chatId, setChatId] = useState('');
  const [clearDate, setClearDate] = useState('');
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  const fetchUsers = async () => {
    try {
      console.log('Fetching users from /auth/users...');
      const res = await userAPI.getAllUsers();
      console.log('Users fetched:', res.data);
      setUsers(res.data);
    } catch (err) {
      console.error('Error fetching users:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    setDeleting(userId);
    try {
      await userAPI.deleteUser(userId);
      fetchUsers();
      showMessage('User deleted successfully');
    } catch (err) {
      console.error('Error deleting user:', err);
      showMessage('Failed to delete user');
    } finally {
      setDeleting(null);
    }
  };

  const handleClearChat = async () => {
    if (!chatId) {
      showMessage('Please enter a chat ID');
      return;
    }
    try {
      await chatAPI.clearChat(chatId);
      showMessage('Chat cleared successfully');
      setChatId('');
    } catch (err) {
      showMessage('Failed to clear chat');
    }
  };

  const handleClearMessagesBefore = async () => {
    if (!chatId || !clearDate) {
      showMessage('Please enter chat ID and date');
      return;
    }
    try {
      const timestamp = new Date(clearDate).toISOString();
      await chatAPI.clearMessagesBefore(chatId, timestamp);
      showMessage('Messages cleared successfully');
      setClearDate('');
    } catch (err) {
      showMessage('Failed to clear messages');
    }
  };

  const showMessage = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <Card className="text-center py-12 bg-red-50 border-red-200">
          <svg className="w-12 h-12 mx-auto text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="mt-4 text-xl font-semibold text-red-900">Access Denied</h2>
          <p className="mt-2 text-red-700">You must be an admin to access this page.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-500 mt-1">Manage users and moderate content</p>
      </div>

      {message && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
          <p className="text-sm text-blue-700">{message}</p>
          <button onClick={() => setMessage('')} className="text-blue-700 hover:text-blue-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Manage Users
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'chat' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Chat Control
        </button>
      </div>

      {activeTab === 'users' && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">All Users</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Matric No</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-4 border-blue-600 border-t-transparent" />
                      </div>
                    </td>
                  </tr>
                ) : users.map((u) => (
                  <tr key={u._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-gray-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{u.matricNo}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {format(new Date(u.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      {u._id !== user._id && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDeleteUser(u._id)}
                          disabled={deleting === u._id}
                        >
                          {deleting === u._id ? 'Deleting...' : 'Delete'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Clear All Messages</h3>
            <div className="space-y-4">
              <Input
                label="Chat ID"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g., public-chat"
              />
              <Button variant="danger" className="w-full" onClick={handleClearChat}>
                Clear All Messages
              </Button>
            </div>
          </Card>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Clear Messages Before Date</h3>
            <div className="space-y-4">
              <Input
                label="Chat ID"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g., public-chat"
              />
              <Input
                label="Date & Time"
                type="datetime-local"
                value={clearDate}
                onChange={(e) => setClearDate(e.target.value)}
              />
              <Button variant="danger" className="w-full bg-orange-600 hover:bg-orange-700" onClick={handleClearMessagesBefore}>
                Clear Messages Before Date
              </Button>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <h3 className="font-semibold text-gray-900 mb-4">Common Chat IDs</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: 'Public Chat', id: 'public-chat' },
                { name: 'Anonymous', id: 'anonymous-chat' },
                { name: 'Group', id: 'group-xxx' },
                { name: 'Direct Message', id: 'dm-user1-user2' }
              ].map((item) => (
                <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500 font-mono mt-1">{item.id}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
