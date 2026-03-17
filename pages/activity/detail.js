// pages/activity/detail.js
const { 
  getActivityDetail, 
  addPayment, 
  endActivity, 
  getMemberPayments,
  createTeam,
  joinTeam
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
    teams: [],
    totalAmount: '0.00',
    shareAmount: '0.00',
    myTeam: null, // 当前用户所在的团队
    myTeamDiff: 0, // 我的团队需要支付/收款的金额
    myPersonalDiff: 0, // 我个人需要支付/收款的金额
    isCreator: false,
    isEnded: false,
    showTeamSelect: false,
    showCreateTeam: false,
    showAddPayment: false,
    showMemberPayments: false,
    paymentAmount: '',
    paymentRemark: '',
    teamName: '',
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

      // 获取团队列表（动态，不固定）
      const teamsData = result.teams || [];
      const teamCount = teamsData.length || 1; // 至少1个团队
      
      // 计算总花费和团队均摊额
      const totalAmount = parseFloat(result.totalAmount || 0);
      const shareAmount = teamCount > 0 ? totalAmount / teamCount : 0;

      // 处理团队数据
      const teams = teamsData.map(teamData => {
        const teamTotal = parseFloat(teamData.totalAmount || 0);
        const diffAmount = teamTotal - shareAmount; // 团队差额（正数表示应收，负数表示应付）
        const memberCount = (teamData.members || []).length || 1;
        const memberShareAmount = memberCount > 0 ? Math.abs(diffAmount) / memberCount : 0; // 团队成员均摊金额

        return {
          _id: teamData._id || teamData.id,
          name: teamData.name || teamData.teamName || '未命名团队',
          totalAmount: formatAmount(teamTotal),
          diffAmount: parseFloat(diffAmount.toFixed(2)),
          memberCount: memberCount,
          memberShareAmount: formatAmount(memberShareAmount),
          members: (teamData.members || []).map(m => ({
            ...m,
            totalAmount: formatAmount(m.totalAmount || 0)
          }))
        };
      });

      // 查找当前用户所在的团队
      let myTeam = null;
      let myTeamDiff = 0;
      let myPersonalDiff = 0;
      
      for (const team of teams) {
        const member = team.members.find(m => m.userId === openid);
        if (member) {
          myTeam = team;
          myTeamDiff = team.diffAmount;
          // 计算个人需要支付/收款的金额
          // 如果团队需要付40，团队有2个人，每人需要付20
          if (team.diffAmount < 0) {
            // 团队需要付款，个人需要付的金额 = 团队应付金额 / 成员数
            myPersonalDiff = parseFloat((Math.abs(team.diffAmount) / team.memberCount).toFixed(2));
          } else if (team.diffAmount > 0) {
            // 团队可以收款，个人可以收的金额 = 团队应收金额 / 成员数
            myPersonalDiff = parseFloat((team.diffAmount / team.memberCount).toFixed(2));
          }
          break;
        }
      }

      this.setData({
        activityInfo: activityInfo,
        teams: teams,
        totalAmount: formatAmount(totalAmount),
        shareAmount: formatAmount(shareAmount),
        myTeam: myTeam,
        myTeamDiff: myTeamDiff,
        myPersonalDiff: myPersonalDiff,
        isCreator: isCreator,
        isEnded: isEnded
      });

      // 如果需要选择团队，显示选择弹窗
      if (this.data.needSelectTeam && !isEnded && !myTeam) {
        this.setData({
          showTeamSelect: true
        });
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
    wx.vibrateShort({ type: 'light' });
    const inviteCode = this.data.activityInfo.inviteCode;
    if (inviteCode) {
      await copyToClipboard(inviteCode);
    }
  },

  // 显示添加支付记录弹窗
  showAddPaymentModal() {
    wx.vibrateShort({ type: 'light' });
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
      if (member) return { ...member, teamName: team.name };
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

  // 显示创建团队弹窗
  showCreateTeamModal() {
    this.setData({
      showCreateTeam: true,
      teamName: ''
    });
  },

  // 隐藏创建团队弹窗
  hideCreateTeamModal() {
    this.setData({
      showCreateTeam: false
    });
  },

  // 团队名称输入
  onTeamNameInput(e) {
    this.setData({
      teamName: e.detail.value
    });
  },

  // 创建新团队
  async handleCreateTeam() {
    const { teamName } = this.data;
    if (!teamName || teamName.trim() === '') {
      showError('请输入团队名称');
      return;
    }

    showLoading('创建中...');
    try {
      await createTeam(this.data.activityId, teamName.trim());
      hideLoading();
      showSuccess('创建成功');
      this.hideCreateTeamModal();
      this.hideTeamSelect();
      // 刷新活动详情
      this.loadActivityDetail();
    } catch (error) {
      hideLoading();
      console.error('创建团队失败:', error);
      showError(error.message || '创建失败');
    }
  },

  // 加入现有团队
  async handleJoinTeam(e) {
    const teamId = e.currentTarget.dataset.teamid;

    showLoading('加入中...');
    try {
      await joinTeam(this.data.activityId, teamId);
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
