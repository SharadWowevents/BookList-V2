const API_BASE = '/api';

export const getToken = () => {
  try {
    return localStorage.getItem('listbook:token') || null;
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem('listbook:token', token);
    else localStorage.removeItem('listbook:token');
  } catch {}
};

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const errorMsg = (data && data.message) || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const authAPI = {
  pinLogin: (name, pin) => request('/auth/pin-login', {
    method: 'POST',
    body: JSON.stringify({ name, pin })
  }),
  teamLogin: (username, password) => request('/auth/team-login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  getMe: () => request('/auth/me'),
  updateProfile: (profileData) => request('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(profileData)
  })
};

export const boardAPI = {
  getBoard: () => request('/board'),
  syncBoard: (boardData) => request('/board', {
    method: 'PUT',
    body: JSON.stringify(boardData)
  }),
  createList: (listData) => request('/board/lists', {
    method: 'POST',
    body: JSON.stringify(listData)
  }),
  updateList: (id, listData) => request('/board/lists/' + id, {
    method: 'PUT',
    body: JSON.stringify(listData)
  }),
  deleteList: (id) => request('/board/lists/' + id, {
    method: 'DELETE'
  })
};

export const notesAPI = {
  getNote: (id) => request('/notes/' + id),
  createNote: (noteData) => request('/notes', {
    method: 'POST',
    body: JSON.stringify(noteData)
  }),
  updateNote: (id, noteData) => request('/notes/' + id, {
    method: 'PUT',
    body: JSON.stringify(noteData)
  }),
  deleteNote: (id) => request('/notes/' + id, {
    method: 'DELETE'
  })
};

export const sharesAPI = {
  createShare: (shareData) => request('/shares', {
    method: 'POST',
    body: JSON.stringify(shareData)
  }),
  getShare: (sid) => request('/shares/' + sid),
  updateShare: (sid, shareData) => request('/shares/' + sid, {
    method: 'PUT',
    body: JSON.stringify(shareData)
  }),
  deleteShare: (sid) => request('/shares/' + sid, {
    method: 'DELETE'
  })
};

export const adminAPI = {
  getConfig: () => request('/admin/config'),
  updateConfig: (configData) => request('/admin/config', {
    method: 'PUT',
    body: JSON.stringify(configData)
  }),
  getUsers: () => request('/admin/users'),
  createUser: (userData) => request('/admin/users', {
    method: 'POST',
    body: JSON.stringify(userData)
  }),
  renameUser: (username, data) => request('/admin/users/' + encodeURIComponent(username) + '/rename', {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  toggleUserStatus: (username) => request('/admin/users/' + username + '/status', {
    method: 'PUT'
  }),
  resetPassword: (username, password) => request('/admin/users/' + username + '/reset-password', {
    method: 'PUT',
    body: JSON.stringify({ password })
  }),
  deleteUser: (username) => request('/admin/users/' + username, {
    method: 'DELETE'
  }),
  toggleUserCrm: (username) => request('/admin/users/' + encodeURIComponent(username) + '/crm', {
    method: 'PUT'
  })
};

export const crmAPI = {
  getMembers: () => request('/crm/members'),
  getMember: (id) => request('/crm/members/' + encodeURIComponent(id)),
  createMember: (memberData) => request('/crm/members', {
    method: 'POST',
    body: JSON.stringify(memberData)
  }),
  updateMember: (id, memberData) => request('/crm/members/' + encodeURIComponent(id), {
    method: 'PUT',
    body: JSON.stringify(memberData)
  }),
  deleteMember: (id) => request('/crm/members/' + encodeURIComponent(id), {
    method: 'DELETE'
  }),
  getSessions: (memberId) => request('/crm/members/' + encodeURIComponent(memberId) + '/sessions'),
  addSession: (memberId, sessionData) => request('/crm/members/' + encodeURIComponent(memberId) + '/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData)
  }),
  updateSession: (memberId, sessionId, sessionData) => request('/crm/members/' + encodeURIComponent(memberId) + '/sessions/' + encodeURIComponent(sessionId), {
    method: 'PUT',
    body: JSON.stringify(sessionData)
  }),
  deleteSession: (memberId, sessionId) => request('/crm/members/' + encodeURIComponent(memberId) + '/sessions/' + encodeURIComponent(sessionId), {
    method: 'DELETE'
  })
};

