import test from 'node:test'
import assert from 'node:assert/strict'
import { initialLanguage, saveLanguage, LANGUAGE_STORAGE_KEY } from '../src/i18n.ts'
test('language preference persists; blocked storage falls back to browser language', () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const data = new Map<string, string>()
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => data.get(key), setItem: (key: string, value: string) => data.set(key, value) } })
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'ja-JP' } })
    assert.equal(initialLanguage(), 'ja'); saveLanguage('en'); assert.equal(data.get(LANGUAGE_STORAGE_KEY), 'en'); assert.equal(initialLanguage(), 'en')
    data.set(LANGUAGE_STORAGE_KEY, 'invalid'); assert.equal(initialLanguage(), 'ja')
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked') } })
    assert.equal(initialLanguage(), 'ja'); assert.doesNotThrow(() => saveLanguage('en'))
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { language: 'fr-FR' } }); assert.equal(initialLanguage(), 'en')
  } finally {
    if (storage) Object.defineProperty(globalThis, 'localStorage', storage); else Reflect.deleteProperty(globalThis, 'localStorage')
    if (nav) Object.defineProperty(globalThis, 'navigator', nav)
  }
})
