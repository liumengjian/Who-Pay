/**
 * WebSocket 服务封装
 * 使用 wx.connectSocket 直连自建服务器 WebSocket
 */
const { API_BASE_URL } = require('./config.js');

let socketTask = null;
let messageCallback = null;
let openCallback = null;
let closeCallback = null;
let errorCallback = null;

/**
 * 连接 WebSocket
 */
function connect() {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    if (!token) {
      reject(new Error('未登录'));
      return;
    }
    const wsUrl = API_BASE_URL.replace(/^https/, 'wss') + `/ws?token=${encodeURIComponent(token)}`;

    const task = wx.connectSocket({
      url: wsUrl,
      success: () => {
        socketTask = task;
        console.log('[WS] 连接中...');

        socketTask.onOpen(() => {
          console.log('[WS] 已打开');
          if (openCallback) openCallback();
        });

        socketTask.onMessage((res) => {
          try {
            const data = JSON.parse(res.data);
            if (messageCallback) messageCallback(data);
          } catch (e) {
            console.error('[WS] 解析消息失败', e);
          }
        });

        socketTask.onClose((res) => {
          console.log('[WS] 已关闭', res);
          socketTask = null;
          if (closeCallback) closeCallback(res);
        });

        socketTask.onError((res) => {
          console.error('[WS] 错误', res);
          if (errorCallback) errorCallback(res);
        });

        resolve(socketTask);
      },
      fail: (err) => {
        console.error('[WS] 连接失败', err);
        reject(err);
      }
    });
  });
}

/**
 * 发送消息
 */
function send(data) {
  if (socketTask) {
    return socketTask.send({ data: JSON.stringify(data) });
  }
  return Promise.reject('未连接');
}

/**
 * 关闭连接
 */
function close() {
  if (socketTask) {
    socketTask.close();
    socketTask = null;
  }
}

/**
 * 是否已连接
 */
function isConnected() {
  return socketTask !== null;
}

/**
 * 设置回调
 */
function onMessage(callback) {
  messageCallback = callback;
}

function onOpen(callback) {
  openCallback = callback;
}

function onClose(callback) {
  closeCallback = callback;
}

function onError(callback) {
  errorCallback = callback;
}

module.exports = {
  connect,
  send,
  close,
  isConnected,
  onMessage,
  onOpen,
  onClose,
  onError
};