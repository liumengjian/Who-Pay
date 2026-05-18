/**
 * WebSocket 服务封装
 * 使用 wx.cloud.connectContainer 连接云托管 WebSocket
 */
const { CLOUD_ENV, CLOUD_SERVICE } = require('./config.js');

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
    wx.cloud.connectContainer({
      env: CLOUD_ENV,
      service: CLOUD_SERVICE,
      path: `/ws?token=${encodeURIComponent(token)}`,
      success: (res) => {
        socketTask = res.socketTask;
        console.log('[WS] 连接成功');

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