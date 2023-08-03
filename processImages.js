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

module.exports = processImages;
