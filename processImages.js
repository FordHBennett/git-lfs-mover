const request = require('request-promise');
const config = require('./config');
const { uploadImage } = require('./s3');

/**
 * Processes images in Markdown content and uploads them to S3 if a bucket is configured.
 * @param {string} content - The Markdown content.
 * @returns {Promise<string>} - The processed content with image URLs replaced by their S3 URLs.
 */
const processImages = async (content) => {
  // Regular expression to match Markdown image syntax (![alt text](image url))
  const imgRegExp = /!\[([^\]]+)\]\(([^\)]+)\)/;
  const imgMatchAll = new RegExp(imgRegExp, 'g');

  if (config.s3Bucket) {
    // Map each Markdown image syntax to a Promise that uploads the image to S3
    const replacements = await Promise.all(
      (content.match(imgMatchAll) || []).map(async (img) => {
        const [_, title, oldUrl] = img.match(imgRegExp);
        // Download the image and get its headers for content type
        const response = await request({
          method: 'GET',
          encoding: null, // force a buffer
          url: oldUrl,
          transform: (body, response) => ({
            headers: response.headers,
            body,
          })
        });
        // Upload the image to S3 and get its new URL
        const newUrl = await uploadImage(config.s3Bucket, response.headers['content-type'])(response.body);
        console.log('Uploaded image: ', newUrl);
        return { oldUrl, newUrl };
      })
    );
    // Replace each Markdown image URL with its S3 URL in the content
    const processedContent = replacements.reduce((result, { oldUrl, newUrl }) => {
      return result.replace(oldUrl, newUrl);
    }, content);
    return processedContent;
  } else {
    // If no S3 bucket is configured, simply return the original content
    return Promise.resolve(content);
  }
};

module.exports = processImages;

