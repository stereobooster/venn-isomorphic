import { createRequire } from 'node:module'

import type * as Venn from '@upsetjs/venn.js'
import type * as D3 from 'd3'
import {
  type Browser,
  type BrowserType,
  chromium,
  type LaunchOptions,
  type Page
} from 'playwright-core'

type ISetOverlap = Venn.ISetOverlap
export { ISetOverlap }

declare const venn: typeof Venn
declare const d3: typeof D3

const require = createRequire(import.meta.url)
const html = String(new URL('../index.html', import.meta.url))
const d3Script = { path: require.resolve('d3/dist/d3.js') }
const vennScript = { path: require.resolve('@upsetjs/venn.js/build/venn.js') }

export interface CreateVennRendererOptions {
  /**
   * The Playwright browser to use.
   *
   * @default chromium
   */
  browser?: BrowserType

  /**
   * The options used to launch the browser.
   */
  launchOptions?: LaunchOptions
}

export interface RenderResult {
  /**
   * The height of the resulting SVG.
   */
  height: number

  /**
   * The DOM id of the SVG node.
   */
  id: string

  /**
   * The diagram SVG rendered as a PNG buffer.
   */
  screenshot?: Buffer

  /**
   * The diagram rendered as an SVG.
   */
  svg: string

  /**
   * The width of the resulting SVG.
   */
  width: number
}

export interface RenderOptions {
  /**
   * A URL that points to a custom CSS file to load.
   *
   * Use this to load custom fonts.
   *
   * This option is ignored in the browser. You need to include the CSS in your build manually.
   */
  css?: URL | string | undefined

  /**
   * If true, a PNG screenshot of the diagram will be added.
   *
   * This is only supported in the Node.js.
   */
  screenshot?: boolean

  /**
   * The venn configuration.
   *
   * By default `fontFamily` is set to `arial,sans-serif`.
   *
   * This option is ignored in the browser. You need to call `venn.initialize()` manually.
   */
  vennConfig?: Venn.IVennDiagramOptions

  /**
   * The prefix of the id.
   *
   * @default 'venn'
   */
  prefix?: string | undefined
}

/**
 * Render Venn diagrams in the browser.
 *
 * @param diagrams The Venn diagrams to render.
 * @param options Additional options to use when rendering the diagrams.
 * @returns A list of settled promises that contains the rendered Venn diagram. Each result
 *   matches the same index of the input diagrams.
 */
export type VennRenderer = (
  diagrams: Venn.ISetOverlap[][],
  options?: RenderOptions
) => Promise<PromiseSettledResult<RenderResult>[]>

interface RenderDiagramsOptions
  extends Required<Pick<RenderOptions, 'prefix' | 'screenshot' | 'vennConfig'>> {
  /**
   * The diagrams to process.
   */
  diagrams: Venn.ISetOverlap[][]
}

/* c8 ignore start */
/**
 * Render venn diagrams in the browser.
 *
 * @param options The options used to render the diagrams
 * @returns A settled promise that holds the rendering results.
 */
async function renderDiagrams({
  diagrams,
  prefix,
  screenshot,
  vennConfig
}: RenderDiagramsOptions): Promise<PromiseSettledResult<RenderResult>[]> {
  await Promise.all(Array.from(document.fonts, (font) => font.load()))
  const serializer = new XMLSerializer()

  const chart = venn.VennDiagram(vennConfig)
  if (!screenshot) {
    chart.useViewBox()
  }

  return Promise.allSettled(
    diagrams.map((diagram, index) => {
      const id = `${prefix}-${index}`

      try {
        const root = document.createElement('div')
        root.id = id
        root.style.width = 'fit-content'
        document.body.append(root)
        // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore
        d3.select(`#${id}`).datum(diagram).call(chart)

        const [element] = root.getElementsByTagName('svg')
        let width = 0
        let height = 0
        if (screenshot) {
          height = element.height.baseVal.value
          width = element.width.baseVal.value
        } else {
          height = element.viewBox.baseVal.height
          width = element.viewBox.baseVal.width
        }

        const result: RenderResult = {
          height,
          id,
          svg: serializer.serializeToString(element),
          width
        }

        return result
      } catch (error) {
        throw error instanceof Error
          ? { name: error.name, stack: error.stack, message: error.message }
          : error
      }
    })
  )
}

/* c8 ignore stop */

/**
 * Create a Venn renderer.
 *
 * The Venn renderer manages a browser instance. If multiple diagrams are being rendered
 * simultaneously, the internal browser instance will be re-used. If no diagrams are being rendered,
 * the browser will be closed.
 *
 * @param options The options of the Venn renderer.
 * @returns A function that renders Venn diagrams in the browser.
 */
export function createVennRenderer(options: CreateVennRendererOptions = {}): VennRenderer {
  const { browser = chromium, launchOptions } = options

  let browserPromise: Promise<Browser> | undefined
  let count = 0

  return async (diagrams, renderOptions) => {
    count += 1
    if (!browserPromise) {
      browserPromise = browser?.launch(launchOptions)
    }

    const browserInstance = await browserPromise

    let page: Page | undefined
    let renderResults: PromiseSettledResult<RenderResult>[]

    try {
      page = await browserInstance.newPage({ bypassCSP: true })
      await page.goto(html)
      const promises = [page.addScriptTag(d3Script), page.addScriptTag(vennScript)]
      if (renderOptions?.css) {
        promises.push(page.addStyleTag({ url: String(renderOptions.css) }))
      }
      await Promise.all(promises)

      renderResults = await page.evaluate(renderDiagrams, {
        diagrams,
        screenshot: Boolean(renderOptions?.screenshot),
        vennConfig: renderOptions?.vennConfig || {},
        prefix: renderOptions?.prefix ?? 'venn'
      })
      if (renderOptions?.screenshot) {
        for (const result of renderResults) {
          if (result.status === 'fulfilled') {
            result.value.screenshot = await page
              .locator(`#${result.value.id}`)
              .screenshot({ omitBackground: true })
          }
        }
      }
    } finally {
      await page?.close()
      count -= 1
      if (!count) {
        browserPromise = undefined
        browserInstance.close()
      }
    }

    for (const result of renderResults) {
      if (result.status !== 'rejected') {
        continue
      }

      const { reason } = result

      if (reason && 'name' in reason && 'message' in reason && 'stack' in reason) {
        Object.setPrototypeOf(reason, Error.prototype)
      }
    }

    return renderResults
  }
}
