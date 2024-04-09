import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import test, { describe } from 'node:test'

import { type ISetOverlap } from '@upsetjs/venn.js'
import prettier from 'prettier'
import { createVennRenderer, type RenderResult } from 'venn-isomorphic'

const fixturesPath = new URL('../fixtures/', import.meta.url)
const fixtureNames = (await readdir(fixturesPath)).sort()

interface FixtureTest {
  input: ISetOverlap[]
  validate: (actual: RenderResult) => Promise<void>
}

async function readFixture(name: string, expectedName: string): Promise<FixtureTest> {
  const fixturePath = new URL(`${name}/`, fixturesPath)
  const inputPath = new URL('input.json', fixturePath)
  const pngPath = new URL(`${expectedName}.png`, fixturePath)
  const expectedPath = new URL(`${expectedName}.svg`, fixturePath)

  const input = JSON.parse(await readFile(inputPath, 'utf8'))
  let expected: Buffer | string | undefined
  try {
    expected = await readFile(expectedPath, 'utf8')
  } catch {
    await writeFile(expectedPath, '')
  }

  return {
    input,
    async validate({ screenshot, svg, ...meta }) {
      const normalized = await prettier.format(
        `<!--\n${JSON.stringify(meta, undefined, 2)}\n-->\n${svg}`,
        { parser: 'html' }
      )
      if (process.argv.includes('update') || !expected) {
        await writeFile(expectedPath, normalized)

        if (screenshot) {
          await writeFile(pngPath, screenshot)
        }
      }
      assert.equal(normalized, expected)
    }
  }
}

describe('node', () => {
  for (const name of fixtureNames) {
    test(name, async () => {
      const { input, validate } = await readFixture(name, 'expected')

      const renderer = createVennRenderer()
      const results = await renderer([input], { screenshot: true })

      assert.equal(results.length, 1)
      const [result] = results
      assert.equal(result.status, 'fulfilled')

      await validate(result.value)
    })
  }
})
