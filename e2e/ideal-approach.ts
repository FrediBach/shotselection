import { expect, type Page } from '@playwright/test'
import type { PreparedRound } from '../src/engine/types'

export async function observePreparedRound(page: Page) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker
    class ObservedWorker extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        this.addEventListener('message', event => {
          if (event.data.result?.scenario && event.data.result?.balls) {
            Object.assign(window, { idealApproachPrepared: event.data.result })
          }
        })
      }
    }
    Object.assign(window, { Worker: ObservedWorker })
  })
}

export async function expectIdealApproach(page: Page, label: 'A' | 'B' | 'C', ballId = 1) {
  const prepared = await page.evaluate(() => (window as Window & { idealApproachPrepared: PreparedRound }).idealApproachPrepared)
  const option = prepared.balls.find(ball => ball.ballId === ballId)!.options.find(option => option.label === label)!
  const path = page.getByTestId('ideal-approach-path')
  await expect(page.getByRole('img', { name: `Ideal cue-ball path to ball ${ballId}, stroke ${label}`, exact: true })).toBeVisible()
  await expect(path).toHaveAttribute('data-option-id', option.id)
  await expect(path).toHaveAttribute('data-ball-id', String(ballId))
  await expect(path).toHaveAttribute('points', option.cueApproachPath.map(point => `${point.x * 100},${point.y * 100}`).join(' '))
  await expect(page.getByLabel('Table legend', { exact: true })).toContainText(`Ideal path · ${label}`)
}
