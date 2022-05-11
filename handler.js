'use strict';

const { get } = require('axios');

/**
 *  Lambda function Handler
 */
class Handle {
  constructor({ rekognationSvc, translateSvc }) {
    this.rekognationSvc = rekognationSvc;
    this.translateSvc = translateSvc;
  }

  /**
   * Detects labels of images in the file located in AWS rekognation.
   * @param {*} buffer
   * @returns
   */
  async detectImageLabels(buffer) {
    const result = await this.rekognationSvc
      .detectLabels({
        Image: {
          Bytes: buffer,
        },
      })
      .promise();

    const workingItems = result.Labels.filter(
      ({ Confidence }) => Confidence >= 80,
    );

    const names = workingItems.map(({ Name }) => Name).join(' and ');

    return { names, workingItems };
  }

  /**
   * Translate text input of en to pt
   * @param {*} text
   */
  async translateText(text) {
    const params = {
      SourceLanguageCode: 'en',
      TargetLanguageCode: 'pt',
      Text: text,
    };

    const { TranslatedText } = await this.translateSvc
      .translateText(params)
      .promise();

    return TranslatedText.split(' e ');
  }

  /**
   * Texts received by parameter formatted for the user
   * @param {*} text
   * @param {*} workingItems
   */
  formatTextResults(texts, workingItems) {
    const finalText = [];
    for (const indexText in texts) {
      const nameInPortuguese = texts[indexText];
      const confidence = workingItems[indexText].Confidence;
      finalText.push(
        ` ${confidence.toFixed(2)}% de ser do tipo ${nameInPortuguese}`,
      );
    }
    return finalText.join('\n');
  }

  /**
   * Returns the buffer of the image obtained from a url
   * @param {*} imageUrl
   * @returns
   */
  async getImageBuffer(imageUrl) {
    const response = await get(imageUrl, {
      responseType: 'arraybuffer',
    });
    const buffer = Buffer.from(response.data, 'base64');
    return buffer;
  }

  /**
   * Receive image, detect labels with AWS rekognition and return the results.
   * @param {*} event
   * @returns
   */
  async main(event) {
    try {
      const { imageUrl } = event.queryStringParameters;
      const imgBuffer = await this.getImageBuffer(imageUrl);
      const { names, workingItems } = await this.detectImageLabels(imgBuffer);
      console.log('Detecting labels...');

      console.log('Translating to portuguese...');
      const texts = await this.translateText(names);

      console.log('Handling final objects...');
      const finalText = this.formatTextResults(texts, workingItems);

      console.log('Finishing...');
      return {
        statusCode: 200,
        body: `A imagem tem\n `.concat(finalText),
      };
    } catch (error) {
      console.log('Error: ', error);
      return {
        statusCode: 500,
        body: 'Internal server error.',
      };
    }
  }
}

const aws = require('aws-sdk');
const rekognation = new aws.Rekognition();
const translate = new aws.Translate();
const handle = new Handle({
  rekognationSvc: rekognation,
  translateSvc: translate,
});

module.exports.main = handle.main.bind(handle);
