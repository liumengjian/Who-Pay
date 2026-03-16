// pages/payment/manage.js
const { getMyPayments, addPayment, updatePayment, deletePayment } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showSuccess, showError, formatAmount, formatDateTime, validateAmount } = require('../../utils/util.js');

Page({
  data: {
    activityId: '',
    payments: [],
    showModal: false,
    isEdit: false,
    editingIndex: -1,
    formAmount: '',
    formRemark: ''
  },

  onLoad(options) {
    const activityId = options.id;
    if (!activityId) {
      showError('活动ID不存在');
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    this.setData({
      activityId: activityId
    });

    this.loadPayments();
  },

  // 加载支付记录列表
  async loadPayments() {
    showLoading('加载中...');
    try {
      const result = await getMyPayments(this.data.activityId);
      const payments = (result.payments || []).map(p => ({
        ...p,
        amount: formatAmount(p.amount),
        createTime: formatDateTime(p.createTime)
      }));
      
      this.setData({
        payments: payments
      });
    } catch (error) {
      console.error('加载支付记录失败:', error);
      showError(error.message || '加载失败');
    } finally {
      hideLoading();
    }
  },

  // 显示添加弹窗
  showAddModal() {
    this.setData({
      showModal: true,
      isEdit: false,
      formAmount: '',
      formRemark: ''
    });
  },

  // 编辑支付记录
  editPayment(e) {
    const index = e.currentTarget.dataset.index;
    const payment = this.data.payments[index];
    
    this.setData({
      showModal: true,
      isEdit: true,
      editingIndex: index,
      formAmount: payment.amount,
      formRemark: payment.remark || ''
    });
  },

  // 删除支付记录
  deletePayment(e) {
    const paymentId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条支付记录吗？',
      success: async (res) => {
        if (res.confirm) {
          showLoading('删除中...');
          try {
            await deletePayment(paymentId);
            hideLoading();
            showSuccess('删除成功');
            // 刷新列表
            this.loadPayments();
          } catch (error) {
            hideLoading();
            console.error('删除支付记录失败:', error);
            showError(error.message || '删除失败');
          }
        }
      }
    });
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({
      showModal: false,
      isEdit: false,
      editingIndex: -1
    });
  },

  // 金额输入
  onAmountInput(e) {
    this.setData({
      formAmount: e.detail.value
    });
  },

  // 备注输入
  onRemarkInput(e) {
    this.setData({
      formRemark: e.detail.value
    });
  },

  // 提交表单
  async handleSubmit() {
    const { formAmount, formRemark, isEdit, editingIndex, payments } = this.data;
    
    const error = validateAmount(formAmount);
    if (error) {
      showError(error);
      return;
    }

    showLoading(isEdit ? '更新中...' : '添加中...');
    try {
      if (isEdit) {
        // 编辑
        const payment = payments[editingIndex];
        await updatePayment(payment._id, formAmount, formRemark);
        showSuccess('更新成功');
      } else {
        // 添加
        await addPayment(this.data.activityId, formAmount, formRemark);
        showSuccess('添加成功');
      }
      
      hideLoading();
      this.hideModal();
      // 刷新列表
      this.loadPayments();
    } catch (error) {
      hideLoading();
      console.error('操作失败:', error);
      showError(error.message || '操作失败');
    }
  },

  // 阻止事件冒泡
  stopPropagation() {}
});
