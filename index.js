#!/usr/bin/env node
import path from 'path';
import fs from 'fs';
import { Command } from 'commander/esm.mjs';

const ALLOWED_INPUT_TYPES = [
  'jpg',
  'jpeg',
  'avif',
  'webp',
  'png',
  'gif',
  'svg',
];

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
    './'
  )
  .option(
    '-w, --widths <img widths...>',
    'A list of the widths (variants) to create for the image',
    ['800', '1200', '1800', '2400']
  )
  .option('-f, --formats <img format...>', 'output image format extensions', [
    'jpeg',
    'webp',
  ]);

program.parse(process.argv);

const options = program.opts();
console.debug(options);

// const widthsNumeric = options?.widths?.map((width) => parseInt(width));
const imagesDir = path.join(process.cwd(), options.dir);

const imageFiles = await fs.promises.readdir(imagesDir);

console.log(imageFiles);
