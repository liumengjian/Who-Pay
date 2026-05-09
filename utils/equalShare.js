/**
 * 人均均摊（精确到角）：与活动详情、服务端一键均摊同一套算法
 */

function equalShareSlotTargetsOneDecimal(totalAmount, nSlots) {
  if (!nSlots || nSlots <= 0) return [];
  const totalTenths = Math.round(parseFloat(totalAmount) * 10);
  const base = Math.floor(totalTenths / nSlots);
  const rem = totalTenths - base * nSlots;
  const out = [];
  for (let i = 0; i < nSlots; i++) {
    out.push((base + (i < rem ? 1 : 0)) / 10);
  }
  return out;
}

/**
 * 按 teams 顺序，每团队内按 members 顺序，每人占一人次。
 * @returns {{ teamTargetSum: Object, userTargetTenths: Object, displaySharePerHead: number, nSlots: number }}
 */
function computeEqualShareFromTeamsData(teamsData, totalAmount) {
  const slots = [];
  for (const teamData of teamsData || []) {
    const tid = String(teamData._id || teamData.id);
    for (const m of teamData.members || []) {
      slots.push({ userId: String(m.userId), teamId: tid });
    }
  }
  const n = slots.length;
  const totalTenths = Math.round(parseFloat(totalAmount) * 10);
  const base = n > 0 ? Math.floor(totalTenths / n) : 0;
  const rem = n > 0 ? totalTenths - base * n : 0;
  const userTargetTenths = {};
  const teamTargetTenths = {};
  for (let i = 0; i < n; i++) {
    const slotTenths = base + (i < rem ? 1 : 0);
    const uid = slots[i].userId;
    const tid = slots[i].teamId;
    userTargetTenths[uid] = (userTargetTenths[uid] || 0) + slotTenths;
    teamTargetTenths[tid] = (teamTargetTenths[tid] || 0) + slotTenths;
  }
  const teamTargetSum = {};
  for (const tid of Object.keys(teamTargetTenths)) {
    teamTargetSum[tid] = teamTargetTenths[tid] / 10;
  }
  const displaySharePerHead = n > 0 ? Math.round(totalTenths / n) / 10 : 0;
  return {
    userTargetTenths,
    teamTargetSum,
    displaySharePerHead,
    nSlots: n
  };
}

module.exports = {
  equalShareSlotTargetsOneDecimal,
  computeEqualShareFromTeamsData
};
