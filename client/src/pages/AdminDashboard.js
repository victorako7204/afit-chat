/* eslint-disable */
import React, { useState, useEffect, useContext } from 'react';
import { useAuth } from '../context/AuthContext';
import { ThemeContext } from '../App';
import { Card, Button, Input, Modal } from '../components/UI';
import { Search, Shield, UserX, UserCheck, AlertTriangle, Users, Filter, RefreshCw } from 'lucide-react';
import axios from 'axios';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { darkMode } = useContext(ThemeContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0, restricted: 0 });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/admin/users`, {
        params: { limit: 100 }
      });
      setUsers(res.data.users || []);
      calculateStats(res.data.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch users';
      setError(errorMsg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (userList) => {
    setStats({
      total: userList.length,
      active: userList.filter(u => u.status === 'active').length,
      suspended: userList.filter(u => u.status === 'suspended').length,
      restricted: userList.filter(u => u.status === 'restricted').length
    });
  };

  const handleStatusChange = async (userId, newStatus, reason = null) => {
    setActionLoading(true);
    try {
      await axios.patch(`${process.env.REACT_APP_API_URL}/admin/user-status`, {
        targetUserId: userId,
        newStatus,
        reason
      });
      
      setUsers(prev => prev.map(u => {
        if (u._id === userId) {
          return { ...u, status: newStatus, suspensionReason: reason };
        }
        return u;
      }));
      calculateStats(users);
      
      setShowSuspendModal(false);
      setSelectedUser(null);
      setSuspendReason('');
    } catch (err) {
      alert('Failed to update user: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setActionLoading(true);
    try {
      await axios.patch(`${process.env.REACT_APP_API_URL}/admin/user-role`, {
        targetUserId: userId,
        newRole
      });
      
      setUsers(prev => prev.map(u => {
        if (u._id === userId) {
          return { ...u, role: newRole };
        }
        return u;
      }));
    } catch (err) {
      alert('Failed to update role: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.matricNo?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || u.status === filterStatus;
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>;
      case 'suspended':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Suspended</span>;
      case 'restricted':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Restricted</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Admin</span>;
      case 'moderator':
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Moderator</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Student</span>;
    }
  };

  if (user?.role !== 'admin' && user?.role !== 'moderator') {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Shield className={`w-16 h-16 mx-auto mb-4 ${darkMode ? 'text-red-400' : 'text-red-500'}`} />
        <h2 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Access Denied
        </h2>
        <p className={`${darkMode ? 'text-slate-400' : 'text-gray-600'}`}>
          You do not have permission to access the Admin Dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            Admin Control Panel
          </h1>
          <p className={`text-sm mt-1 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
            Manage users, roles, and account statuses
          </p>
        </div>
        <Button onClick={fetchUsers} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="p-4" className={darkMode ? 'bg-slate-800/50' : 'bg-white'}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <Users className={`w-5 h-5 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{stats.total}</p>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Total Users</p>
            </div>
          </div>
        </Card>

        <Card padding="p-4" className={darkMode ? 'bg-slate-800/50' : 'bg-white'}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-green-500/20' : 'bg-green-100'}`}>
              <UserCheck className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{stats.active}</p>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Active</p>
            </div>
          </div>
        </Card>

        <Card padding="p-4" className={darkMode ? 'bg-slate-800/50' : 'bg-white'}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-red-500/20' : 'bg-red-100'}`}>
              <UserX className={`w-5 h-5 ${darkMode ? 'text-red-400' : 'text-red-600'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{stats.suspended}</p>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Suspended</p>
            </div>
          </div>
        </Card>

        <Card padding="p-4" className={darkMode ? 'bg-slate-800/50' : 'bg-white'}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${darkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'}`}>
              <AlertTriangle className={`w-5 h-5 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>{stats.restricted}</p>
              <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Restricted</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding="p-4" className={darkMode ? 'bg-slate-800/50' : 'bg-white'}>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-slate-400' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="Search by name, email, or matric number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${
                darkMode 
                  ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' 
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`px-3 py-2 rounded-lg border ${
                darkMode 
                  ? 'bg-slate-900 border-slate-700 text-white' 
                  : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="restricted">Restricted</option>
            </select>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className={`px-3 py-2 rounded-lg border ${
                darkMode 
                  ? 'bg-slate-900 border-slate-700 text-white' 
                  : 'bg-gray-50 border-gray-200 text-gray-900'
              }`}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="student">Student</option>
            </select>
          </div>
        </div>

        {error && (
          <div className={`p-4 rounded-lg mb-4 flex items-center gap-2 ${
            darkMode 
              ? 'bg-red-500/20 border border-red-500/50 text-red-400' 
              : 'bg-red-100 border border-red-300 text-red-700'
          }`}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mx-auto" />
            <p className={`mt-2 ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={darkMode ? 'border-slate-700' : 'border-gray-200'}>
                  <th className={`text-left px-4 py-3 text-xs font-semibold uppercase ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>User</th>
                  <th className={`text-left px-4 py-3 text-xs font-semibold uppercase ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Matric No</th>
                  <th className={`text-left px-4 py-3 text-xs font-semibold uppercase ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Status</th>
                  <th className={`text-left px-4 py-3 text-xs font-semibold uppercase ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Role</th>
                  <th className={`text-left px-4 py-3 text-xs font-semibold uppercase ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                      No users found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(u => (
                    <tr key={u._id} className={`${darkMode ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm ${
                            u.role === 'admin' ? 'bg-purple-600' : u.role === 'moderator' ? 'bg-blue-600' : 'bg-gray-600'
                          }`}>
                            {u.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{u.name}</p>
                            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`px-4 py-3 font-mono text-sm ${darkMode ? 'text-slate-300' : 'text-gray-600'}`}>
                        {u.matricNo || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(u.status)}
                        {u.suspensionReason && (
                          <p className={`text-xs mt-1 ${darkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                            Reason: {u.suspensionReason}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {getRoleBadge(u.role)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {u.status !== 'active' && (
                            <button
                              onClick={() => handleStatusChange(u._id, 'active')}
                              disabled={actionLoading}
                              className={`p-1.5 rounded-lg transition-colors ${
                                darkMode 
                                  ? 'bg-green-500/20 hover:bg-green-500/40 text-green-400' 
                                  : 'bg-green-100 hover:bg-green-200 text-green-600'
                              }`}
                              title="Activate"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}
                          {u.status !== 'suspended' && (
                            <button
                              onClick={() => { setSelectedUser(u); setShowSuspendModal(true); }}
                              disabled={actionLoading}
                              className={`p-1.5 rounded-lg transition-colors ${
                                darkMode 
                                  ? 'bg-red-500/20 hover:bg-red-500/40 text-red-400' 
                                  : 'bg-red-100 hover:bg-red-200 text-red-600'
                              }`}
                              title="Suspend"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                          {u.status !== 'restricted' && (
                            <button
                              onClick={() => handleStatusChange(u._id, 'restricted')}
                              disabled={actionLoading}
                              className={`p-1.5 rounded-lg transition-colors ${
                                darkMode 
                                  ? 'bg-yellow-500/20 hover:bg-yellow-500/40 text-yellow-400' 
                                  : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-600'
                              }`}
                              title="Restrict"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          )}
                          {user?._id !== u._id && (
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u._id, e.target.value)}
                              className={`px-2 py-1 text-xs rounded-lg border ${
                                darkMode 
                                  ? 'bg-slate-900 border-slate-600 text-white' 
                                  : 'bg-white border-gray-300 text-gray-700'
                              }`}
                            >
                              <option value="student">Student</option>
                              <option value="moderator">Moderator</option>
                              {user?.role === 'admin' && <option value="admin">Admin</option>}
                            </select>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showSuspendModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-2xl p-6 ${darkMode ? 'bg-slate-800' : 'bg-white'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-500/20 rounded-lg">
                <UserX className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                  Suspend User
                </h3>
                <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                  {selectedUser.name}
                </p>
              </div>
            </div>
            
            <div className="mb-4">
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-gray-700'}`}>
                Reason for suspension (optional)
              </label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Enter reason for suspension..."
                rows={3}
                className={`w-full px-3 py-2 rounded-lg border resize-none ${
                  darkMode 
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' 
                    : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                }`}
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setShowSuspendModal(false); setSelectedUser(null); setSuspendReason(''); }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleStatusChange(selectedUser._id, 'suspended', suspendReason)}
                disabled={actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {actionLoading ? 'Suspending...' : 'Suspend User'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
