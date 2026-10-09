import test from 'node:test'
import assert from 'node:assert/strict'
import { Game, narrative } from '../src/game.ts'
import { playBuild } from './routes.ts'
for(const lang of ['ja','en'] as const) test(`${lang} setting and ending keep unresolved mystery`,()=>{const prose=narrative(new Game().state,lang).join('\n');for(const pattern of lang==='ja'?[/月面/,/生存者.*一人/,/生命維持/,/地球/,/認識系/,/拘束/,/攻撃/,/事故原因.*不明/]:[/Moon/,/only survivor/,/Life support/,/Earth/,/recognition/,/restrain/,/attack/,/cause.*unknown/])assert.match(prose,pattern);const end=narrative(playBuild('SENSE').game.state,lang).join('');assert.match(end,/CLEAR/);assert.match(end,lang==='ja'?/生死.*原因.*不明/:/fate.*cause.*unknown/)})
