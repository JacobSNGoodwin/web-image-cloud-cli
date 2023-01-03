import path from 'path';

import sharp from 'sharp';
import pAll from 'p-all';

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

const transformImages = async ({
  filePath,
  filePrefix,
  bucket,
  widths,
  formats,
  quality,
}) => {
  const { name: inputFileName } = path.parse(filePath);

  // We can probably allow more than 10 listeners here
  // since we're awaiting successful upload to not destroy
  // our Google Cloud Connection.
  // const maxListeners = widths.length * formats.length + 3;

  const formathWidths = formats.reduce((prevFormatWidths, format) => {
    const currentFormatWidths = widths.map((width) => ({
      format,
      width,
    }));

    return [...prevFormatWidths, ...currentFormatWidths];
  }, []);

  const formatWidthConversions = formathWidths.map(
    async ({ format, width }) => {
      return async () => {
        const outputFileName = `${filePrefix}${inputFileName}-${width}w.${format}`;

        console.log('Creating pipline', { filePath, outputFileName });

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
      };
    }
  );

  await pAll(formatWidthConversions, { concurrency: 8 });
};

export { transformImages };
