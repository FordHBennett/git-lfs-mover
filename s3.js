const AWS = require('aws-sdk')
const uuid = require('uuid/v4')

const config = require('./config')

AWS.config.loadFromPath('./s3Config.json')
const s3 = new AWS.S3()

/**
 * It takes a bucket name and a content type, and returns a function that takes a file's contents and
 * returns a promise that resolves to the URL of the uploaded file
 * @param bucket - The name of the bucket you created in the previous step.
 * @param contentType - The content type of the file.
 * @returns A function that takes in a contentType and returns a function that takes in contents and
 * returns a promise that resolves to a url.
 */
const uploadImage = (bucket, contentType) => async (contents) => {
  return new Promise((resolve, reject) => {
    const filename = uuid()
    s3.putObject({
      Bucket: bucket,
      Key: filename,
      Body: contents,
      ContentType: contentType,
      ACL: 'public-read'
    }, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(`https://${bucket}.s3.amazonaws.com/${filename}`)
      }
    })
  })
}

module.exports = {
  uploadImage,
}
