// pages/history/detail.js
const { getActivityDetail, getMemberPayments } = require('../../utils/cloud.js');
const {
  showLoading,
  hideLoading,
  showError,
  copyToClipboard,
  formatAmount,
  roundAmount1,
  formatDateTime
} = require('../../utils/util.js');
const { equalShareSlotTargetsOneDecimal } = require('../../utils/equalShare.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');
const noteStore = require('../../utils/activityNoteStorage.js');
const cloudStorage = require('../../utils/cloudStorage.js');
const {
  dispatchActivityNoteMpHtmlLinkTap,
  inferWxOpenDocumentFileType,
  invokeOpenDocumentWithRetry
} = require('../../utils/activityNoteLinks.js');

Page({
  data: {
    activityId: '',
    activityInfo: {},
    teams: [
      { team: 'A', totalAmount: '0.0', diffAmount: 0, diffAmountDisplay: '0.0', members: [] },
      { team: 'B', totalAmount: '0.0', diffAmount: 0, diffAmountDisplay: '0.0', members: [] },
      { team: 'C', totalAmount: '0.0', diffAmount: 0, diffAmountDisplay: '0.0', members: [] }
    ],
    totalAmount: '0.0',
    shareAmount: '0.0',
    showMemberPayments: false,
    selectedMemberId: '',
    selectedMemberName: '',
    memberPayments: [],
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

    this.setData({
      activityId: activityId
    });

    this.loadActivityDetail();
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
  },

  onRefresh() {
    this.loadActivityDetail().finally(() => {
      this.setData({ triggered: false });
    });
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

      const teamsData = result.teams || [];
      const teamCount = teamsData.length || 1;
      const totalAmount = parseFloat(result.totalAmount || 0);
      const teamTargets = equalShareSlotTargetsOneDecimal(totalAmount, teamCount);
      const shareAmount =
        teamCount > 0 ? Math.round(totalAmount * 10 / teamCount) / 10 : 0;

      const teams = teamsData.map((teamData, idx) => {
        const teamTotal = parseFloat(teamData.totalAmount || 0);
        const teamShouldPay = teamTargets[idx] || 0;
        const diffAmount = roundAmount1(teamTotal - teamShouldPay);
        const diffAmountDisplay = formatAmount(Math.abs(diffAmount));
        const memberCount = (teamData.members || []).length || 1;
        const memberShareAmount =
          memberCount > 0 ? Math.abs(diffAmount) / memberCount : 0;

        return {
          _id: teamData._id || teamData.id,
          name: teamData.name || teamData.teamName || '未命名团队',
          totalAmount: formatAmount(teamTotal),
          diffAmount,
          diffAmountDisplay,
          memberCount,
          memberShareAmount: formatAmount(memberShareAmount),
          members: (teamData.members || []).map((m) => ({
            ...m,
            totalAmount: formatAmount(m.totalAmount || 0)
          }))
        };
      });

      // 格式化结束时间
      let endTime = '';
      if (activityInfo.endTime) {
        endTime = formatDateTime(activityInfo.endTime);
      }

      const notePatch = this._applyActivityNoteFromDetail(result.activityNote);

      this.setData({
        activityInfo: {
          ...activityInfo,
          endTime: endTime
        },
        teams: teams,
        totalAmount: formatAmount(totalAmount),
        shareAmount: formatAmount(shareAmount),
        ...notePatch
      });
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

  // 阻止事件冒泡
  stopPropagation() {},

  openActivityNoteFullscreen() {
    wx.showToast({
      title: '历史活动仅支持在此预览笔记摘要',
      icon: 'none'
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
  }
});
