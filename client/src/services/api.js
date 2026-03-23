import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 503 || status === 504) {
        console.warn('Server is waking up. Please try again in a moment.');
        error.userMessage = 'Server is waking up. Please try again in a moment.';
      } else if (status === 401) {
        console.warn('Session expired. Please login again.');
        error.userMessage = 'Session expired. Please login again.';
      } else if (status === 500) {
        console.error('Server error:', data?.message || 'Internal server error');
        error.userMessage = 'Something went wrong. Please try again.';
      } else {
        console.error('API Error:', data?.message || error.message);
        error.userMessage = data?.message || 'An error occurred.';
      }
    } else if (error.request) {
      console.error('Network error: No response from server');
      error.userMessage = 'Unable to connect to server. Please check your connection.';
    } else {
      console.error('Request error:', error.message);
      error.userMessage = 'An error occurred. Please try again.';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
  getUsers: () => api.get('/auth/users')
};

export const chatAPI = {
  getMessages: (chatId, limit = 20, skip = 0) => 
    api.get(`/chat/${chatId}?limit=${limit}&skip=${skip}`),
  sendMessage: (data) => api.post('/chat', data),
  sendAnonymousMessage: (data) => api.post('/chat/anonymous', data),
  deleteMessage: (id) => api.delete(`/chat/message/${id}`),
  clearChat: (chatId) => api.delete(`/chat/clear/${chatId}`),
  clearMessagesBefore: (chatId, timestamp) => 
    api.delete(`/chat/clear-before/${chatId}`, { data: { timestamp } })
};

export const lostAndFoundAPI = {
  getPosts: (status) => api.get(`/lost-and-found${status ? `?status=${status}` : ''}`),
  getMyPosts: () => api.get('/lost-and-found/my'),
  createPost: (data) => api.post('/lost-and-found', data),
  markAsFound: (id) => api.put(`/lost-and-found/${id}/found`),
  deletePost: (id) => api.delete(`/lost-and-found/${id}`)
};

export const libraryAPI = {
  getResources: (department) => api.get(`/library${department ? `?department=${department}` : ''}`),
  getDepartments: () => api.get('/library/departments'),
  uploadResource: (formData) => api.post('/library', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteResource: (id) => api.delete(`/library/${id}`)
};

export const groupAPI = {
  getGroups: () => api.get('/groups'),
  getMyGroups: () => api.get('/groups/my'),
  createGroup: (data) => api.post('/groups', data),
  joinGroup: (id) => api.put(`/groups/${id}/join`),
  joinByInvite: (inviteCode) => api.post('/groups/join-by-invite', { inviteCode }),
  leaveGroup: (id) => api.put(`/groups/${id}/leave`),
  deleteGroup: (id) => api.delete(`/groups/${id}`),
  toggleLock: (id) => api.put(`/groups/${id}/toggle-lock`),
  makeAdmin: (groupId, targetUserId) => api.put(`/groups/${groupId}/make-admin`, { targetUserId }),
  regenerateInviteCode: (id) => api.put(`/groups/${id}/regenerate-code`),
  updateGroup: (id, data) => api.put(`/groups/${id}`, data)
};

export const userAPI = {
  getAllUsers: () => api.get('/auth/users'),
  deleteUser: (id) => api.delete(`/auth/users/${id}`)
};

export const educationAPI = {
  getPublicModules: (params) => api.get('/education/public', { params }),
  getSubjects: () => api.get('/education/subjects'),
  getStats: () => api.get('/education/stats'),
  getModule: (id) => api.get(`/education/${id}`),
  generateModule: (topic) => api.post('/education/generate', { topic }),
  createModule: (data) => api.post('/education', data),
  updateModule: (id, data) => api.put(`/education/${id}`, data),
  deleteModule: (id) => api.delete(`/education/${id}`),
  toggleEnrollment: (id) => api.put(`/education/${id}/enroll`),
  getMyModules: () => api.get('/education/my'),
  getEnrolledModules: () => api.get('/education/enrolled'),
  verifyModule: (id) => api.put(`/education/${id}/verify`)
};

export default api;
