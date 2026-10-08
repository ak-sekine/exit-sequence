import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, narrative } from '../src/game.ts';
import { scenes, clues } from '../src/scenario.ts';
import { expert, hinted, mistaken, door, valve, power } from './routes.ts';
function play(route: string[], g = new Game()) { for (const id of route)
    assert.ok(g.choose(id), `${id} at ${g.state.scene}`); return g; }
test('door: visible anomaly, direct cause, equal pressure then opening', () => {
    const g = play(['begin']);
    assert.match(narrative(g.state, 'ja').join(''), /モーター.*扉.*止まる.*高い.*低い/);
    play(['door-inspect', 'door-deeper'], g);
    assert.match(narrative(g.state, 'ja').join(''), /押し戻/);
    assert.equal(g.state.problems.door.observation, 2);
    const changed = g.choose('equalize')!;
    assert.match(changed.result.ja, /同じ.*まだ閉じ/);
    assert.equal(g.state.problems.door.resolution, 'changed');
    g.choose('door-open');
    assert.equal(g.state.problems.door.resolution, 'resolved');
});
test('valve: hidden initially, actual ice on inspection, force leaves cause intact, heat then movement', () => {
    const g = play(door);
    assert.doesNotMatch(narrative(g.state, 'ja').join(''), /氷/);
    const closed = structuredClone(g.state);
    g.choose('valve-inspect');
    assert.match(narrative(g.state, 'ja').join(''), /軸.*氷.*氷に当た/);
    play(['valve-deeper'], g);
    const before = structuredClone(g.state.problems.valve);
    const wrong = g.choose('valve-force')!;
    assert.match(wrong.result.ja, /氷もそのまま/);
    assert.deepEqual(g.state.problems.valve, before);
    const heated = g.choose('valve-heat')!;
    assert.match(heated.result.ja, /水滴.*まだ押していない/);
    assert.equal(g.state.problems.valve.resolution, 'changed');
    g.choose('valve-turn');
    assert.equal(g.state.problems.valve.resolution, 'resolved');
    assert.equal(closed.problems.valve.observation, 0);
});
test('power: overload explains simultaneous load, both solutions work, restart alone changes nothing', () => {
    for (const solution of ['power-stop', 'power-order']) {
        const g = play([...door, ...valve]);
        assert.match(narrative(g.state, 'en').join(''), /OVERLOAD.*together/s);
        play(['power-inspect', 'power-deeper'], g);
        assert.match(narrative(g.state, 'ja').join(''), /一台ずつ.*二台同時|二台同時.*一台ずつ/);
        const before = structuredClone(g.state);
        const wrong = g.choose('power-retry')!;
        assert.deepEqual(g.state, before);
        assert.match(wrong.result.en, /still running together/);
        const solved = g.choose(solution)!;
        assert.match(solved.result.en, /breaker holds/);
        g.choose('leave');
        assert.equal(g.state.status, 'clear');
    }
});
test('zero hints, all final hints, and recoverable mistakes CLEAR in both languages', () => {
    for (const route of [expert, hinted, mistaken]) {
        const games = [new Game(), new Game()];
        for (const id of route) {
            games.forEach((g, i) => { const before = structuredClone(g.state); narrative(g.state, i === 0 ? 'ja' : 'en'); assert.deepEqual(g.state, before); assert.ok(g.choose(id)); });
            assert.deepEqual(games[0].state, games[1].state);
        }
        assert.equal(games[0].state.status, 'clear');
        for (const p of Object.values(games[0].state.problems)) {
            assert.equal(p.resolution, 'resolved');
            assert.equal(p.hintLevel, route === hinted ? 3 : 0);
        }
    }
});
test('hints retain stages, reveal observable evidence, never damage state or auto-resolve', () => {
    const g = play(['begin']);
    const before = structuredClone(g.state);
    g.choose('door-hint-door');
    assert.equal(g.state.problems.door.hintLevel, 1);
    assert.equal(g.state.problems.door.resolution, before.problems.door.resolution);
    assert.deepEqual(g.state.problems.valve, before.problems.valve);
    const second = g.choose('door-hint-door')!;
    assert.match(second.result.ja, /点検窓.*矢印/s);
    assert.equal(g.state.scene, 'door-cause');
    g.choose('door-hint-door-cause');
    assert.equal(g.state.problems.door.hintLevel, 3);
    assert.equal(g.choose('door-hint-door-cause'), null);
    assert.equal(g.state.problems.door.resolution, 'unresolved');
    for (const [id, c] of Object.entries(clues)) {
        assert.equal(c.hints.length, 3);
        assert.match(c.hints[2].ja, /AI：/);
        assert.match(c.hints[2].en, /AI:/);
        assert.ok(id);
    }
});
test('invalid actions, snapshots, restart and finite legal exploration of every scene/choice', () => {
    const g = new Game(), initial = structuredClone(g.state);
    assert.equal(g.choose('valve-heat'), null);
    assert.deepEqual(g.state, initial);
    const transition = g.choose('begin')!;
    transition.after.problems.door.hintLevel = 3;
    assert.equal(g.state.problems.door.hintLevel, 0);
    g.restart();
    assert.deepEqual(g.state, initial);
    const queue = [initial], seen = new Set<string>(), actions = new Set<string>(), visited = new Set<string>();
    while (queue.length) {
        const state = queue.pop()!, key = JSON.stringify(state);
        if (seen.has(key))
            continue;
        seen.add(key);
        visited.add(state.scene);
        const branch = new Game();
        branch.state = state;
        const choices = branch.choices();
        if (state.status === 'playing')
            assert.ok(choices.length >= 1 && choices.length <= 4);
        for (const c of choices) {
            actions.add(c.id);
            const next = new Game();
            next.state = structuredClone(state);
            assert.ok(next.choose(c.id));
            queue.push(next.state);
        }
    }
    assert.deepEqual(Object.keys(scenes).filter(id => !visited.has(id)), []);
    assert.deepEqual(Object.values(scenes).flatMap(s => s.choices).filter(c => !actions.has(c.id)), []);
    for (const s of Object.values(scenes))
        for (const c of s.choices) {
            assert.ok(scenes[c.next]);
            assert.ok(c.label.ja && c.label.en);
        }
});
