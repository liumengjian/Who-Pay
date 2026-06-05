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
 * 按 teams 顺序，每团队内按 members 顺序，每人按权重占位。
 * @returns {{ teamTargetSum: Object, userTargetTenths: Object, displaySharePerHead: number, nSlots: number, totalWeight: number }}
 */
function computeEqualShareFromTeamsData(teamsData, totalAmount) {
  const slots = [];
  for (const teamData of teamsData || []) {
    const tid = String(teamData._id || teamData.id);
    for (const m of teamData.members || []) {
      const weight = parseFloat(m.weight != null ? m.weight : 1);
      slots.push({ userId: String(m.userId), teamId: tid, weight });
    }
  }
  const totalWeight = slots.reduce((s, m) => s + m.weight, 0);
  const totalTenths = Math.round(parseFloat(totalAmount) * 10);

  // 按权重比例分配
  const allocs = slots.map((slot) => {
    const rawShare = totalWeight > 0 ? (slot.weight / totalWeight) * parseFloat(totalAmount) : 0;
    const rawTenths = rawShare * 10;
    const baseTenths = Math.floor(rawTenths);
    return { ...slot, baseTenths, frac: rawTenths - baseTenths };
  });

  let allocated = allocs.reduce((s, a) => s + a.baseTenths, 0);
  let remainder = totalTenths - allocated;

  if (remainder > 0) {
    const sorted = allocs.map((a, i) => ({ ...a, idx: i }))
      .sort((a, b) => b.frac - a.frac);
    for (let i = 0; i < remainder && i < sorted.length; i++) {
      allocs[sorted[i].idx].baseTenths += 1;
    }
  }

  const userTargetTenths = {};
  const teamTargetTenths = {};
  for (const alloc of allocs) {
    const uid = alloc.userId;
    const tid = alloc.teamId;
    const tenths = alloc.baseTenths;
    userTargetTenths[uid] = (userTargetTenths[uid] || 0) + tenths;
    teamTargetTenths[tid] = (teamTargetTenths[tid] || 0) + tenths;
  }
  const teamTargetSum = {};
  for (const tid of Object.keys(teamTargetTenths)) {
    teamTargetSum[tid] = teamTargetTenths[tid] / 10;
  }
  const displaySharePerHead = totalWeight > 0 ? Math.round(totalTenths / totalWeight) / 10 : 0;
  return {
    userTargetTenths,
    teamTargetSum,
    displaySharePerHead,
    nSlots: slots.length,
    totalWeight
  };
}

module.exports = {
  equalShareSlotTargetsOneDecimal,
  computeEqualShareFromTeamsData
};
