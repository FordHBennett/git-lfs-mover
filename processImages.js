const request = require('request-promise')

const config = require('./config')
// const { uploadImage } = require('./s3')

const replaceAll = (str, obj) => {
  let newStr = str
  for (let key in obj) {
    newStr = newStr.replace(new RegExp(key, 'g'), obj[key])
  }
  return newStr
}

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const uuid = require('uuid/v4')


const processImages = async (content) => {
  const imgRegExp = /!\[([^\]]+)\]\(([^\)]+)\)/;
  const imgMatchAll = new RegExp(imgRegExp, 'g');

  if (config.s3Bucket) {
    // const replacements = await Promise.all(
    //   (content.match(imgMatchAll) || []).map(async (img) => {
    //     const [_, title, oldUrl] = img.match(imgRegExp);

    //     const response = await axios.get(oldUrl, {
    //       responseType: 'arraybuffer'
    //     });

    //     const contentType = response.headers['content-type'];
    //     const fileExtension = contentType.split('/')[1];


    //     const newFilename = `${uuid()}.${fileExtension}`;
    //     const newFilePath = path.join(__dirname, 'images', newFilename);

    //     fs.writeFileSync(newFilePath, response.data);

    //     const newUrl = `file://${newFilePath}`;

    //     console.log('Downloaded image:', newUrl);
    //     return { oldUrl, newUrl };
    //   })
    // );

    // const processedContent = replacements.reduce((result, { oldUrl, newUrl }) => {
    //   return result.replace(oldUrl, newUrl);
    // }, content);

    return content;
  } else {
    // No S3 bucket specified, just return the content
    return Promise.resolve(content);
  }
};


/**
 * It takes a string of Markdown content, finds all the images, uploads them to S3, and returns the
 * Markdown content with the image URLs replaced with the S3 URLs
 * @param content - The content of the post.
 * @returns A function that takes a string and returns a promise that resolves to a string.
 */
// const processImages = async (content) => {
//   const imgRegExp = /!\[([^\]]+)\]\(([^\)]+)\)/
//   const imgMatchAll = new RegExp(imgRegExp, 'g')

//   if (config.s3Bucket) {
//     return Promise.all(
//       (content.match(imgMatchAll) || [])
//         .map(img => {
//           const [_, title, oldUrl] = img.match(imgRegExp)
//           return request({
//             method: 'GET',
//             encoding: null, // force a buffer
//             url: oldUrl,
//             transform: (body, response) => ({
//               headers: response.headers,
//               body,
//             })
//           })
//             // .then(console.log)
//             // .then(() => { process.exit(1) })
//             .then(response => uploadImage(config.s3Bucket, response.headers['content-type'])(response.body))
//             .then(newUrl => {
//               console.log('Uploaded image: ', newUrl)
//               return { oldUrl, newUrl }
//             })
//         })
//     ).then(replacements => {
//       return replacements.reduce(
//         (result, { oldUrl, newUrl }) => {
//           return result.replace(oldUrl, newUrl)
//         },
//         content
//       )
//     })
//   } else {
//     // no s3 bucket, just return content
//     return Promise.resolve(content)
//   }
// }


module.exports = processImages;
