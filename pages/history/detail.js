// pages/history/detail.js
const { getActivityDetail, getMemberPayments } = require('../../utils/cloud.js');
const { 
  showLoading, 
  hideLoading, 
  showError, 
  copyToClipboard,
  formatAmount,
  formatDateTime
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
    showMemberPayments: false,
    selectedMemberId: '',
    selectedMemberName: '',
    memberPayments: []
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

    this.loadActivityDetail();
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

      // 获取团队列表（动态，不固定）
      const teamsData = result.teams || [];
      const teamCount = teamsData.length || 1;
      
      // 计算总花费和团队均摊额
      const totalAmount = parseFloat(result.totalAmount || 0);
      const shareAmount = teamCount > 0 ? totalAmount / teamCount : 0;

      // 处理团队数据
      const teams = teamsData.map(teamData => {
        const teamTotal = parseFloat(teamData.totalAmount || 0);
        const diffAmount = teamTotal - shareAmount;
        const memberCount = (teamData.members || []).length || 1;
        const memberShareAmount = memberCount > 0 ? Math.abs(diffAmount) / memberCount : 0;

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

      // 格式化结束时间
      let endTime = '';
      if (activityInfo.endTime) {
        endTime = formatDateTime(activityInfo.endTime);
      }

      this.setData({
        activityInfo: {
          ...activityInfo,
          endTime: endTime
        },
        teams: teams,
        totalAmount: formatAmount(totalAmount),
        shareAmount: formatAmount(shareAmount)
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
  stopPropagation() {}
});
