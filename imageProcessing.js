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
  outDir,
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

  const imageVariantData = {};

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

      // add variant to map of files to output
      if (imageVariantData[width]) {
        imageVariantData[width][format] = outputFileName;
      } else {
        imageVariantData[width] = {
          [format]: outputFileName,
        };
      }
      // TODO -> output image width and height
      // which is helpful for lazy loading images
      return {
        [inputFileName]: imageVariantData,
      };
    })
  );

  await executePipeline(inputStream, sharpPipeline);

  console.log(`Successfully transformed - ${filePath}`);

  return {
    inputFileName,
    imageVariantData,
  };
};

const createLqips = async (imagePaths, outDir) => {
  const lqipMap = await imagePaths.reduce(async (lqipMap, imagePath) => {
    const sharpImage = sharp(imagePath);
    const { width, height, format } = await sharpImage.metadata();
    const { name } = path.parse(imagePath);

    const lqipBuf = await sharpImage
      .resize({ width: 30, fit: 'inside' })
      .blur()
      .toBuffer();

    return Promise.resolve({
      ...(await lqipMap),
      [name]: {
        base64: `data:image/${format};base64,${lqipBuf.toString('base64')}`,
        width,
        height,
      },
    });
  }, {});

  await fs.promises.writeFile(
    path.join(outDir, 'imageData.json'),
    JSON.stringify(lqipMap, null, 2)
  );

  return lqipMap;
};

export { transformImages, createLqips };
