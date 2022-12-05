import fs from 'fs';
import path from 'path';

import sharp from 'sharp';

const executePipeline = (inputStream, sharpPipeline) =>
  new Promise((resolve, reject) => {
    inputStream
      .on('error', (e) => reject(e))
      .pipe(sharpPipeline)
      .on('error', (e) => reject(e))
      .on('finish', () => {
        resolve({});
      });
  });

const transformImages = async ({
  filePath,
  filePrefix,
  bucket,
  widths,
  formats,
  quality,
}) => {
  const inputStream = fs.createReadStream(filePath);

  const { name: inputFileName } = path.parse(filePath);

  const maxListeners = widths.length * formats.length + 3;

  const sharpPipeline = sharp({
    failOnError: false,
  }).setMaxListeners(maxListeners);

  widths.forEach((width) =>
    formats.forEach((format) => {
      const outputFileName = `${filePrefix}${inputFileName}-${width}w.${format}`;

      const storageFile = bucket.file(outputFileName);

      // console.log('Creating write stream to path: ', outputFilePath);
      const outputStream = storageFile.createWriteStream();

      sharpPipeline
        .clone()
        .resize(width)
        .toFormat(format, {
          quality,
        })
        .pipe(outputStream);
    })
  );

  await executePipeline(inputStream, sharpPipeline);

  console.log(`Successfully transformed - ${filePath}`);
};

export { transformImages };
