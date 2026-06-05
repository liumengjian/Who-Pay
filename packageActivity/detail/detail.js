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
  applyForJoin,
  settleEqualShare,
  updateMemberWeight
} = require('../../utils/cloud.js');
const {
  computeEqualShareFromTeamsData
} = require('../../utils/equalShare.js');
const {
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  copyToClipboard,
  formatAmount,
  roundAmount1,
  formatDateTime,
  formatDate,
  validateAmount,
  validateInviteCode
} = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');
const noteStore = require('../../utils/activityNoteStorage.js');
const cloudStorage = require('../../utils/cloudStorage.js');
const {
  dispatchActivityNoteMpHtmlLinkTap,
  inferWxOpenDocumentFileType,
  invokeOpenDocumentWithRetry
} = require('../../utils/activityNoteLinks.js');
const { ENABLE_SOCIAL } = require('../../service/config.js');

Page({
  data: {
    activityId: '',
    activityInfo: {},
    teams: [],
    totalAmount: '0.0',
    shareAmount: '0.0',
    myTeam: null,
    myTeamDiff: 0,
    myTeamDiffAbsStr: '0.0',
    myPersonalDiff: '0.0',
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
    deletePaymentUserId: '',
    // 权重编辑
    showWeightEditor: false,
    weightTargetUserId: '',
    weightTargetTeamId: '',
    weightTargetName: '',
    weightValue: 1.0,
    weightCustomInput: '',
    weightSubmitting: false,
    showEqualizeBtn: false,
    shareBalancedComplete: false,
    triggered: false,
    navHeight: 0,
    noteContent: '',
    activityNoteHasPreview: false,
    activityNotePreviewHtml: '',
    noteMpHtmlPreviewTagStyle: {
      p: 'margin:0 0 22rpx 0;',
      a: 'text-decoration:none;-webkit-tap-highlight-color:transparent;',
      img: noteStore.NOTE_IMG_HTML_STYLE
    }
  },

  _applyActivityNoteFromDetail(an) {
    const raw = an || {};
    const content = noteStore.ensureChipStylesInNoteHtml(
      raw.content != null ? String(raw.content) : ''
    );
    const linkMap = noteStore.normalizeLinkMapForClient(raw.linkMap || {});
    this._activityNoteLinkMap = linkMap;
    return {
      noteContent: content,
      ...noteStore.notePreviewFromContent(content, linkMap)
    };
  },

  onLoad(options) {
    this.setData({ navHeight: getNavTotalHeight() });

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
    this.setData({ navHeight: getNavTotalHeight() });
    if (this.data.activityId) {
      this.setData({ userId: wx.getStorageSync('userId') || '' });
      this.loadActivityDetail();
    }
  },

  onRefresh() {
    this.loadActivityDetail().finally(() => {
      this.setData({ triggered: false });
    });
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
      const rawMemberCount = teamsData.reduce(
        (sum, team) => sum + ((team.members || []).length || 0),
        0
      );
      const totalMemberCount = rawMemberCount || 1;

      const totalAmount = parseFloat(result.totalAmount || 0);
      const eq = computeEqualShareFromTeamsData(teamsData, totalAmount);
      const shareAmount = eq.displaySharePerHead;

      const teams = teamsData.map((teamData) => {
        const tid = String(teamData._id || teamData.id);
        const teamTotal = parseFloat(teamData.totalAmount || 0);
        const teamMemberCount = (teamData.members || []).length || 1;
        const teamShouldPay = eq.teamTargetSum[tid] || 0;
        const diffAmount = roundAmount1(teamTotal - teamShouldPay);
        const diffAmountDisplay = formatAmount(Math.abs(diffAmount));
        const memberShareAmount =
          teamMemberCount > 0 ? Math.abs(diffAmount) / teamMemberCount : 0;

        return {
          _id: teamData._id || teamData.id,
          id: teamData._id || teamData.id,
          name: teamData.name || teamData.teamName || '未命名团队',
          inviteCode: teamData.inviteCode || '',
          creatorId: teamData.creatorId || '',
          totalAmount: formatAmount(teamTotal),
          diffAmount: roundAmount1(diffAmount),
          diffAmountDisplay,
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
      let myPersonalDiffNum = 0;
      let isTeamCreator = false;

      for (const team of teams) {
        const member = team.members.find((m) => String(m.userId) === String(userId));
        if (member) {
          myTeam = team;
          myTeamDiff = team.diffAmount;
          isTeamCreator = String(team.creatorId) === String(userId);
          const myWeight = parseFloat(member.weight != null ? member.weight : 1);
          const teamTotalWeight = team.members.reduce(
            (s, m) => s + parseFloat(m.weight != null ? m.weight : 1), 0
          );
          if (teamTotalWeight > 0 && team.diffAmount !== 0) {
            myPersonalDiffNum = roundAmount1(team.diffAmount * myWeight / teamTotalWeight);
          }
          break;
        }
      }

      const showEqualizeBtn =
        !isEnded &&
        teams.length > 0 &&
        rawMemberCount > 0 &&
        teams.some((t) => Math.abs(t.diffAmount) >= 0.05);

      /* 每人实付（角）与按人次拆分后的目标（角）一致，视为已均摊完成 */
      let shareBalancedComplete = false;
      if (rawMemberCount > 0 && teamsData.length > 0 && eq.nSlots > 0) {
        shareBalancedComplete = true;
        const paidTenthsByUser = {};
        for (const teamData of teamsData) {
          for (const m of teamData.members || []) {
            const uid = String(m.userId);
            paidTenthsByUser[uid] = Math.round(
              roundAmount1(parseFloat(m.totalAmount || 0)) * 10
            );
          }
        }
        for (const uid of Object.keys(eq.userTargetTenths)) {
          if (paidTenthsByUser[uid] !== eq.userTargetTenths[uid]) {
            shareBalancedComplete = false;
            break;
          }
        }
      }

      const notePatch = this._applyActivityNoteFromDetail(result.activityNote);

      this.setData({
        activityInfo: activityInfo,
        teams: teams,
        totalAmount: formatAmount(totalAmount),
        shareAmount: formatAmount(shareAmount),
        totalMemberCount: totalMemberCount,
        myTeam: myTeam,
        myTeamDiff: myTeamDiff,
        myTeamDiffAbsStr: formatAmount(Math.abs(myTeamDiff)),
        myPersonalDiff: formatAmount(myPersonalDiffNum),
        isCreator: isCreator,
        isTeamCreator: isTeamCreator,
        isEnded: isEnded,
        showEqualizeBtn: showEqualizeBtn,
        shareBalancedComplete: shareBalancedComplete,
        ...notePatch
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
    const list = result.payments || [];
    const dateMap = {};
    list.forEach((p) => {
      const date = formatDate(p.createTime);
      if (!dateMap[date]) {
        dateMap[date] = { date, total: 0 };
      }
      dateMap[date].total += parseFloat(p.amount || 0);
    });

    const payments = list.map((p) => ({
      ...p,
      amount: formatAmount(p.amount),
      createTime: formatDateTime(p.createTime),
      dateKey: formatDate(p.createTime),
      payerName: p.payerName || p.username || '未知'
    }));

    const totalMemberCount = this.data.totalMemberCount || 1;
    const dailySummary = Object.values(dateMap)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((d) => ({
        date: d.date,
        total: formatAmount(d.total),
        perPerson: formatAmount(
          totalMemberCount > 0
            ? Math.round((d.total * 10) / totalMemberCount) / 10
            : 0
        )
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
      // 成员支付弹窗仍打开时刷新列表
      if (this.data.showMemberPayments && this.data.selectedMemberId) {
        await this.refreshMemberPaymentsPanel();
      }
    } catch (error) {
      hideLoading();
      console.error('删除支付记录失败:', error);
      showError(error.message || '删除失败');
    }
  },

  // ========== 成员权重编辑 ==========
  openWeightEditor(e) {
    const { teamid, userid, nickname, weight } = e.currentTarget.dataset;
    const w = parseFloat(weight) || 1.0;
    this.setData({
      showWeightEditor: true,
      weightTargetTeamId: teamid,
      weightTargetUserId: userid,
      weightTargetName: nickname,
      weightValue: w,
      weightCustomInput: String(w),
      weightSubmitting: false
    });
  },

  closeWeightEditor() {
    this.setData({ showWeightEditor: false });
  },

  setWeightPreset(e) {
    const val = parseFloat(e.currentTarget.dataset.val);
    this.setData({
      weightValue: val,
      weightCustomInput: String(val)
    });
  },

  onWeightCustomInput(e) {
    const v = e.detail.value;
    this.setData({
      weightCustomInput: v,
      weightValue: parseFloat(v) || 0
    });
  },

  async submitWeight() {
    const { weightTargetTeamId, weightTargetUserId, weightCustomInput } = this.data;
    const w = parseFloat(weightCustomInput);
    if (isNaN(w) || w <= 0 || w > 99.9) {
      showError('请输入合法的权重值（> 0 且 ≤ 99.9）');
      return;
    }
    this.setData({ weightSubmitting: true });
    try {
      await updateMemberWeight(weightTargetTeamId, weightTargetUserId, parseFloat(w.toFixed(1)));
      showSuccess('权重已更新');
      this.setData({ showWeightEditor: false });
      await this.loadActivityDetail();
    } catch (e) {
      showError((e && e.message) || '修改失败');
    } finally {
      this.setData({ weightSubmitting: false });
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
      const prevAvatar =
        this.data.activityInfo && this.data.activityInfo.avatarUrl;
      if (temp) {
        const newId = await cloudStorage.uploadLocalImage(
          temp,
          `activities/${this.data.activityId}/cover_${Date.now()}.jpg`,
          { compressQuality: 78 }
        );
        body.avatar = newId;
      }
      await updateActivity(this.data.activityId, body);
      if (
        temp &&
        cloudStorage.isCloudFileId(prevAvatar) &&
        body.avatar &&
        prevAvatar !== body.avatar
      ) {
        cloudStorage.deleteCloudFiles([prevAvatar]);
      }
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
        amount: formatAmount(p.amount),
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

  /** 成员支付弹窗内：长按删除（仅本人记录可删，服务端亦校验） */
  onMemberPaymentLongPress(e) {
    const ds = e.currentTarget.dataset || {};
    const paymentId = ds.paymentId != null ? String(ds.paymentId) : '';
    const currentUserId = this.data.userId || wx.getStorageSync('userId');
    if (String(this.data.selectedMemberId) !== String(currentUserId)) {
      showError('只能删除自己的支付记录');
      return;
    }
    if (!paymentId) return;
    this.setData({
      showDeletePayment: true,
      deletePaymentId: paymentId,
      deletePaymentAmount: ds.amount,
      deletePaymentRemark: ds.remark != null ? String(ds.remark) : '',
      deletePaymentUserId: currentUserId
    });
  },

  async refreshMemberPaymentsPanel() {
    if (!this.data.showMemberPayments || !this.data.selectedMemberId) return;
    const userId = this.data.selectedMemberId;
    try {
      const result = await getMemberPayments(this.data.activityId, userId);
      const payments = (result.payments || []).map((p) => ({
        ...p,
        amount: formatAmount(p.amount),
        createTime: formatDateTime(p.createTime)
      }));
      this.setData({ memberPayments: payments });
    } catch (err) {
      console.error('刷新成员支付记录失败:', err);
    }
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

  async handleEqualizeShare() {
    if (this.data.isEnded) {
      showError('活动已结束');
      return;
    }
    if (!this.data.showEqualizeBtn) return;
    wx.showModal({
      title: '一键均摊',
      content:
        '将为每人自动添加「均摊付款」或「均摊收款」记录，使各人实付与目标一致。是否继续？',
      success: async (res) => {
        if (!res.confirm) return;
        showLoading('均摊中...');
        try {
          const result = await settleEqualShare(this.data.activityId);
          hideLoading();
          const n = result && typeof result.count === 'number' ? result.count : 0;
          const msg = result && result.message;
          if (n === 0) {
            showSuccess(msg || '无需调整');
          } else {
            showSuccess(`已为 ${n} 人次记账`);
          }
          await this.loadActivityDetail();
        } catch (e) {
          hideLoading();
          console.error(e);
          showError(e.message || '均摊失败');
        }
      }
    });
  },

  openActivityNoteFullscreen() {
    if (this.data.isEnded) {
      wx.showToast({ title: '活动已结束，可在上方预览笔记', icon: 'none' });
      return;
    }
    const id = this.data.activityId;
    if (!id) return;
    wx.navigateTo({
      url: '/packageActivity/note/note?id=' + encodeURIComponent(id)
    });
  },

  onActivityNoteMpHtmlLinkTap(e) {
    dispatchActivityNoteMpHtmlLinkTap(e, {
      showError,
      openNoteAttachment: (params) => this._openNoteAttachmentFromParams(params),
      linkMap: this._activityNoteLinkMap || {},
      noteBlocksForLocResolve: []
    });
  },

  async _openNoteAttachmentFromParams(params) {
    const url = (params && params.url) || '';
    if (!String(url).trim()) {
      showError('附件地址无效');
      return;
    }
    showLoading('打开附件...');
    try {
      const filePath = await cloudStorage.downloadNoteAttachmentToTempPath(url);
      hideLoading();
      const name = (params && params.name) || '';
      const fileType = inferWxOpenDocumentFileType(name, url);
      invokeOpenDocumentWithRetry(filePath, fileType, showError);
    } catch (err) {
      hideLoading();
      showError((err && err.message) || '打开附件失败');
    }
  },

  onActivityNoteMpHtmlImgTap(e) {
    const src = (e.detail && e.detail.src) || '';
    if (!src) return;
    const urls = noteStore.extractImageUrlsFromHtml(this.data.noteContent || '');
    wx.previewImage({
      current: src,
      urls: urls.length ? urls : [src]
    });
  },

  goMemberProfile(e) {
    const uid = e.currentTarget.dataset.uid;
    if (!uid) return;
    wx.navigateTo({ url: `/packageFriend/home/home?id=${uid}` });
  },

  stopPropagation() {}
});
