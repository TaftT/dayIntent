// Side-by-side lane layout for one day column of the week view. Columns are
// narrow, so overlapping blocks share the width (unlike the day view, which
// cascades them): each cluster of mutually-chained overlaps is split into as
// many lanes as it needs, and every block in the cluster gets that lane count.

/**
 * @param {{id: string, start: number, end: number}[]} blocks minutes since midnight
 * @returns {Map<string, {lane: number, lanes: number}>}
 */
export function computeLanes(blocks) {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end || a.id.localeCompare(b.id))
  const result = new Map()
  let cluster = []
  let clusterEnd = -Infinity
  let laneEnds = []

  const flush = () => {
    for (const b of cluster) result.get(b.id).lanes = laneEnds.length
    cluster = []
    laneEnds = []
  }

  for (const block of sorted) {
    if (block.start >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= block.start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = block.end
    result.set(block.id, { lane, lanes: 1 })
    cluster.push(block)
    clusterEnd = Math.max(clusterEnd, block.end)
  }
  flush()
  return result
}
