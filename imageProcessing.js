import path from 'path';

import sharp from 'sharp';

const executePipeline = async (transformedImage, outputStream, variant) => {
  return new Promise((resolve, reject) =>
    transformedImage
      .pipe(outputStream)
      .on('error', (e) => reject(e))
      .on('finish', () => {
        console.log('Successfully transformed image', variant);
        resolve({});
      })
  );
};

const transformImage = async ({
  filePrefix,
  bucket,
  quality,
  filePath,
  width,
  format,
}) => {
  try {
    const { name: inputFileName } = path.parse(filePath);
    // We can probably allow more than 10 listeners here
    // since we're awaiting successful upload to not destroy
    // our Google Cloud Connection.
    // const maxListeners = widths.length * formats.length + 3;
    const outputFileName = `${filePrefix}${inputFileName}-${width}w.${format}`;

    console.log('Creating conversion pipline for: ', outputFileName);

    // get source image metadata
    const sharpSource = sharp(filePath);
    const { height: baseHeight, width: baseWidth } =
      await sharpSource.metadata();

    const outputStream = bucket.file(outputFileName).createWriteStream({
      metadata: {
        metadata: {
          width,
          height: Math.round((width / baseWidth) * baseHeight),
        },
      },
    });

    const variant = { width, format, filePath };

    const sharpTransformed = sharpSource.resize(width).toFormat(format, {
      quality,
    });

    return executePipeline(sharpTransformed, outputStream, variant);
  } catch (e) {
    console.error('Error transforming image', {
      filePath,
      filePrefix,
      e,
    });
  }
};

export { transformImage };
