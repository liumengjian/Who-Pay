// pages/activity/detail.js
const {
  getActivityDetail,
  addPayment,
  endActivity,
  getMemberPayments,
  createTeam,
  joinTeamByInvite,
  dissolveTeam,
  updateActivity,
  updateTeam,
  leaveTeam,
  leaveActivity,
  getActivityPayments,
  deletePayment,
  applyForJoin
} = require('../../utils/cloud.js');
const {
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  copyToClipboard,
  formatAmount,
  formatDateTime,
  formatDate,
  validateAmount,
  validateInviteCode,
  filePathToBase64Compressed
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
    userId: '',
    showEditActivity: false,
    editActivityName: '',
    editActivitySlogan: '',
    editActivityAvatarUrl: '',
    editActivityAvatarTempPath: '',
    showEditTeamNameModal: false,
    editingTeamId: '',
    editTeamNameInput: '',
    // 日期筛选费用明细
    showExpenseDetail: false,
    expenseList: [],
    allExpenseList: [],
    dailyExpenseSummary: [],
    selectedDate: '',
    availableDates: [],
    // 删除支付记录
    showDeletePayment: false,
    deletePaymentId: '',
    deletePaymentAmount: '',
    deletePaymentRemark: '',
    deletePaymentUserId: ''
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
      // 计算总人数（所有团队人数之和）用于人均均摊
      const totalMemberCount = teamsData.reduce(
        (sum, team) => sum + ((team.members || []).length || 0), 0
      ) || 1;

      const totalAmount = parseFloat(result.totalAmount || 0);
      // 人均均摊：总花费 / 总人数
      const shareAmount = totalAmount / totalMemberCount;

      const teams = teamsData.map((teamData) => {
        const teamTotal = parseFloat(teamData.totalAmount || 0);
        // 团队差异：团队总支付 - 团队应均摊金额（人数 × 人均）
        const teamMemberCount = (teamData.members || []).length || 1;
        const teamShouldPay = teamMemberCount * shareAmount;
        const diffAmount = teamTotal - teamShouldPay;
        const memberShareAmount = teamMemberCount > 0 ? Math.abs(diffAmount) / teamMemberCount : 0;

        return {
          _id: teamData._id || teamData.id,
          id: teamData._id || teamData.id,
          name: teamData.name || teamData.teamName || '未命名团队',
          inviteCode: teamData.inviteCode || '',
          creatorId: teamData.creatorId || '',
          totalAmount: formatAmount(teamTotal),
          diffAmount: parseFloat(diffAmount.toFixed(2)),
          memberCount: teamMemberCount,
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
        totalMemberCount: totalMemberCount,
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

  // ========== 日期筛选费用明细 ==========
  async _loadExpenseDetail() {
    const result = await getActivityPayments(this.data.activityId);
    const payments = (result.payments || []).map((p) => ({
      ...p,
      createTime: formatDateTime(p.createTime),
      dateKey: formatDate(p.createTime),
      payerName: p.payerName || p.username || '未知'
    }));

    // 计算每日总花费
    const dateMap = {};
    payments.forEach((p) => {
      const date = p.dateKey;
      if (!dateMap[date]) {
        dateMap[date] = { date, total: 0 };
      }
      dateMap[date].total += parseFloat(p.amount || 0);
    });

    const totalMemberCount = this.data.totalMemberCount || 1;
    const dailySummary = Object.values(dateMap)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((d) => ({
        date: d.date,
        total: formatAmount(d.total),
        perPerson: formatAmount(d.total / totalMemberCount)
      }));

    // 默认选中第一天
    const availableDates = dailySummary.map((d) => d.date);
    const selectedDate = availableDates[0] || '';

    // 过滤当天数据
    const filteredList = selectedDate
      ? payments.filter((p) => p.dateKey === selectedDate)
      : [];

    this.setData({
      showExpenseDetail: true,
      expenseList: filteredList,
      allExpenseList: payments,
      dailyExpenseSummary: dailySummary,
      selectedDate: selectedDate,
      availableDates: availableDates
    });
  },

  async openExpenseDetail() {
    showLoading('加载中...');
    try {
      await this._loadExpenseDetail();
    } catch (error) {
      console.error('加载费用明细失败:', error);
      showError(error.message || '加载失败');
    } finally {
      hideLoading();
    }
  },

  hideExpenseDetail() {
    this.setData({
      showExpenseDetail: false
    });
  },

  onDateSelect(e) {
    const date = e.currentTarget.dataset.date;
    const allPayments = this.data.allExpenseList || [];
    const filteredList = allPayments.filter((p) => p.dateKey === date);
    this.setData({
      selectedDate: date,
      expenseList: filteredList
    });
  },

  // 长按删除支付记录
  onExpenseItemLongPress(e) {
    const item = e.currentTarget.dataset.item;
    const currentUserId = this.data.userId || wx.getStorageSync('userId');
    if (String(item.userId) !== String(currentUserId)) {
      showError('只能删除自己的支付记录');
      return;
    }
    this.setData({
      showDeletePayment: true,
      deletePaymentId: item._id || item.id,
      deletePaymentAmount: item.amount,
      deletePaymentRemark: item.remark || '',
      deletePaymentUserId: item.userId
    });
  },

  hideDeletePayment() {
    this.setData({
      showDeletePayment: false,
      deletePaymentId: '',
      deletePaymentAmount: '',
      deletePaymentRemark: '',
      deletePaymentUserId: ''
    });
  },

  async confirmDeletePayment() {
    const paymentId = this.data.deletePaymentId;
    if (!paymentId) return;
    showLoading('删除中...');
    try {
      await deletePayment(paymentId);
      hideLoading();
      showSuccess('已删除');
      this.hideDeletePayment();
      // 重新加载活动详情（金额、团队等全部刷新）
      await this.loadActivityDetail();
      // 重新打开费用明细弹窗
      if (this.data.showExpenseDetail) {
        await this.openExpenseDetail();
      }
    } catch (error) {
      hideLoading();
      console.error('删除支付记录失败:', error);
      showError(error.message || '删除失败');
    }
  },

  // ========== 编辑活动 ==========
  onActivityAvatarTap() {
    if (!this.data.isCreator || this.data.isEnded) return;
    const a = this.data.activityInfo || {};
    const defAvatar = a.avatarUrl || '/images/default-avatar.png';
    this.setData({
      showEditActivity: true,
      editActivityName: a.name || '',
      editActivitySlogan: a.slogan || '',
      editActivityAvatarUrl: defAvatar,
      editActivityAvatarTempPath: ''
    });
  },

  hideEditActivityModal() {
    this.setData({
      showEditActivity: false,
      editActivityAvatarTempPath: ''
    });
  },

  onEditActivityNameInput(e) {
    this.setData({ editActivityName: e.detail.value });
  },

  onEditActivitySloganInput(e) {
    this.setData({ editActivitySlogan: e.detail.value });
  },

  onChooseEditActivityAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      editActivityAvatarTempPath: avatarUrl,
      editActivityAvatarUrl: avatarUrl
    });
  },

  async handleSaveActivityInfo() {
    const name = (this.data.editActivityName || '').trim();
    if (!name) {
      showError('请输入活动名称');
      return;
    }
    showLoading('保存中...');
    try {
      const body = {
        name,
        slogan: (this.data.editActivitySlogan || '').trim()
      };
      const temp = this.data.editActivityAvatarTempPath;
      if (temp) {
        body.avatar = await filePathToBase64Compressed(temp);
      }
      await updateActivity(this.data.activityId, body);
      hideLoading();
      showSuccess('已保存');
      this.hideEditActivityModal();
      await this.loadActivityDetail();
    } catch (e) {
      hideLoading();
      showError(e.message || '保存失败');
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

  async handleJoinTeamApply() {
    const activityId = this.data.activityId;
    // 从弹窗获取的团队ID通过 teamInviteCode 字段传入（实际存的是团队ID）
    // 这里用 joinTeamHintName 对应的团队
    // 由于加入团队时只知道团队名称，不知道ID，需要从活动数据中找
    const hintName = this.data.joinTeamHintName;
    const team = (this.data.teams || []).find((t) => t.name === hintName);
    if (!team) {
      showError('未找到团队');
      return;
    }
    showLoading('申请中...');
    try {
      await applyForJoin(activityId, 'team', team._id || team.id);
      hideLoading();
      showSuccess('申请已发送，请等待审批');
      this.hideJoinTeamModal();
    } catch (error) {
      hideLoading();
      showError(error.message || '申请失败');
    }
  },

  handleDissolveTeamTap(e) {
    const teamId = e.currentTarget.dataset.id;
    if (!teamId) return;
    wx.showModal({
      title: '解散团队',
      content: '解散后团队成员将全部移除，且无法恢复，确定？',
      success: async (res) => {
        if (!res.confirm) return;
        showLoading('处理中...');
        try {
          await dissolveTeam(teamId);
          hideLoading();
          showSuccess('已解散');
          await this.loadActivityDetail();
        } catch (err) {
          hideLoading();
          showError(err.message || '失败');
        }
      }
    });
  },

  handleEditTeamTap(e) {
    const id = String(e.currentTarget.dataset.id || '');
    const name = e.currentTarget.dataset.name || '';
    if (!id) return;
    this.setData({
      showEditTeamNameModal: true,
      editingTeamId: id,
      editTeamNameInput: name
    });
  },

  hideEditTeamNameModal() {
    this.setData({
      showEditTeamNameModal: false,
      editingTeamId: '',
      editTeamNameInput: ''
    });
  },

  onEditTeamNameInputModal(e) {
    this.setData({ editTeamNameInput: e.detail.value });
  },

  async handleSaveTeamName() {
    const tid = this.data.editingTeamId;
    const tname = (this.data.editTeamNameInput || '').trim();
    if (!tid || !tname) {
      showError('请输入团队名称');
      return;
    }
    showLoading('保存中...');
    try {
      await updateTeam(tid, tname);
      hideLoading();
      showSuccess('已保存');
      this.hideEditTeamNameModal();
      await this.loadActivityDetail();
    } catch (err) {
      hideLoading();
      showError(err.message || '保存失败');
    }
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
