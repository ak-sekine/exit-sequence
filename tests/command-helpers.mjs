export const click = (page, id) => page.locator(`[data-command="${id}"]`).tap()
export async function moveCommand(page, action) {
  if (await page.locator('[data-command="move"]').isDisabled()) return
  await click(page, 'move')
  await click(page, { up: 'forward', down: 'turnBack', left: 'turnLeft', right: 'turnRight' }[action])
}
export async function toggleMap(page) {
  if (await page.locator('[data-command="close"]').count()) await click(page, 'close')
  else { await click(page, 'items'); await click(page, 'itemMap') }
}
export async function passDoorCommand(page) {
  if (await page.locator('[data-command="inspect"]').isDisabled()) return
  await click(page, 'inspect')
  if (await page.locator('[data-command="door"]').count()) { await click(page, 'door'); await click(page, 'yes') }
  else await click(page, 'back')
}
