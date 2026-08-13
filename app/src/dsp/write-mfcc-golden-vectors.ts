/**
 * Offline regenerator for `mfcc-golden-vectors.json` (issue #67).
 * Not imported by the app. From `app/`:
 *   pnpm exec jiti src/dsp/write-mfcc-golden-vectors.ts
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractMfccSequence } from './mfcc-extraction'
import {
  MFCC_GOLDEN_MAX_ABSOLUTE_ERROR,
  MFCC_GOLDEN_SAMPLE_RATE_HZ,
  mfccGoldenSignalRecipes,
  synthesizeGoldenMfccSignal,
} from './mfcc-golden-signals'

const fixture = {
  version: 1,
  sampleRateInHertz: MFCC_GOLDEN_SAMPLE_RATE_HZ,
  maxAbsoluteError: MFCC_GOLDEN_MAX_ABSOLUTE_ERROR,
  c0Policy:
    'c0 is compared with the same absolute tolerance as c1–c12 because amplitude is pinned in the synthetic recipes. A change to pre-emphasis, the mel bank, or the DCT must fail this fixture.',
  cases: mfccGoldenSignalRecipes.map((recipe) => ({
    id: recipe.id,
    coefficients: extractMfccSequence(
      synthesizeGoldenMfccSignal(recipe),
      MFCC_GOLDEN_SAMPLE_RATE_HZ,
    ).map((frame) => Array.from(frame.coefficients, (value) => Number(value.toPrecision(9)))),
  })),
}

const outputPath = resolve(process.cwd(), 'src/dsp/mfcc-golden-vectors.json')
writeFileSync(outputPath, `${JSON.stringify(fixture, null, 2)}\n`)
console.log(`Wrote ${outputPath}`)
