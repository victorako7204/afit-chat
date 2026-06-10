import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:10000/api/v1';

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401 && data?.error?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(() => api(originalRequest));
        }
        originalRequest._retry = true;
        isRefreshing = true;
        try {
          await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
          processQueue(null);
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError);
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
      if (status === 401) {
        const code = data?.error?.code;
        if (code === 'TOKEN_INVALID' || code === 'NO_TOKEN' || code === 'TOKEN_REUSE') {
          window.location.href = '/login';
        }
      }
      if (status === 403) {
        window.location.href = '/login';
      }
      if (status === 429) {
        const retryAfter = error.response.headers?.['retry-after'];
        error.userMessage = retryAfter
          ? `Too many attempts. Please wait ${retryAfter} seconds.`
          : 'Too many attempts. Please wait.';
      }
      if (status === 503 || status === 504) {
        const maxRetries = 3;
        const retryCount = originalRequest._retryCount || 0;
        if (retryCount < maxRetries) {
          originalRequest._retryCount = retryCount + 1;
          const delay = Math.pow(2, retryCount + 1) * 1000;
          await new Promise(r => setTimeout(r, delay));
          return api(originalRequest);
        }
        error.userMessage = 'Server is waking up. Please try again.';
      }
      if (data?.error?.message) {
        error.userMessage = data.error.message;
      } else {
        error.userMessage = data?.message || 'Something went wrong.';
      }
    } else if (error.request) {
      error.userMessage = 'Connection lost. Retrying...';
    } else {
      error.userMessage = 'An error occurred. Please try again.';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  getUsers: () => api.get('/auth/users'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) => api.post('/auth/reset-password', { token, newPassword })
};

export const postsAPI = {
  getPosts: (params) => api.get('/posts', { params }),
  createPost: (data) => api.post('/posts', data),
  getPost: (id) => api.get(`/posts/${id}`),
  editPost: (id, content) => api.put(`/posts/${id}`, { content }),
  likePost: (id) => api.post(`/posts/${id}/like`),
  commentPost: (id, content, isAnonymous) => api.post(`/posts/${id}/comments`, { content, isAnonymous }),
  getComments: (id, params) => api.get(`/posts/${id}/comments`, { params }),
  deleteComment: (postId, commentId) => api.delete(`/posts/${postId}/comments/${commentId}`),
  deletePost: (id) => api.delete(`/posts/${id}`)
};

export const chatAPI = {
  getMessages: (chatId, limit = 50, skip = 0, before) => {
    let url = `/chat/${chatId}/messages?limit=${limit}`;
    if (before) url += `&before=${before}`;
    else url += `&skip=${skip}`;
    return api.get(url);
  },
  getPrivateMessages: (targetUserId, limit = 50) =>
    api.get(`/chat/private/${targetUserId}?limit=${limit}`),
  sendMessage: (data) => api.post('/chat', data),
  sendAnonymousMessage: (data) => api.post('/chat/anonymous', data),
  deleteMessage: (id) => api.delete(`/chat/message/${id}`),
  clearChat: (chatId) => api.delete(`/chat/clear/${chatId}`),
  clearMessagesBefore: (chatId, timestamp) =>
    api.delete(`/chat/clear-before/${chatId}`, { data: { timestamp } }),
  clearUnread: (chatId) => api.put(`/chat/unread/clear/${chatId}`).catch(() => ({ message: 'ignored' })),
  getUnreadCount: () => api.get('/chat/unread/count').then(r => r.data).catch(() => ({ unreadCount: 0 })),
  getConversations: () => api.get('/chat/conversations'),
  markRead: (chatId) => api.put(`/chat/${chatId}/read`),
  editMessage: (messageId, message) => api.put(`/chat/messages/${messageId}`, { message })
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
  getGroup: (id) => api.get(`/groups/${id}`),
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
  generateModule: (data, options) => api.post('/lessons/generate', data, options),
  createModule: (data) => api.post('/education', data),
  updateModule: (id, data) => api.put(`/education/${id}`, data),
  deleteModule: (id) => api.delete(`/education/${id}`),
  toggleEnrollment: (id) => api.put(`/education/${id}/enroll`),
  getMyModules: () => api.get('/education/my'),
  getEnrolledModules: () => api.get('/education/enrolled'),
  verifyModule: (id) => api.put(`/education/${id}/verify`)
};

export const quizAPI = {
  getQuestions: (courseCode, limit = 10) =>
    api.get('/questions', { params: { courseCode, limit } })
};

export const gameAPI = {
  getLeaderboard: () => api.get('/games/leaderboard'),
  createGame: () => api.post('/games/create'),
  getGame: (id) => api.get(`/games/${id}`),
  getMyGames: () => api.get('/games/my'),
  getWaitingGames: () => api.get('/games/waiting'),
  makeMove: (gameId, data) => api.post(`/games/${gameId}/move`, data),
  endGame: (gameId, data) => api.post(`/games/${gameId}/end`, data)
};

export const leaderboardAPI = {
  get: () => api.get('/leaderboard'),
  getStats: () => api.get('/leaderboard/stats')
};

export const notificationAPI = {
  get: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  subscribe: (data) => api.post('/notifications/subscribe', data),
  unsubscribe: () => api.delete('/notifications/unsubscribe')
};

export const pastQuestionFileAPI = {
  upload: (formData) => api.post('/past-questions/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  list: (courseCode) => api.get(`/past-questions${courseCode ? `?courseCode=${courseCode}` : ''}`)
};

export const adminAPI = {
  updateUserStatus: (data) => api.patch('/admin/user-status', data),
  updateUserRole: (data) => api.patch('/admin/user-role', data),
  getUsers: (params) => api.get('/admin/users', { params }),
  getUser: (id) => api.get(`/admin/user/${id}`)
};

export default api;
