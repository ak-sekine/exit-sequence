export interface OutputHooks {
  onLineStart?: (text: string, lineIndex: number) => void
  onCharacter?: (character: string, text: string, lineIndex: number) => void
  onLineEnd?: (text: string, lineIndex: number) => void
  onImage?: (image: OutputImage, lineIndex: number) => void
}

export interface OutputText {
  type: 'text'
  text: string
}

export interface OutputImage {
  type: 'image'
  kind?: 'event' | 'prologue' | 'ending'
  eventId: string
  src: string
  alt: string
  width: number
  height: number
}

export type OutputItem = OutputText | OutputImage

export interface ConsoleOutputOptions {
  delayMs?: number
  reducedMotion?: boolean
  schedule?: (callback: () => void, delayMs: number) => unknown
  cancel?: (handle: unknown) => void
  onIdle?: () => void
}

interface PendingOutputItem {
  item: OutputItem
  text: string
  characters: string[]
  lineIndex: number
  hooks: OutputHooks
  cursor: number
  started: boolean
}

function splitGraphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), part => part.segment)
  }
  return Array.from(text)
}

export class ConsoleOutput {
  private readonly delayMs: number
  private readonly schedule: (callback: () => void, delayMs: number) => unknown
  private readonly cancel: (handle: unknown) => void
  private readonly onIdle?: () => void
  private queue: PendingOutputItem[] = []
  private timer: unknown = null
  private generation = 0
  private running = false
  private paused = false
  private draining = false
  private reducedMotion: boolean

  constructor(options: ConsoleOutputOptions = {}) {
    this.delayMs = options.delayMs ?? 10
    this.schedule = options.schedule ?? ((callback, delay) => globalThis.setTimeout(callback, delay))
    this.cancel = options.cancel ?? (handle => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>))
    this.onIdle = options.onIdle
    this.reducedMotion = options.reducedMotion ?? false
  }

  get isBusy(): boolean {
    return this.queue.length > 0
  }

  enqueue(lines: readonly string[], hooks: OutputHooks = {}): void {
    this.enqueueSequence(lines.map(text => ({ type: 'text', text })), hooks)
  }

  enqueueSequence(items: readonly OutputItem[], hooks: OutputHooks = {}): void {
    if (items.length === 0) return
    for (let lineIndex = 0; lineIndex < items.length; lineIndex++) {
      const item = items[lineIndex]!
      const text = item.type === 'text' ? item.text : ''
      this.queue.push({ item, text, characters: splitGraphemes(text), lineIndex, hooks, cursor: 0, started: false })
    }
    this.running = true
    if (this.reducedMotion) {
      this.drain()
    } else if (!this.paused) {
      this.writeLeadingImages()
      if (this.isBusy) this.scheduleNext()
      else this.finish()
    }
  }

  skip(): void {
    if (!this.isBusy) return
    this.cancelTimer()
    this.drain()
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return
    this.paused = paused
    if (paused) {
      this.cancelTimer()
    } else if (this.isBusy && !this.reducedMotion) {
      this.writeLeadingImages()
      if (this.isBusy) this.scheduleNext()
      else this.finish()
    }
  }

  setReducedMotion(reducedMotion: boolean): void {
    if (this.reducedMotion === reducedMotion) return
    this.reducedMotion = reducedMotion
    if (reducedMotion && this.isBusy) {
      this.cancelTimer()
      this.drain()
    }
  }

  stop(): void {
    this.generation++
    this.cancelTimer()
    this.queue = []
    this.running = false
    this.paused = false
  }

  private scheduleNext(): void {
    if (this.timer !== null || this.paused || !this.isBusy) return
    const generation = this.generation
    this.timer = this.schedule(() => {
      if (generation !== this.generation) return
      this.timer = null
      this.writeOneCharacter()
      this.writeLeadingImages()
      if (this.isBusy) this.scheduleNext()
      else this.finish()
    }, this.delayMs)
  }

  private writeOneCharacter(): void {
    const line = this.queue[0]
    if (!line) return
    if (line.item.type === 'image') {
      line.hooks.onImage?.(line.item, line.lineIndex)
      this.queue.shift()
      return
    }
    if (!line.started) {
      line.started = true
      line.hooks.onLineStart?.(line.text, line.lineIndex)
    }
    const character = line.characters[line.cursor]
    if (character !== undefined) {
      line.hooks.onCharacter?.(character, line.text, line.lineIndex)
      line.cursor++
    }
    if (line.cursor >= line.characters.length) {
      line.hooks.onLineEnd?.(line.text, line.lineIndex)
      this.queue.shift()
    }
  }

  private writeLeadingImages(): void {
    while (this.queue[0]?.item.type === 'image') this.writeOneCharacter()
  }

  private drain(): void {
    if (this.draining) return
    this.draining = true
    this.cancelTimer()
    while (true) {
      while (this.isBusy) this.writeOneCharacter()
      if (!this.running) break
      this.running = false
      this.onIdle?.()
      if (!this.isBusy) break
    }
    this.draining = false
  }

  private finish(): void {
    if (!this.running) return
    this.running = false
    this.onIdle?.()
  }

  private cancelTimer(): void {
    if (this.timer === null) return
    this.cancel(this.timer)
    this.timer = null
  }
}
