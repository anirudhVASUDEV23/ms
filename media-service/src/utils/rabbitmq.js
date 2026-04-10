const amqp = require("amqplib");
const logger = require("./logger");

let connection = null;
let channel = null;

const EXCHANGE_NAME = "facebook_events";

async function connectToRabbitMQ() {
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: false });
    logger.info("Connected to RabbitMQ and exchange asserted");
  } catch (error) {
    logger.error("Error connecting to RabbitMQ", error);
  }
}

async function publishEvent(routingKey, message) {
  if (!channel) {
    logger.error("RabbitMQ channel is not initialized");
    await connectToRabbitMQ();
  }
  channel.publish(
    EXCHANGE_NAME,
    routingKey,
    Buffer.from(JSON.stringify(message)),
  );
  logger.info(`Event published to RabbitMQ with routing key: ${routingKey}`);
}

async function consumeEvent(routingKey, callback) {
  if (!channel) {
    logger.error("RabbitMQ channel is not initialized");
    await connectToRabbitMQ();
  }
  const q = await channel.assertQueue("", { exclusive: true });
  await channel.bindQueue(q.queue, EXCHANGE_NAME, routingKey);
  await channel.consume(q.queue, (msg) => {
    if (msg.content) {
      const message = JSON.parse(msg.content.toString());
      logger.info(
        `Event received from RabbitMQ with routing key: ${routingKey}`,
        message,
      );
      callback(message);
      channel.ack(msg);
    }
  });
  logger.info(`Subscribed to RabbitMQ event with routing key: ${routingKey}`);
}

module.exports = { connectToRabbitMQ, publishEvent, consumeEvent };
