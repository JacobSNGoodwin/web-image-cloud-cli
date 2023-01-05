#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { Command } from 'commander/esm.mjs';
import pAll from 'p-all';

import { transformImage } from './imageProcessing.js';
import { Storage, IdempotencyStrategy } from '@google-cloud/storage';

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

const storageClient = new Storage({
  retryOptions: {
    // If this is false, requests will not retry and the parameters
    // below will not affect retry behavior.
    autoRetry: true,
    // The multiplier by which to increase the delay time between the
    // completion of failed requests, and the initiation of the subsequent
    // retrying request.
    retryDelayMultiplier: 3,
    // The total time between an initial request getting sent and its timeout.
    // After timeout, an error will be returned regardless of any retry attempts
    // made during this time period.
    totalTimeout: 500,
    // The maximum delay time between requests. When this value is reached,
    // retryDelayMultiplier will no longer be used to increase delay time.
    maxRetryDelay: 500,
    // The maximum number of automatic retries attempted before returning
    // the error.
    maxRetries: 10,
    // Will respect other retry settings and attempt to always retry
    // conditionally idempotent operations, regardless of precondition
    idempotencyStrategy: IdempotencyStrategy.RetryAlways,
  },
});
const pathElements = options.outdir.split('/');
const bucketName = pathElements[0];
const filePrefix = `${pathElements.slice(1, pathElements.length).join('/')}/`;

const bucket = storageClient.bucket(bucketName);
const bucketExists = (await bucket.exists())[0];

if (!bucketExists) {
  await bucket.create();
}

// 3D loopin'! Yee haw!
const imageVariantConverions = imageFiles.reduce(
  (prevImageVariants, fileName) => {
    const filePath = path.join(process.cwd(), options.dir, fileName);
    const formathWidths = options.formats.reduce((prevFormatWidths, format) => {
      const currentFormatWidths = widthsNumeric.map((width) => ({
        format,
        width,
      }));

      return [...prevFormatWidths, ...currentFormatWidths];
    }, []);

    const imageVariants = formathWidths.map(({ format, width }) => ({
      filePath,
      fileName,
      format,
      width,
    }));

    return [...prevImageVariants, ...imageVariants];
  },
  []
);

// Open each file and create variants
const conversions = imageVariantConverions.map(
  ({ filePath, fileName, format, width }) => {
    // pAll expects a function to control concurrency

    return () =>
      transformImage({
        filePrefix,
        bucket,
        quality: qualityNumeric,
        filePath,
        width,
        format,
      });
  }
);

console.log(
  `Creating images of widths ${widthsNumeric} and formats ${options.formats}`
);

await pAll(conversions, { concurrency: 16 });

// await pAll(conversions, { concurrency: 1 });
console.log('Image transformations have completed!');
