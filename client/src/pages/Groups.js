import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { groupAPI } from '../services/api';
import { Button, Card, Input, Textarea, Modal } from '../components/UI';

const Groups = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', department: '' });
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const [allGroups, myGroupsRes] = await Promise.all([
        groupAPI.getGroups(),
        groupAPI.getMyGroups()
      ]);
      setGroups(allGroups.data);
      setMyGroups(myGroupsRes.data);
    } catch (err) {
      // Silently handle error
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await groupAPI.createGroup(newGroup);
      setShowModal(false);
      setNewGroup({ name: '', description: '', department: '' });
      fetchGroups();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create group');
    }
  };

  const handleJoinGroup = async (groupId) => {
    setActionLoading(groupId);
    try {
      await groupAPI.joinGroup(groupId);
      fetchGroups();
    } catch (err) {
      // Silently handle error
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveGroup = async (groupId) => {
    setActionLoading(groupId);
    try {
      await groupAPI.leaveGroup(groupId);
      fetchGroups();
    } catch (err) {
      // Silently handle error
    } finally {
      setActionLoading(null);
    }
  };

  const isMember = (group) => {
    return group.members.some(m => m._id === user._id);
  };

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Department Groups</h1>
          <p className="text-gray-500 mt-1">Join groups to collaborate with peers</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Group
        </Button>
      </div>

      {myGroups.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">My Groups</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myGroups.map((group) => (
              <Link key={group._id} to={`/group/${group._id}`} className="block">
                <Card hover className="h-full border-l-4 border-l-purple-500">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{group.name}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{group.description}</p>
                      {group.department && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 mt-2">
                          {group.department}
                        </span>
                      )}
                    </div>
                    <div className="ml-4">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                    <span className="text-sm text-gray-500">{group.members.length} members</span>
                    <span className="text-sm font-medium text-purple-600">Open Chat</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-900 mb-4">All Groups</h2>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="mt-4 text-gray-500">No groups available yet</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card key={group._id} className="relative">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{group.name}</h3>
                {group.department && (
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                    {group.department}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{group.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{group.members.length} members</span>
                {isMember(group) ? (
                  <div className="flex items-center gap-2">
                    <Link to={`/group/${group._id}`}>
                      <Button size="sm" variant="primary">Open</Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleLeaveGroup(group._id)}
                      disabled={actionLoading === group._id}
                    >
                      Leave
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleJoinGroup(group._id)}
                    disabled={actionLoading === group._id}
                  >
                    Join
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Create New Group"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup}>Create Group</Button>
          </>
        }
      >
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <form onSubmit={handleCreateGroup}>
          <Input
            label="Group Name"
            value={newGroup.name}
            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
            placeholder="Engineering Students"
            required
          />
          <Input
            label="Department"
            value={newGroup.department}
            onChange={(e) => setNewGroup({ ...newGroup, department: e.target.value })}
            placeholder="Computer Science"
          />
          <Textarea
            label="Description"
            value={newGroup.description}
            onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
            placeholder="A group for..."
            rows={3}
          />
        </form>
      </Modal>
    </div>
  );
};

export default Groups;
