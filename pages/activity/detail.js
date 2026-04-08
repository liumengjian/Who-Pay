// pages/activity/detail.js
const {
  getActivityDetail,
  addPayment,
  endActivity,
  getMemberPayments,
  createTeam,
  joinTeamByInvite,
  dissolveTeam,
  leaveTeam,
  leaveActivity
} = require('../../utils/cloud.js');
const {
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  copyToClipboard,
  formatAmount,
  formatDateTime,
  validateAmount,
  validateInviteCode
} = require('../../utils/util.js');

Page({
  data: {
    activityId: '',
    activityInfo: {},
    teams: [],
    totalAmount: '0.00',
    shareAmount: '0.00',
    myTeam: null,
    myTeamDiff: 0,
    myPersonalDiff: 0,
    isCreator: false,
    isTeamCreator: false,
    isEnded: false,
    showCreateTeam: false,
    showAddPayment: false,
    showJoinTeamModal: false,
    joinTeamHintName: '',
    showTeamInviteResult: false,
    createdTeamInviteCode: '',
    showMemberPayments: false,
    paymentAmount: '',
    paymentRemark: '',
    teamName: '',
    teamInviteCode: '',
    selectedMemberId: '',
    selectedMemberName: '',
    memberPayments: [],
    userId: ''
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

    this._openCreateTeamAfterLoad =
      options.needSelectTeam === 'true' || options.needSelectTeam === true;

    this.setData({
      activityId: activityId,
      userId: wx.getStorageSync('userId') || ''
    });

    this.loadActivityDetail();
  },

  onShow() {
    if (this.data.activityId) {
      this.setData({ userId: wx.getStorageSync('userId') || '' });
      this.loadActivityDetail();
    }
  },

  async loadActivityDetail() {
    showLoading('加载中...');
    try {
      const result = await getActivityDetail(this.data.activityId);

      if (!result || !result.activityInfo) {
        throw new Error('活动不存在');
      }

      const activityInfo = result.activityInfo;
      const userId = wx.getStorageSync('userId');
      const isCreator = String(activityInfo.creatorId) === String(userId);
      const isEnded = activityInfo.status === 'ended';

      const teamsData = result.teams || [];
      const teamCount = teamsData.length || 1;

      const totalAmount = parseFloat(result.totalAmount || 0);
      const shareAmount = teamCount > 0 ? totalAmount / teamCount : 0;

      const teams = teamsData.map((teamData) => {
        const teamTotal = parseFloat(teamData.totalAmount || 0);
        const diffAmount = teamTotal - shareAmount;
        const memberCount = (teamData.members || []).length || 1;
        const memberShareAmount = memberCount > 0 ? Math.abs(diffAmount) / memberCount : 0;

        return {
          _id: teamData._id || teamData.id,
          id: teamData._id || teamData.id,
          name: teamData.name || teamData.teamName || '未命名团队',
          inviteCode: teamData.inviteCode || '',
          creatorId: teamData.creatorId || '',
          totalAmount: formatAmount(teamTotal),
          diffAmount: parseFloat(diffAmount.toFixed(2)),
          memberCount: memberCount,
          memberShareAmount: formatAmount(memberShareAmount),
          iCreated: String(teamData.creatorId || '') === String(userId),
          amMember: (teamData.members || []).some(
            (m) => String(m.userId) === String(userId)
          ),
          members: (teamData.members || []).map((m) => ({
            ...m,
            totalAmount: formatAmount(m.totalAmount || 0)
          }))
        };
      });

      let myTeam = null;
      let myTeamDiff = 0;
      let myPersonalDiff = 0;
      let isTeamCreator = false;

      for (const team of teams) {
        const member = team.members.find((m) => String(m.userId) === String(userId));
        if (member) {
          myTeam = team;
          myTeamDiff = team.diffAmount;
          isTeamCreator = String(team.creatorId) === String(userId);
          if (team.diffAmount < 0) {
            myPersonalDiff = parseFloat((Math.abs(team.diffAmount) / team.memberCount).toFixed(2));
          } else if (team.diffAmount > 0) {
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
        isTeamCreator: isTeamCreator,
        isEnded: isEnded
      });

      if (this._openCreateTeamAfterLoad && !isEnded && !myTeam) {
        this._openCreateTeamAfterLoad = false;
        this.setData({
          showCreateTeam: true,
          teamName: ''
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

  async copyInviteCode() {
    const inviteCode = this.data.activityInfo.inviteCode;
    if (inviteCode) {
      await copyToClipboard(inviteCode);
    }
  },

  async copyTeamInviteCode() {
    const code = this.data.myTeam && this.data.myTeam.inviteCode;
    if (code) {
      await copyToClipboard(code);
    }
  },

  /** 右下角 +：无团队时创建团队，已在团队则记账 */
  handlePrimaryFab() {
    if (this.data.isEnded) {
      showError('活动已结束');
      return;
    }
    if (!this.data.myTeam) {
      this.setData({
        showCreateTeam: true,
        teamName: ''
      });
      return;
    }
    this.setData({
      showAddPayment: true,
      paymentAmount: '',
      paymentRemark: ''
    });
  },

  hideAddPaymentModal() {
    this.setData({
      showAddPayment: false
    });
  },

  onPaymentAmountInput(e) {
    this.setData({
      paymentAmount: e.detail.value
    });
  },

  onPaymentRemarkInput(e) {
    this.setData({
      paymentRemark: e.detail.value
    });
  },

  async handleAddPayment() {
    const { paymentAmount, paymentRemark } = this.data;
    const error = validateAmount(paymentAmount);
    if (error) {
      showError(error);
      return;
    }

    const userInfo = wx.getStorageSync('userInfo') || {};
    const userId = wx.getStorageSync('userId');
    const username = userInfo.username || (userId === 'admin' ? 'admin' : '');
    if (!username) {
      showError('缺少账号信息，请重新登录');
      return;
    }
    if (!this.data.myTeam) {
      showError('请先加入团队');
      return;
    }

    showLoading('添加中...');
    try {
      await addPayment(
        username,
        this.data.activityId,
        this.data.myTeam._id,
        paymentAmount,
        paymentRemark
      );
      hideLoading();
      showSuccess('添加成功');
      this.hideAddPaymentModal();
      this.loadActivityDetail();
    } catch (error) {
      hideLoading();
      console.error('添加支付记录失败:', error);
      showError(error.message || '添加失败');
    }
  },

  async viewMemberPayments(e) {
    const userId = e.currentTarget.dataset.userid;
    const member = this.findMember(userId);
    if (!member) return;

    showLoading('加载中...');
    try {
      const result = await getMemberPayments(this.data.activityId, userId);
      const payments = (result.payments || []).map((p) => ({
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

  hideMemberPayments() {
    this.setData({
      showMemberPayments: false
    });
  },

  findMember(userId) {
    for (const team of this.data.teams) {
      const member = team.members.find((m) => String(m.userId) === String(userId));
      if (member) return { ...member, teamName: team.name };
    }
    return null;
  },

  /** 点击团队卡片：非本人创建且未加入时可输入邀请码加入（类似活动大厅） */
  onTeamCardTap(e) {
    if (this.data.isEnded) return;
    const id = String(e.currentTarget.dataset.id || '');
    const team = (this.data.teams || []).find((t) => String(t._id) === id);
    if (!team) return;
    const uid = this.data.userId || wx.getStorageSync('userId');
    if (team.iCreated || String(team.creatorId) === String(uid)) return;
    if (team.amMember) return;
    if (this.data.myTeam) {
      showError('您已在其他团队中，请先退出后再加入');
      return;
    }
    this.setData({
      showJoinTeamModal: true,
      joinTeamHintName: team.name || '',
      teamInviteCode: ''
    });
  },

  hideJoinTeamModal() {
    this.setData({
      showJoinTeamModal: false,
      joinTeamHintName: '',
      teamInviteCode: ''
    });
  },

  async onCopyTeamCardInvite(e) {
    const code = e.currentTarget.dataset.code;
    if (code) {
      await copyToClipboard(String(code));
    }
  },

  hideTeamInviteResult() {
    this.setData({
      showTeamInviteResult: false,
      createdTeamInviteCode: ''
    });
  },

  async copyCreatedTeamInvite() {
    const code = this.data.createdTeamInviteCode;
    if (code) {
      await copyToClipboard(code);
    }
  },

  showCreateTeamModal() {
    this.setData({
      showCreateTeam: true,
      teamName: ''
    });
  },

  hideCreateTeamModal() {
    this.setData({
      showCreateTeam: false
    });
  },

  onTeamNameInput(e) {
    this.setData({
      teamName: e.detail.value
    });
  },

  onTeamInviteInput(e) {
    let v = e.detail.value.toUpperCase();
    v = v.replace(/[^A-Z0-9]/g, '');
    this.setData({
      teamInviteCode: v
    });
  },

  async handleCreateTeam() {
    const { teamName } = this.data;
    if (!teamName || teamName.trim() === '') {
      showError('请输入团队名称');
      return;
    }

    showLoading('创建中...');
    try {
      const result = await createTeam(this.data.activityId, teamName.trim());
      hideLoading();
      this.hideCreateTeamModal();
      const code = result.inviteCode ? String(result.inviteCode) : '';
      if (code) {
        this.setData({
          createdTeamInviteCode: code,
          showTeamInviteResult: true
        });
      } else {
        showSuccess('创建成功');
      }
      await this.loadActivityDetail();
    } catch (error) {
      hideLoading();
      console.error('创建团队失败:', error);
      showError(error.message || '创建失败');
    }
  },

  async handleJoinTeamByInvite() {
    const code = this.data.teamInviteCode;
    const err = validateInviteCode(code);
    if (err) {
      showError(err);
      return;
    }
    showLoading('加入中...');
    try {
      await joinTeamByInvite(this.data.activityId, code);
      hideLoading();
      showSuccess('加入成功');
      this.hideJoinTeamModal();
      await this.loadActivityDetail();
    } catch (error) {
      hideLoading();
      console.error('加入团队失败:', error);
      showError(error.message || '加入失败');
    }
  },

  handleDissolveTeam() {
    if (!this.data.myTeam || !this.data.isTeamCreator) return;
    wx.showModal({
      title: '解散团队',
      content: '解散后团队成员将全部移除，且无法恢复，确定？',
      success: async (res) => {
        if (!res.confirm) return;
        showLoading('处理中...');
        try {
          await dissolveTeam(this.data.myTeam._id);
          hideLoading();
          showSuccess('已解散');
          this.loadActivityDetail();
        } catch (e) {
          hideLoading();
          showError(e.message || '失败');
        }
      }
    });
  },

  handleLeaveTeam() {
    if (!this.data.myTeam || this.data.isTeamCreator) return;
    wx.showModal({
      title: '退出团队',
      content: '确定退出当前团队？',
      success: async (res) => {
        if (!res.confirm) return;
        showLoading('处理中...');
        try {
          await leaveTeam(this.data.myTeam._id);
          hideLoading();
          showSuccess('已退出团队');
          this.loadActivityDetail();
        } catch (e) {
          hideLoading();
          showError(e.message || '失败');
        }
      }
    });
  },

  handleLeaveActivity() {
    if (this.data.isCreator) {
      showError('创建者请使用「结束活动」');
      return;
    }
    wx.showModal({
      title: '退出活动',
      content: '将同时退出本活动下所有团队，确定？',
      success: async (res) => {
        if (!res.confirm) return;
        showLoading('处理中...');
        try {
          await leaveActivity(this.data.activityId);
          hideLoading();
          showSuccess('已退出');
          wx.navigateBack();
        } catch (e) {
          hideLoading();
          showError(e.message || '失败');
        }
      }
    });
  },

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

  stopPropagation() {}
});
