export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function arraysEqualUnordered(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  for (const x of b) if (!s.has(x)) return false;
  return true;
}

/**
 * Sample `target` questions from `pool` across the selected areas using
 * blueprint weights (largest-remainder allocation). Handles the case where
 * an area's filtered pool can't cover its quota by redistributing to
 * areas with surplus stock.
 *
 * @param {Array}  pool           filtered question objects
 * @param {number} target         desired count (capped at pool.length)
 * @param {Array}  selectedAreas  area names in play
 * @param {Array}  areaMetaAll    BUNDLE.meta.areas
 */
export function sampleByBlueprint(pool, target, selectedAreas, areaMetaAll) {
  if (target >= pool.length) return shuffle(pool);
  const areaMeta = areaMetaAll.filter(a => selectedAreas.includes(a.name));
  const totalWeight = areaMeta.reduce((s, a) => s + a.weight, 0) || 1;
  const byArea = {};
  areaMeta.forEach(a => {
    byArea[a.name] = { pool: pool.filter(q => q.area === a.name), quota: 0 };
  });

  const raw = areaMeta.map(a => ({ name: a.name, exact: (a.weight / totalWeight) * target }));
  raw.forEach(r => { byArea[r.name].quota = Math.floor(r.exact); });
  let assigned = raw.reduce((s, r) => s + Math.floor(r.exact), 0);
  const remainders = raw
    .map(r => ({ name: r.name, rem: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.rem - a.rem);
  let ri = 0;
  while (assigned < target && remainders.length > 0) {
    byArea[remainders[ri % remainders.length].name].quota++;
    assigned++; ri++;
  }

  let deficit = 0;
  areaMeta.forEach(a => {
    const b = byArea[a.name];
    if (b.quota > b.pool.length) { deficit += (b.quota - b.pool.length); b.quota = b.pool.length; }
  });
  while (deficit > 0) {
    const cand = areaMeta
      .map(a => ({ name: a.name, room: byArea[a.name].pool.length - byArea[a.name].quota }))
      .filter(x => x.room > 0)
      .sort((a, b) => b.room - a.room);
    if (cand.length === 0) break;
    byArea[cand[0].name].quota++;
    deficit--;
  }

  const picked = [];
  areaMeta.forEach(a => {
    const b = byArea[a.name];
    picked.push(...shuffle(b.pool).slice(0, b.quota));
  });
  return shuffle(picked);
}
