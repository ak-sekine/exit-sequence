import { readFileSync } from 'node:fs'

const catalogPath = new URL('../docs/event-catalog.json', import.meta.url)
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const errors = []
const check = (condition, message) => { if (!condition) errors.push(message) }
const events = catalog.events ?? []
const byId = new Map()
const names = new Set()
const zoneNames = { 1: '最深部', 2: '廃棄物処理区画', 3: '生産・整備区画', 4: '管理・保守区画', 5: '地上接続区画' }

check(catalog.status === 'phase-2-design-only' && catalog.runtimeReady === false,
  'Phase 2 summary must remain design-only and separate from runtime events.')
check(events.length === 200, `Expected 200 events, got ${events.length}.`)
for (const event of events) {
  check(typeof event.id === 'string' && event.id.length > 0, 'Every event needs a final ID.')
  if (byId.has(event.id)) errors.push(`Duplicate event ID: ${event.id}`)
  else byId.set(event.id, event)
  if (names.has(event.name)) errors.push(`Duplicate event name: ${event.name}`)
  names.add(event.name)
  check(event.name && event.what && event.distinctive && event.causalExplanation, `Incomplete event design fields: ${event.id}`)
  check(Array.isArray(event.actionDirections) && event.actionDirections.length === 3 && event.actionDirections.every(Boolean)
    && new Set(event.actionDirections).size === 3,
    `Event needs three action directions: ${event.id}`)
  check(event.phase3Status === '未制作', `Phase 3 body status must remain unfinished: ${event.id}`)
  check(event.zone >= 1 && event.zone <= 5, `Invalid zone for ${event.id}`)
  check(['normal', 'linked'].includes(event.category), `Invalid category for ${event.id}`)
}

const guaranteeCounts = new Map()
for (const zone of [1, 2, 3, 4, 5]) {
  const list = events.filter(event => event.zone === zone)
  const normal = list.filter(event => event.category === 'normal')
  const linked = list.filter(event => event.category === 'linked')
  const drawableNormal = normal.filter(event => event.requires.length === 0 && !event.guarantee.needed)
  check(list.length === 40, `Zone ${zone} (${zoneNames[zone]}) has ${list.length}, expected 40.`)
  check(drawableNormal.length >= 20, `Zone ${zone} has only ${drawableNormal.length} unconditional normal candidates.`)
  check(normal.length === 30, `Zone ${zone} has ${normal.length} normal events, expected 30.`)
  check(linked.length === 10, `Zone ${zone} has ${linked.length} linked events, expected 10.`)
  const guaranteed = linked.filter(event => event.guarantee.needed)
  guaranteeCounts.set(zone, guaranteed.length)
  check(guaranteed.length <= 20, `Zone ${zone} has ${guaranteed.length} potential reservations, above the 20-tile capacity.`)
}

const itemIds = new Set(catalog.items.map(x => x.id))
const facilityIds = new Set(catalog.facilities.map(x => x.id))
const npcIds = new Set(catalog.npcs.map(x => x.id))
const informationTagIds = new Set((catalog.informationTags ?? []).map(x => x.id))
const itemById = new Map(catalog.items.map(x => [x.id, x]))
const facilityById = new Map(catalog.facilities.map(x => [x.id, x]))
const npcById = new Map(catalog.npcs.map(x => [x.id, x]))
const edges = new Map(events.map(event => [event.id, [...event.followUpEventIds]]))
for (const event of events) {
  for (const key of ['relatedEventIds', 'followUpEventIds']) {
    for (const targetId of event[key] ?? []) check(byId.has(targetId), `Undefined event reference ${targetId} from ${event.id}.`)
  }
  for (const resource of event.linkedResources ?? []) {
    const [type, id] = resource.split(':', 2)
    if (type === 'item') check(itemIds.has(id), `Undefined item ${id} from ${event.id}.`)
    if (type === 'facility') check(facilityIds.has(id), `Undefined facility ${id} from ${event.id}.`)
    if (type === 'npc') check(npcIds.has(id), `Undefined NPC ${id} from ${event.id}.`)
    if (type === 'info') check(informationTagIds.has(id), `Undefined information tag ${id} from ${event.id}.`)
  }
  for (const condition of [...(event.requires ?? []), ...(event.requiresAny ?? []).flat()]) {
    if (condition.kind === 'item') check(itemIds.has(condition.id), `Undefined required item ${condition.id} from ${event.id}.`)
    if (condition.kind === 'facility') check(facilityIds.has(condition.id), `Undefined required facility ${condition.id} from ${event.id}.`)
    if (condition.kind === 'npc-status') check(npcIds.has(condition.id), `Undefined required NPC ${condition.id} from ${event.id}.`)
    if (!['item', 'facility', 'npc-status', 'history-tag'].includes(condition.kind)) errors.push(`Unknown condition kind in ${event.id}.`)
  }
  if (event.category === 'linked') {
    check(event.linkedResources.length > 0, `Linked event has no linked resource: ${event.id}`)
    check(event.condition && event.guarantee.reason, `Linked event needs conditions and guarantee policy: ${event.id}`)
  }
  for (const targetId of event.followUpEventIds ?? []) {
    const target = byId.get(targetId)
    if (target) check(target.zone > event.zone, `Follow-up ${targetId} must be in a later zone than ${event.id}.`)
    if (target) check(target.relatedEventIds.includes(event.id), `Follow-up ${targetId} must record ${event.id} as a dependency source.`)
  }
  for (const sourceId of event.relatedEventIds ?? []) {
    const source = byId.get(sourceId)
    if (source) check(source.zone < event.zone, `Dependency source ${sourceId} must precede ${event.id} by zone.`)
    if (source) check(source.followUpEventIds.includes(event.id), `Dependency source ${sourceId} must list ${event.id} as a follow-up.`)
  }
  if (event.guarantee?.needed) check((event.requires?.length ?? 0) > 0 || (event.requiresAny?.length ?? 0) > 0,
    `Guaranteed event ${event.id} has no machine-readable trigger condition.`)
  const conditionSets = [
    ...(event.requires?.length ? [event.requires] : []),
    ...(event.requiresAny ?? []),
  ]
  for (const set of conditionSets) for (const condition of set) {
    const sourceIds = event.relatedEventIds ?? []
    let producerIds = []
    if (condition.kind === 'item') producerIds = [itemById.get(condition.id)?.acquireEventId].filter(Boolean)
    if (condition.kind === 'facility') producerIds = facilityById.get(condition.id)?.setEventIds ?? []
    if (condition.kind === 'npc-status') producerIds = [npcById.get(condition.id)?.firstEventId].filter(Boolean)
    if (condition.kind === 'history-tag') {
      const facilityProducers = facilityById.get(condition.id)?.setEventIds
      producerIds = facilityProducers ?? sourceIds.filter(sourceId => {
        const source = byId.get(sourceId)
        return source?.stateChange.includes(`history:${condition.id}`) || source?.stateChange.includes(`${condition.id}タグ`)
      })
    }
    check(producerIds.length > 0 && producerIds.every(producerId => sourceIds.includes(producerId)),
      `Trigger ${condition.kind}:${condition.id} for ${event.id} does not align with all declared earlier state sources.`)
  }
}

// A zone-wide upper bound is conservative: even if every guarantee condition
// becomes true together, reservations remain within the 20-tile capacity.
const maxSimultaneousReservations = Math.max(...guaranteeCounts.values())
check(maxSimultaneousReservations <= catalog.gameRules.tilesPerZone,
  `Maximum simultaneous reservations ${maxSimultaneousReservations} exceeds a zone.`)

const visiting = new Set()
const visited = new Set()
function visit(id) {
  if (visiting.has(id)) { errors.push(`Dependency cycle includes ${id}.`); return }
  if (visited.has(id)) return
  visiting.add(id)
  for (const next of edges.get(id) ?? []) if (byId.has(next)) visit(next)
  visiting.delete(id)
  visited.add(id)
}
for (const id of byId.keys()) visit(id)

check(catalog.npcs.length >= 9 && catalog.npcs.length <= 11, `Expected about 10 NPCs, got ${catalog.npcs.length}.`)
for (const npc of catalog.npcs) {
  check(npcIds.has(npc.id), `Duplicate NPC ID: ${npc.id}`)
  const first = byId.get(npc.firstEventId)
  check(first?.linkedResources.includes(`npc:${npc.id}`), `NPC ${npc.id} has an undefined first appearance.`)
  check(npc.revisitEventIds.length >= 1 && npc.revisitEventIds.length <= 2, `NPC ${npc.id} needs one or two later appearances.`)
  const expectedStatus = `${npc.id}=rescued`
  check(first?.stateChange.includes(expectedStatus), `NPC rescue success status does not match ${npc.id}.`)
  for (const revisitId of npc.revisitEventIds) {
    const revisit = byId.get(revisitId)
    check(revisit?.linkedResources.includes(`npc:${npc.id}`), `NPC ${npc.id} revisit does not reference the same NPC.`)
    check(revisit?.condition.includes(expectedStatus), `NPC ${npc.id} revisit condition does not match rescue state.`)
    check(revisit?.guarantee.needed, `Important NPC revisit ${revisitId} must be guaranteed after rescue.`)
    check(revisit?.relatedEventIds.includes(npc.firstEventId), `NPC revisit ${revisitId} must point back to its first appearance.`)
    check(npc.failureHandling.includes('救出前提の感謝文は出さない'), `NPC ${npc.id} needs explicit unsuccessful-rescue handling.`)
  }
}

check(catalog.gameRules.inventoryCapacity === 3, 'Inventory capacity must be three.')
for (const item of catalog.items) {
  const acquire = byId.get(item.acquireEventId)
  const use = byId.get(item.useEventId)
  check(acquire?.zone < use?.zone, `Item ${item.id} must have a later use opportunity.`)
  check(acquire?.stateChange.includes(item.id), `Item ${item.id} is not acquired by its declared event.`)
  check(use?.linkedResources.includes(`item:${item.id}`), `Item ${item.id} is not referenced by its declared use event.`)
  check(use?.guarantee.needed, `Item ${item.id} needs a guaranteed later use opportunity.`)
  check(acquire?.followUpEventIds.includes(item.useEventId), `Item ${item.id} acquisition must link to its declared use event.`)
  check(typeof item.reusable === 'boolean', `Item ${item.id} must be marked reusable or consumable.`)
  check(item.capacityPlan, `Item ${item.id} needs a capacity plan.`)
}
const inventoryAtRisk = []
let carriedItems = []
for (const zone of [1, 2, 3, 4, 5]) {
  carriedItems.push(...catalog.items.filter(item => byId.get(item.acquireEventId)?.zone === zone).map(item => item.id))
  if (carriedItems.length > catalog.gameRules.inventoryCapacity) inventoryAtRisk.push(`Zone ${zone} pickup stage: ${carriedItems.length}`)
  for (const item of catalog.items.filter(candidate => byId.get(candidate.useEventId)?.zone === zone && !candidate.reusable)) {
    carriedItems = carriedItems.filter(id => id !== item.id)
  }
}
check(inventoryAtRisk.length === 0, `Planned item sequence exceeds capacity ${catalog.gameRules.inventoryCapacity}: ${inventoryAtRisk.join(', ')}.`)
for (const facility of catalog.facilities) {
  const follow = byId.get(facility.followUpEventId)
  const setters = (facility.setEventIds ?? []).map(id => byId.get(id))
  check(Boolean(setters.length && follow && setters.every(set => set && set.zone < follow.zone)),
    `Facility ${facility.id} must have earlier state sources and a later, reachable follow-up.`)
}
for (const info of catalog.informationTags ?? []) {
  const set = byId.get(info.setEventId)
  const follow = byId.get(info.followUpEventId)
  check(Boolean(set && follow && set.zone < follow.zone && set.followUpEventIds.includes(follow.id)),
    `Information tag ${info.id} must connect an earlier source to a later use.`)
}

if (errors.length) {
  console.error(`Phase 2 catalog validation failed (${errors.length}):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('Phase 2 structural validation passed: 200 unique events; 5 zones x 40; 30 normal + 10 linked each;')
  console.log(`unconditional normal candidates >= 30 per zone; max possible guarantees ${maxSimultaneousReservations}/20;`)
  console.log(`${catalog.npcs.length} NPCs; ${catalog.items.length} items; ${catalog.facilities.length} facility links; dependency graph acyclic.`)
  console.log('Scope: structure, references, forward ordering, reservations, and declared conditions only; no runtime-state exhaustive proof.')
}
