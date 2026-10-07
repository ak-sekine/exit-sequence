import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { messages, taskConfirmations, roomDescriptions, t } from '../src/i18n.ts'
import { Game, taskInfo } from '../src/game.ts'
import { rooms } from '../src/map.ts'

const japanese = /[\u3040-\u30ff\u3400-\u9fff]/u
// These existing keys are deliberately rewritten narrative or AI scene text.
// Every other existing message remains byte-for-byte identical to main 5e4d301.
const narrativeKeys = new Set([
  'repairInvestigationMissing', 'launchInvestigationMissing', 'introDamage', 'introRequirements',
  'suitPowerDepleted', 'robotEncounter', 'encounterInstructions', 'passageClosed',
  'walkedUnderEmergencyLightsUsingSuitLife', 'passageLightsAreOffUsedSuitLighting', 'debrisBlocksTheWayUsedPowerAssistance',
  'repairPartsMissing', 'requirementsMissing', 'repairPartsCollectedUseThemInMaintenance',
  'theReturnShipHasLeftTheMoon', 'aiDeparturePreparationsCompleteWeCanDeal', 'foodCollectedKeepItUntilDeparture',
  'repairPartsUsedHullRepairsComplete', 'hidingBehindCover', 'forcingPastTheSafetyRobot',
  'successAvoidedTheSafetyRobot', 'failureUsedSuitProtectionToEscape',
  'descriptionHabitation', 'descriptionMedical', 'descriptionObservation', 'descriptionResearch',
  'descriptionMaintenance', 'descriptionStorage', 'descriptionControl', 'descriptionPower', 'descriptionLaunch',
  'checkedTarget', 'movementResult',
])
const newKeys = new Set(['powerSwitchResult', 'controlUnlockResult', 'batteryConnectedResult', 'observationShutdownResult', 'forceSuccess', 'forceFailure', 'fleeResult'])
test('UI labels, HELP, STATUS, CAMERA and numerical messages retain pre-writing text in ja/en', () => {
  const information = Object.entries(messages).filter(([key]) => !narrativeKeys.has(key) && !newKeys.has(key))
  assert.equal(createHash('sha256').update(JSON.stringify(information)).digest('hex'), '9744e1d29834a87620a5179eceaf568c0e04ebaed5731b63631bdd2951533b48')
})

test('all room and Task narrative units exist in both languages without language leakage', () => {
  for (const language of ['ja', 'en'] as const) {
    const descriptions = roomDescriptions(language), tasks = taskConfirmations(language)
    assert.deepEqual(Object.keys(descriptions).sort(), [...rooms].sort())
    assert.deepEqual(Object.keys(tasks), Object.keys(taskInfo))
    for (const [index, room] of rooms.entries()) {
      const text = descriptions[room]
      assert.ok(text.trim())
      assert.ok(text.split('\n').length >= 2 && text.split('\n').length <= 4)
      if (language === 'en') assert.ok(!japanese.test(text))
      else { assert.ok(japanese.test(text)); assert.ok(!text.includes(roomDescriptions('en')[rooms[index]!])) }
    }
    for (const task of Object.keys(taskInfo) as (keyof typeof taskInfo)[]) {
      for (const text of Object.values(tasks[task])) {
        assert.ok(text.trim(), `${language} ${task}`)
        if (language === 'en') assert.ok(!japanese.test(text), text)
        else assert.ok(japanese.test(text), text)
      }
      assert.match(tasks[task].question, language === 'ja' ? /か？$/ : /\?$/)
      assert.ok(tasks[task].question.length <= 30)
      if (language === 'ja') {
        for (const english of Object.values(taskConfirmations('en')[task])) assert.ok(!Object.values(tasks[task]).some(text => text.includes(english)))
      }
    }
  }
})

test('AI speech has a distinct localized prefix even inside multi-line scenes', () => {
  for (const [key, message] of Object.entries(messages)) for (const language of ['ja', 'en'] as const) {
    for (const line of message[language].split('\n')) {
      if (line.startsWith('AI') && !['ai', 'aiMenu', 'aiStatus', 'cameraInput'].includes(key)) {
        assert.ok(line.startsWith(language === 'ja' ? 'AI：' : 'AI:'), line)
      }
    }
  }
  for (const language of ['ja', 'en'] as const) {
    assert.ok(t('introDamage', language).startsWith(language === 'ja' ? 'AI：' : 'AI:'))
    assert.ok(t('encounterInstructions', language).startsWith(language === 'ja' ? 'AI：' : 'AI:'))
    assert.match(t('suitPowerDepleted', language), language === 'ja' ? /\nAI：/ : /\nAI:/)
  }
})

test('Task achievements and ending labels stay explicit after the scene; fatal cost skips success text', () => {
  for (const language of ['ja', 'en'] as const) {
    const fixture = () => {
      const game = new Game(() => 0.99)
      game.state.enemy = '研究'
      return game
    }
    for (const task of ['power', 'control', 'repair', 'food'] as const) {
      const game = fixture(); game.state.location = taskInfo[task].room
      if (task === 'repair') game.state.items = ['修理部品']
      const log = game.act({ type: 'task', task }, language)
      assert.ok(log.some(line => line.startsWith(t('returnRequirementMet', language))))
      assert.ok(log.some(line => line.startsWith('ENERGY -')))
      assert.equal(game.state.conditions[task], true)
    }
    const over = fixture(); over.state.energy = 1; over.state.location = '研究'
    const overLog = over.act({ type: 'task', task: 'parts' }, language)
    assert.equal(overLog.at(-1), 'GAME OVER')
    assert.ok(overLog[overLog.length - 2]!.includes(language === 'ja' ? 'AI：' : 'AI:'))
    assert.ok(!overLog.includes(t('repairPartsCollectedUseThemInMaintenance', language)))
    const clear = fixture(); clear.state.location = '発着'; clear.state.conditions = { power: true, control: true, repair: true, food: true }
    const clearLog = clear.act({ type: 'task', task: 'launch' }, language)
    assert.equal(clearLog.at(-1), 'GAME CLEAR')
    assert.ok(clearLog.includes(t('theReturnShipHasLeftTheMoon', language)))
    assert.ok(clearLog.includes(t('aiDeparturePreparationsCompleteWeCanDeal', language)))
  }
})
