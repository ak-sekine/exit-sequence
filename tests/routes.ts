// Every route starts at START and uses ordinary choices, without State fixtures.
export const toolkit = ['open-supplies', 'take-light', 'take-tools', 'leave-supplies', 'resume-challenge']
export const lightRobot = ['prepare-robot', 'ready-light', 'stance-low', 'robot-cross', 'robot-result-continue']
export const toolSeal = ['prepare-seal', 'hold-pressure', 'patch-pipe', 'seal-to-act', 'equalise-pressure', 'open-airlock', 'seal-result-continue']
export const toolPower = ['prepare-power', 'source-blue', 'drive-tools', 'power-pulse', 'power-result-continue']
export const launch = ['board-ship', 'to-pressure', 'launch-lock', 'launch-equalise', 'pressure-to-electric', 'launch-disconnect', 'launch-arm', 'launch-ignite']

export const expert = [...toolkit, 'watch-robot', 'watch-to-prep', 'ready-light', 'stance-low', 'robot-cross', 'robot-result-continue',
  'watch-seal', 'seal-watch-prep', 'hold-pressure', 'patch-pipe', 'seal-to-act', 'equalise-pressure', 'open-airlock', 'seal-result-continue',
  'watch-power', 'power-watch-prep', 'source-blue', 'drive-tools', 'power-pulse', 'power-result-continue',
  'inspect-plate', 'plate-to-panel', ...launch.slice(1)]
export const remembered = [...toolkit, 'prepare-robot', 'ready-empty', 'stance-low', 'robot-gap', 'robot-result-continue', ...toolSeal, ...toolPower, ...launch]
export const newcomer = [...toolkit,
  'prepare-robot', 'ready-light', 'stance-upright', 'robot-cross', 'robot-result-retry',
  'watch-robot', 'watch-to-prep', 'ready-light', 'stance-low', 'robot-cross', 'robot-result-continue',
  'prepare-seal', 'seal-to-act', 'equalise-pressure', 'seal-result-retry', ...toolSeal,
  'prepare-power', 'source-blue', 'drive-hand', 'power-pulse', 'power-result-retry', ...toolPower,
  'board-ship', 'to-pressure', 'launch-equalise', 'launch-retry', 'to-pressure', 'launch-lock', 'launch-equalise',
  'pressure-to-electric', 'launch-disconnect', 'launch-arm', 'launch-ignite']
export const decoyRoute = ['open-supplies', 'take-decoy', 'take-tools', 'leave-supplies', 'resume-challenge',
  'watch-robot', 'watch-to-prep', 'ready-decoy', 'stance-quiet', 'robot-cross', 'robot-result-continue',
  'prepare-seal', 'hold-pressure', 'seal-to-act', 'equalise-pressure', 'open-airlock', 'seal-result-continue',
  ...toolPower, ...launch]
export const equipmentRoute = ['open-supplies', 'take-light', 'take-decoy', 'take-flask', 'leave-supplies', 'resume-challenge',
  ...lightRobot, 'watch-seal', 'seal-watch-prep', 'hold-pressure', 'feed-pipe', 'seal-to-act', 'equalise-pressure', 'open-airlock', 'seal-result-continue',
  'watch-power', 'power-watch-prep', 'source-blue', 'drive-decoy', 'power-pulse', 'power-result-continue',
  'inspect-plate', 'plate-to-panel', ...launch.slice(1)]
export const manualRoute = [...toolkit, ...lightRobot, ...toolSeal, 'prepare-power', 'source-blue', 'drive-hand', 'power-hold', 'power-result-continue', ...launch]
export const refillRoute = [...toolkit.slice(0, 3), 'take-flask', ...toolkit.slice(3), ...lightRobot, ...toolSeal, ...toolPower,
  'board-ship', 'ship-refill', ...launch.slice(1)]

export const recklessRobot = ['prepare-robot', 'ready-empty', 'stance-upright', 'robot-cross']
export const injuryOver = ['start-without-kit', ...recklessRobot, 'robot-result-retry', ...recklessRobot, 'robot-result-retry', ...recklessRobot]
export const badSeal = ['prepare-seal', 'seal-to-act', 'open-airlock']
export const oxygenOver = [...toolkit, ...lightRobot, ...badSeal, 'seal-result-retry', ...badSeal, 'seal-result-retry',
  ...badSeal, 'seal-result-retry', ...badSeal, 'seal-result-retry', ...badSeal]
export const launchOver = [...toolkit, ...lightRobot, ...toolSeal, ...toolPower, 'board-ship', 'to-electric', 'launch-ignite', 'force-ignition']
