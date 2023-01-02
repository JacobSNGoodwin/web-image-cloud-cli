#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { Command } from 'commander/esm.mjs';
import pAll from 'p-all';

import { transformImages } from './imageProcessing.js';
import { Storage } from '@google-cloud/storage';

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
  .requiredOption(
    '-o, --outdir <output directory>',
    'the full path beginning with (including) the bucket name'
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
  );

program.parse(process.argv);

const options = program.opts();

const widthsNumeric = options?.widths?.map((width) => parseInt(width));
const qualityNumeric = parseInt(options.quality);
const imagesDir = path.join(process.cwd(), options.dir);

const directoryFiles = await fs.promises.readdir(imagesDir);

const imageFiles = directoryFiles.filter((file) => {
  const fileExt = path.extname(file).toLowerCase();
  return ALLOWED_INPUT_TYPES.includes(fileExt);
});

const storageClient = new Storage();
const pathElements = options.outdir.split('/');
const bucketName = pathElements[0];
const filePrefix = `${pathElements.slice(1, pathElements.length).join('/')}/`;

const bucket = storageClient.bucket(bucketName);
const bucketExists = (await bucket.exists())[0];

if (!bucketExists) {
  await bucket.create();
}

// Open each file and create variants
const widthConversions = imageFiles.map(async (fileName) => {
  const filePath = path.join(process.cwd(), options.dir, fileName);

  // pAll expects a function to control concurrency
  return () =>
    transformImages({
      filePath,
      filePrefix,
      bucket,
      widths: widthsNumeric,
      quality: qualityNumeric,
      formats: options.formats,
    });
});

console.log(
  `Creating images of widths ${widthsNumeric} and formats ${options.formats}`
);

await pAll(widthConversions, { concurrency: CONCURRENCY_LIMIT });
console.log('Image transformations have completed!');
