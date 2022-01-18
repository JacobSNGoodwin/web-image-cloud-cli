import fs from 'fs';
import path from 'path';

import sharp from 'sharp';

const executePipeline = (inputStream, sharpPipeline) =>
  new Promise((resolve, reject) => {
    inputStream
      .on('error', (e) => reject(e))
      .pipe(sharpPipeline)
      .on('error', (e) => reject(e))
      .on('close', () => resolve());
  });

const transformImages = async ({
  filePath,
  outDir,
  widths,
  formats,
  quality,
}) => {
  const inputStream = fs.createReadStream(filePath);

  const { name: inputFileName } = path.parse(filePath);

  const sharpPipeline = sharp({
    failOnError: false,
  });

  widths.forEach((width) =>
    formats.forEach((format) => {
      const outputFileName = `${inputFileName}-${width}w.${format}`;
      const outputFilePath = path.join(outDir, outputFileName);

      // console.log('Creating write stream to path: ', outputFilePath);
      const outputStream = fs.createWriteStream(outputFilePath);

      sharpPipeline
        .clone()
        .resize(width)
        .toFormat(format, {
          quality,
        })
        .pipe(outputStream);
    })
  );

  return executePipeline(inputStream, sharpPipeline);
};

export { transformImages };
