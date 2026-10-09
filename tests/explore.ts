import { explore } from './solver.ts'
import { writeFileSync } from 'node:fs'
const results = [0, 1, 2].map(stage => ({ stage: stage + 1, ...explore(stage) }))
console.log(JSON.stringify(results.map(({stage, visited, clearEndpoints, witnesses}) => ({ stage, visited, clearEndpoints, routes: Object.fromEntries(Object.entries(witnesses).map(([name, witness]) => [name, witness.route])) })), null, 2))
writeFileSync('/tmp/exit-sequence-search.json', JSON.stringify(results, null, 2) + '\n')
