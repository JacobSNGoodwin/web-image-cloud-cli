#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { Command } from 'commander/esm.mjs';
import pAll from 'p-all';

import { transformImages, createLqips } from './imageProcessing.js';

const ALLOWED_INPUT_TYPES = [
  '.jpg',
  '.jpeg',
  '.avif',
  '.webp',
  '.png',
  '.gif',
  '.svg',
];

const DEFAULT_OUTPUTS = ['jpg', 'webp'];

const CONCURRENCY_LIMIT = 5;

const program = new Command();

program
  .option(
    '-d, --dir <directory>',
    'the relative directory containing the image',
    './'
  )
  .option('e, --ext', 'extention types to convert', ALLOWED_INPUT_TYPES)
  .option('--no-sqip', 'do not include sqip?')
  .option(
    '-o, --outdir <output directory>',
    'the relative directory for outputting the files',
    './web'
  )
  .option(
    '-w, --widths <img widths...>',
    'A list of the widths (variants) to create for the image',
    ['800', '1200', '1800', '2400']
  )
  .option(
    '-q, --quality <quality>',
    'Image quality from 1-100 for jpeg and webp',
    '80'
  )
  .option(
    '-f, --formats <img format...>',
    'output image format extensions',
    DEFAULT_OUTPUTS
  )
  .option(
    '--lqip-only',
    'use if you merely want to get base64 image placeholder data'
  );

program.parse(process.argv);

const options = program.opts();

const widthsNumeric = options?.widths?.map((width) => parseInt(width));
const qualityNumeric = parseInt(options.quality);
const imagesDir = path.join(process.cwd(), options.dir);

// create ouput directory if it doesn't exist
const outDir = path.join(process.cwd(), options.outdir);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir);
}

const directoryFiles = await fs.promises.readdir(imagesDir);

const imageFiles = directoryFiles.filter((file) => {
  const fileExt = path.extname(file).toLowerCase();
  return ALLOWED_INPUT_TYPES.includes(fileExt);
});

// Open each file and create variants
const widthConversions = imageFiles.map(async (fileName) => {
  const filePath = path.join(process.cwd(), options.dir, fileName);

  // pAll expects a function to control concurrency
  return () =>
    transformImages({
      filePath,
      outDir,
      widths: widthsNumeric,
      quality: qualityNumeric,
      formats: options.formats,
    });
});

if (!options.lqipOnly) {
  console.log(
    `Create images of widths ${widthsNumeric} and formats ${options.formats}`
  );
  await pAll(widthConversions, { concurrency: CONCURRENCY_LIMIT });
  console.log('Image transformations have completed!');
}

console.log('Creating Low-Quality image place holders');
const lqipMap = await createLqips(imageFiles, outDir);
console.log('LQIPs created');
console.log(lqipMap);
