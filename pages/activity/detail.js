// pages/activity/detail.js
const { 
  getActivityDetail, 
  addPayment, 
  endActivity, 
  getMemberPayments,
  selectTeam
} = require('../../utils/cloud.js');
const { 
  showLoading, 
  hideLoading, 
  showSuccess, 
  showError, 
  copyToClipboard,
  formatAmount,
  formatDateTime,
  validateAmount
} = require('../../utils/util.js');

Page({
  data: {
    activityId: '',
    activityInfo: {},
    teams: [
      { team: 'A', totalAmount: '0.00', diffAmount: 0, members: [] },
      { team: 'B', totalAmount: '0.00', diffAmount: 0, members: [] },
      { team: 'C', totalAmount: '0.00', diffAmount: 0, members: [] }
    ],
    totalAmount: '0.00',
    shareAmount: '0.00',
    isCreator: false,
    isEnded: false,
    showTeamSelect: false,
    showAddPayment: false,
    showMemberPayments: false,
    paymentAmount: '',
    paymentRemark: '',
    selectedMemberId: '',
    selectedMemberName: '',
    memberPayments: [],
    needSelectTeam: false
  },

  onLoad(options) {
    const activityId = options.id;
    const needSelectTeam = options.needSelectTeam === 'true';
    
    if (!activityId) {
      showError('活动ID不存在');
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      return;
    }

    this.setData({
      activityId: activityId,
      needSelectTeam: needSelectTeam
    });

    this.loadActivityDetail();
  },

  onShow() {
    // 每次显示时刷新数据
    if (this.data.activityId) {
      this.loadActivityDetail();
    }
  },

  // 加载活动详情
  async loadActivityDetail() {
    showLoading('加载中...');
    try {
      const result = await getActivityDetail(this.data.activityId);
      
      if (!result || !result.activityInfo) {
        throw new Error('活动不存在');
      }

      const activityInfo = result.activityInfo;
      const openid = wx.getStorageSync('openid');
      const isCreator = activityInfo.creatorId === openid;
      const isEnded = activityInfo.status === 'ended';

      // 计算总花费和均摊额
      const totalAmount = parseFloat(result.totalAmount || 0);
      const shareAmount = totalAmount / 3;

      // 处理团队数据
      const teams = ['A', 'B', 'C'].map(team => {
        const teamData = result.teams.find(t => t.team === team) || {
          team: team,
          totalAmount: 0,
          members: []
        };
        
        const teamTotal = parseFloat(teamData.totalAmount || 0);
        const diffAmount = teamTotal - shareAmount;

        return {
          team: team,
          totalAmount: formatAmount(teamTotal),
          diffAmount: parseFloat(diffAmount.toFixed(2)),
          members: teamData.members || []
        };
      });

      this.setData({
        activityInfo: activityInfo,
        teams: teams,
        totalAmount: formatAmount(totalAmount),
        shareAmount: formatAmount(shareAmount),
        isCreator: isCreator,
        isEnded: isEnded
      });

      // 如果需要选择团队，显示选择弹窗
      if (this.data.needSelectTeam && !isEnded) {
        // 检查用户是否已加入
        let userJoined = false;
        teams.forEach(team => {
          if (team.members.some(m => m.userId === openid)) {
            userJoined = true;
          }
        });

        if (!userJoined) {
          this.setData({
            showTeamSelect: true
          });
        }
      }
    } catch (error) {
      console.error('加载活动详情失败:', error);
      showError(error.message || '加载失败');
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } finally {
      hideLoading();
    }
  },

  // 复制邀请码
  async copyInviteCode() {
    const inviteCode = this.data.activityInfo.inviteCode;
    if (inviteCode) {
      await copyToClipboard(inviteCode);
    }
  },

  // 显示添加支付记录弹窗
  showAddPaymentModal() {
    if (this.data.isEnded) {
      showError('活动已结束');
      return;
    }
    this.setData({
      showAddPayment: true,
      paymentAmount: '',
      paymentRemark: ''
    });
  },

  // 隐藏添加支付记录弹窗
  hideAddPaymentModal() {
    this.setData({
      showAddPayment: false
    });
  },

  // 支付金额输入
  onPaymentAmountInput(e) {
    this.setData({
      paymentAmount: e.detail.value
    });
  },

  // 支付备注输入
  onPaymentRemarkInput(e) {
    this.setData({
      paymentRemark: e.detail.value
    });
  },

  // 添加支付记录
  async handleAddPayment() {
    const { paymentAmount, paymentRemark } = this.data;
    const error = validateAmount(paymentAmount);
    if (error) {
      showError(error);
      return;
    }

    showLoading('添加中...');
    try {
      await addPayment(this.data.activityId, paymentAmount, paymentRemark);
      hideLoading();
      showSuccess('添加成功');
      this.hideAddPaymentModal();
      // 刷新活动详情
      this.loadActivityDetail();
    } catch (error) {
      hideLoading();
      console.error('添加支付记录失败:', error);
      showError(error.message || '添加失败');
    }
  },

  // 查看成员支付记录
  async viewMemberPayments(e) {
    const userId = e.currentTarget.dataset.userid;
    const member = this.findMember(userId);
    if (!member) return;

    showLoading('加载中...');
    try {
      const result = await getMemberPayments(this.data.activityId, userId);
      const payments = (result.payments || []).map(p => ({
        ...p,
        createTime: formatDateTime(p.createTime)
      }));

      this.setData({
        showMemberPayments: true,
        selectedMemberId: userId,
        selectedMemberName: member.nickName,
        memberPayments: payments
      });
    } catch (error) {
      console.error('加载支付记录失败:', error);
      showError(error.message || '加载失败');
    } finally {
      hideLoading();
    }
  },

  // 隐藏成员支付记录弹窗
  hideMemberPayments() {
    this.setData({
      showMemberPayments: false
    });
  },

  // 查找成员信息
  findMember(userId) {
    for (const team of this.data.teams) {
      const member = team.members.find(m => m.userId === userId);
      if (member) return member;
    }
    return null;
  },

  // 显示团队选择弹窗
  showTeamSelectModal() {
    this.setData({
      showTeamSelect: true
    });
  },

  // 隐藏团队选择弹窗
  hideTeamSelect() {
    this.setData({
      showTeamSelect: false,
      needSelectTeam: false
    });
  },

  // 选择团队
  async selectTeam(e) {
    const team = e.currentTarget.dataset.team;
    const teamData = this.data.teams.find(t => t.team === team);
    
    if (teamData.members.length >= 3) {
      showError('该团队已满');
      return;
    }

    showLoading('加入中...');
    try {
      await selectTeam(this.data.activityId, team);
      hideLoading();
      showSuccess('加入成功');
      this.hideTeamSelect();
      // 刷新活动详情
      this.loadActivityDetail();
    } catch (error) {
      hideLoading();
      console.error('加入团队失败:', error);
      showError(error.message || '加入失败');
    }
  },

  // 结束活动
  handleEndActivity() {
    if (!this.data.isCreator) {
      showError('只有创建人可以结束活动');
      return;
    }

    wx.showModal({
      title: '确认结束',
      content: '结束活动后，所有成员将无法再添加或修改支付记录，确定要结束吗？',
      success: async (res) => {
        if (res.confirm) {
          showLoading('结束中...');
          try {
            await endActivity(this.data.activityId);
            hideLoading();
            showSuccess('活动已结束');
            // 刷新活动详情
            this.loadActivityDetail();
          } catch (error) {
            hideLoading();
            console.error('结束活动失败:', error);
            showError(error.message || '结束失败');
          }
        }
      }
    });
  },

  // 阻止事件冒泡
  stopPropagation() {}
});
