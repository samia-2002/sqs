const AWS = require('aws-sdk');
const sharp = require('sharp');
const s3 = new AWS.S3();

exports.lambda_handler = async (event) => {
  try {
    console.log("Received event:", JSON.stringify(event, null, 2));
    
    // Process each SQS message
    for (const record of event.Records) {
      const messageBody = JSON.parse(record.body);
      
      // Handle S3 event notifications from SQS
      if (messageBody.Records) {
        for (const s3Record of messageBody.Records) {
          const srcBucket = s3Record.s3.bucket.name;
          const srcKey = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, ' '));
          
          console.log(`Processing image: ${srcBucket}/${srcKey}`);
          
          // Get the image from S3
          const imageData = await s3.getObject({
            Bucket: srcBucket,
            Key: srcKey
          }).promise();
          
          // Generate thumbnail (200px width, auto height)
          const thumbnail = await sharp(imageData.Body)
            .resize(200)
            .toBuffer();
          
          // Upload to output bucket
          await s3.putObject({
            Bucket: process.env.OUTPUT_BUCKET,
            Key: `thumbnails/${srcKey}`,
            Body: thumbnail,
            ContentType: imageData.ContentType
          }).promise();
          
          console.log(`Thumbnail saved to: ${process.env.OUTPUT_BUCKET}/thumbnails/${srcKey}`);
        }
      }
    }
    return { statusCode: 200, body: 'Processing completed' };
  } catch (err) {
    console.error("Error:", err);
    throw err; // Triggers automatic retry for SQS
  }
};