import test from 'node:test'
import assert from 'node:assert/strict'
import { ConsoleOutput, type ConsoleOutputOptions } from '../src/console-output.ts'

class ManualClock {
  private nextId = 1
  readonly jobs = new Map<number, { callback: () => void; delay: number; canceled: boolean }>()

  readonly options: Pick<ConsoleOutputOptions, 'schedule' | 'cancel'> = {
    schedule: (callback, delay) => {
      const id = this.nextId++
      this.jobs.set(id, { callback, delay, canceled: false })
      return id
    },
    cancel: handle => {
      const job = this.jobs.get(handle as number)
      if (job) job.canceled = true
    },
  }

  step(): void {
    const next = [...this.jobs.entries()].find(([, job]) => !job.canceled)
    assert.ok(next, 'a character timer should be queued')
    const [id, job] = next
    this.jobs.delete(id)
    assert.equal(job.delay, 10)
    job.callback()
  }

  fireEvenIfCanceled(id: number): void {
    this.jobs.get(id)?.callback()
  }
}

function output(clock: ManualClock, options: Omit<ConsoleOutputOptions, 'schedule' | 'cancel'> = {}): ConsoleOutput {
  return new ConsoleOutput({ ...clock.options, ...options })
}

test('writes one grapheme per tick and preserves line order', () => {
  const clock = new ManualClock()
  const output = new ConsoleOutput({ ...clock.options, delayMs: 10 })
  const lines: string[] = []
  let current = ''
  output.enqueue(['Aか\u3099', '二行目'], {
    onLineStart: () => { current = '' },
    onCharacter: character => { current += character },
    onLineEnd: () => { lines.push(current) },
  })

  assert.equal(output.isBusy, true)
  clock.step()
  assert.equal(current, 'A')
  clock.step()
  assert.equal(current, 'Aか\u3099')
  clock.step()
  assert.deepEqual(lines, ['Aか\u3099'])
  assert.equal(current, '二')
  clock.step()
  assert.equal(current, '二行')
  while (output.isBusy) clock.step()
  assert.deepEqual(lines, ['Aか\u3099', '二行目'])
})

test('inserts images between text immediately and exactly once when output is skipped', () => {
  const clock = new ManualClock()
  const typer = output(clock)
  const order: string[] = []
  const image = { type: 'image' as const, eventId: 'bulkhead', src: '/events/bulkhead.svg', alt: '隔壁', width: 320, height: 200 }
  typer.enqueueSequence([
    { type: 'text', text: '見出し' },
    image,
    { type: 'text', text: '説明' },
  ], {
    onCharacter: character => order.push(character),
    onImage: inserted => order.push(`image:${inserted.eventId}`),
  })

  clock.step()
  assert.deepEqual(order, ['見'])
  typer.skip()
  assert.deepEqual(order, ['見', '出', 'し', 'image:bulkhead', '説', '明'])
  assert.equal(order.filter(item => item === 'image:bulkhead').length, 1)
  assert.equal(typer.isBusy, false)
})

test('image entries do not receive character-by-character output', () => {
  const clock = new ManualClock()
  const typer = output(clock)
  const order: string[] = []
  typer.enqueueSequence([
    { type: 'text', text: 'A' },
    { type: 'image', eventId: 'battery', src: '/events/battery.svg', alt: '蓄電池', width: 320, height: 200 },
    { type: 'text', text: 'B' },
  ], {
    onCharacter: character => order.push(character),
    onImage: image => order.push(`image:${image.eventId}`),
  })

  clock.step()
  assert.deepEqual(order, ['A', 'image:battery'])
  clock.step()
  assert.deepEqual(order, ['A', 'image:battery', 'B'])
})

test('prologue images retain their own kind and are emitted once when skipped', () => {
  const clock = new ManualClock()
  const typer = output(clock)
  const emitted: string[] = []
  typer.enqueueSequence([
    { type: 'text', text: '導入' },
    { type: 'image', kind: 'prologue', eventId: 'prologue', src: '/story/prologue.svg', alt: '落下', width: 320, height: 200 },
  ], { onImage: image => emitted.push(`${image.kind}:${image.eventId}`) })
  clock.step()
  typer.skip()
  assert.deepEqual(emitted, ['prologue:prologue'])
})

test('skip drains queued output immediately without touching game state', () => {
  const clock = new ManualClock()
  const state = { position: 3, power: 15, randomDraws: 4 }
  const outputText: string[] = []
  let becameIdle = 0
  const typer = new ConsoleOutput({ ...clock.options, onIdle: () => { becameIdle++ } })
  typer.enqueue(['[ACTION] 選択', '[STATUS] 電力 15 / 20'], {
    onCharacter: character => outputText.push(character),
  })

  clock.step()
  const unchangedState = structuredClone(state)
  typer.skip()
  assert.equal(typer.isBusy, false)
  assert.equal(outputText.join(''), '[ACTION] 選択[STATUS] 電力 15 / 20')
  assert.deepEqual(state, unchangedState)
  assert.equal(becameIdle, 1)
})

test('enqueued text appends once and previously displayed lines are not replayed', () => {
  const clock = new ManualClock()
  const typer = output(clock)
  const emitted: string[] = []
  typer.enqueue(['old'])
  for (let index = 0; index < 3; index++) clock.step()
  typer.skip()
  typer.enqueue(['new'], { onCharacter: character => emitted.push(character) })
  typer.skip()
  assert.equal(emitted.join(''), 'new')
})

test('skip also completes choice text queued after the current log batch', () => {
  const clock = new ManualClock()
  let choice = ''
  const typer = new ConsoleOutput({
    ...clock.options,
    onIdle: () => {
      if (choice.length === 0) typer.enqueue(['[1] 行動'], { onCharacter: character => { choice += character } })
    },
  })
  typer.enqueue(['[EVENT] 発電設備'])
  typer.skip()
  assert.equal(choice, '[1] 行動')
  assert.equal(typer.isBusy, false)
})

test('pause and resume keep the current character position', () => {
  const clock = new ManualClock()
  const typer = output(clock)
  const emitted: string[] = []
  typer.enqueue(['ABC'], { onCharacter: character => emitted.push(character) })
  clock.step()
  typer.setPaused(true)
  assert.equal(emitted.join(''), 'A')
  assert.equal([...clock.jobs.values()].some(job => !job.canceled), false)
  typer.setPaused(false)
  clock.step()
  assert.deepEqual(emitted, ['A', 'B'])
  typer.skip()
  assert.deepEqual(emitted, ['A', 'B', 'C'])
})

test('reduced motion displays all queued text synchronously', () => {
  const clock = new ManualClock()
  const typer = output(clock, { reducedMotion: true })
  const emitted: string[] = []
  typer.enqueue(['一行', '二行'], { onCharacter: character => emitted.push(character) })
  assert.equal(typer.isBusy, false)
  assert.equal(emitted.join(''), '一行二行')
  assert.equal([...clock.jobs.values()].some(job => !job.canceled), false)
})

test('restart stops stale scheduled output before beginning another run', () => {
  const clock = new ManualClock()
  const typer = output(clock)
  const emitted: string[] = []
  typer.enqueue(['OLD'], { onCharacter: character => emitted.push(character) })
  const pending = [...clock.jobs.entries()][0]!
  typer.stop()
  clock.fireEvenIfCanceled(pending[0])
  typer.enqueue(['NEW'], { onCharacter: character => emitted.push(character) })
  typer.skip()
  assert.equal(emitted.join(''), 'NEW')
})
