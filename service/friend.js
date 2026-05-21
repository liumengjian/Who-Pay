const { callAPI } = require('../utils/cloud.js');

function getFriendList() {
  return callAPI('/api/friend/list', 'GET');
}

function getFriendRequests() {
  return callAPI('/api/friend/requests', 'GET');
}

function searchUsers(keyword) {
  return callAPI('/api/user/search', 'GET', { keyword });
}

function getUserProfile(targetId) {
  const id = encodeURIComponent(String(targetId));
  return callAPI(`/api/user/profile/${id}`, 'GET');
}

function addFriend(friendId, extra = {}) {
  return callAPI('/api/friend/add', 'POST', {
    friendId,
    verifyMessage: extra.verifyMessage,
    remark: extra.remark
  });
}

function handleFriendRequest(friendId, action) {
  return callAPI('/api/friend/handle', 'POST', { friendId, action });
}

function removeFriend(friendId) {
  return callAPI(`/api/friend/${friendId}`, 'DELETE');
}

function updateFriendRemark(friendId, remark) {
  return callAPI('/api/friend/remark', 'PUT', { friendId, remark });
}

function clearChatWithFriend(friendId) {
  return callAPI('/api/chat/clear', 'POST', { friendId });
}

function getChatList() {
  return callAPI('/api/chat/list', 'GET');
}

function getChatHistory(friendId, opts = {}) {
  const lim = opts.limit != null ? opts.limit : 30;
  const q = { friendId, limit: lim };
  if (opts.beforeId != null && opts.beforeId !== '') {
    q.beforeId = opts.beforeId;
  }
  return callAPI('/api/chat/history', 'GET', q);
}

function sendMessage(receiverId, content, type = 'text') {
  return callAPI('/api/message/send', 'POST', { receiverId, content, type });
}

function recallMessage(messageId) {
  return callAPI('/api/message/recall', 'POST', { messageId });
}

function getUnreadCount() {
  return callAPI('/api/chat/unread', 'GET');
}

module.exports = {
  getFriendList,
  getFriendRequests,
  searchUsers,
  getUserProfile,
  addFriend,
  handleFriendRequest,
  removeFriend,
  updateFriendRemark,
  clearChatWithFriend,
  getChatList,
  getChatHistory,
  sendMessage,
  recallMessage,
  getUnreadCount
};
