const request = require('request-promise');
const config = require('./config');
const { uploadImage } = require('./s3');

/**
 * It takes a string of Markdown content, finds all the images, uploads them to S3, and returns the
 * Markdown content with the image URLs replaced with the S3 URLs
 * @param content - The content of the post.
 * @returns A function that takes a string and returns a promise that resolves to a string.
 */
const processImages = async (content) => {
  const imgRegExp = /!\[([^\]]+)\]\(([^\)]+)\)/;
  const imgMatchAll = new RegExp(imgRegExp, 'g');
  if (config.s3Bucket) {
    const replacements = await Promise.all(
      (content.match(imgMatchAll) || []).map(async (img) => {
        const [_, title, oldUrl] = img.match(imgRegExp);
        const response = await request({
          method: 'GET',
          encoding: null, // force a buffer
          url: oldUrl,
          transform: (body, response) => ({
            headers: response.headers,
            body,
          })
        });
        const newUrl = await uploadImage(config.s3Bucket, response.headers['content-type'])(response.body);
        console.log('Uploaded image: ', newUrl);
        return { oldUrl, newUrl };
      })
    );
    const processedContent = replacements.reduce((result, { oldUrl, newUrl }) => {
      return result.replace(oldUrl, newUrl);
    }, content);
    return processedContent;
  } else {
    return Promise.resolve(content);
  }
};

module.exports = processImages;
