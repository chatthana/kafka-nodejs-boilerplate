const moment = require('moment');
const uuidv4 = require('uuid/v4');
const { KafkaClient, Consumer } = require('kafka-node');
const { Client: PgClient } = require('pg');
const type = require('./type');

(async () => {
  const pgClient = new PgClient();
  await pgClient.connect();

  const kafkaClientOptions = {
    kafkaHost: process.env.KAFKA_BROKER_CONNECT,
    connectRetryOptions: {
      retries: 3,
      minTimeout: 10000
    }
  };

  const kafkaClient = new KafkaClient(kafkaClientOptions);

  const topics = [
    { topic: 'sales-topic' }
  ];
  
  const options = {
    autoCommit: true,
    fetchMaxWaitMs: 1000,
    fetchMaxBytes: 1024 * 1024,
    encoding: 'buffer'
  };

  const kafkaConsumer = new Consumer(kafkaClient, topics, options);
  
  kafkaConsumer.on('message', async function(message) {
    console.log('Message received:', message);
    const messageBuffer = new Buffer(message.value, 'binary');

    const decodedMessage = type.fromBuffer(messageBuffer.slice(0));
    console.log('Decoded Message:', typeof decodedMessage, decodedMessage);

    const saleDateISO8601 = moment(decodedMessage.saleDate).toISOString();
    const insertResponse = await pgClient.query({
      text: 'INSERT INTO sales(uuid, total, sale_date) VALUES($1, $2, $3)',
      values: [uuidv4(), decodedMessage.total, saleDateISO8601],
    });

    console.log('Insert Response:', insertResponse);
  });
  
  kafkaClient.on('error', (error) => console.error('Kafka client error:', error));
  kafkaConsumer.on('error', (error) => console.error('Kafka consumer error:', error));
})();