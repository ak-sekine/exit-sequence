import { Game, intent } from '../src/game.ts'
import type { Stat } from '../src/model.ts'
// Shared deterministic policies; browser executes every resulting choice through touch.
export function nextAction(g: Game, build: Stat): string {
 const s = g.state
 switch(s.scene) {
 case 'wake': return 'begin'
 case 'create': case 'levelup': return build
 case 'explore': return !s.explored[s.location] ? 'explore' : 'forward'
 case 'warehouse': return build === 'BODY' ? 'wrench' : build === 'TECH' ? 'terminal' : 'visor'
 case 'victory': return 'continue'
 case 'event': return build
 case 'launch': return 'launch'
 case 'combat': {
 if(g.itemMenu) return s.hp <= s.maxHp-6 && s.items.kit ? 'kit' : s.items.battery ? 'battery' : 'back'
 const i=intent(s)!
 if(s.hp <= 5 && s.items.kit && i !== 'heavy' && i !== 'burst') return 'items'
 if(i === 'heavy' || i === 'burst') return 'defend'
 if(i === 'scan') return build === 'TECH' && !s.enemy!.lastTech ? 'tech' : 'observe'
 if(i === 'armor') return s.enemy!.exposed ? (s.bonus ? 'attack' : build === 'SENSE' ? 'observe' : 'attack') : s.enemy!.lastTech ? 'observe' : 'tech'
 if(build === 'SENSE' && !s.bonus) return 'observe'
 return build === 'TECH' && !s.enemy!.lastTech ? 'tech' : 'attack'
 }
 default: throw new Error(`No policy for ${s.scene}`)
 }
}
export function playBuild(build: Stat) {
 const game=new Game(), route: string[]=[], combats: {enemy:string;turns:number}[]=[]
 let turns=0, enemy=''
 for(let n=0;game.state.status==='playing' && n<150;n++) {
 if(game.state.enemy && !enemy) { enemy=game.state.enemy.id;turns=game.state.turns }
 const id=nextAction(game,build);route.push(id); if(!game.choose(id)) throw new Error(id)
 if(enemy && !game.state.enemy) {combats.push({enemy,turns:game.state.turns-turns});enemy=''}
 }
 return {game,route,combats}
}
