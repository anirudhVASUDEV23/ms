require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const Redis = require("ioredis");
const helmet = require("helmet");
const postRoutes = require("./routes/post-routes.js");
const errorHandler = require("./middleware/errorHandler.js");
const logger = require("./utils/logger.js");
const { connectToRabbitMQ } = require("./utils/rabbitmq.js");

const app = express();
const PORT = process.env.PORT || 3002;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("Connected to mongodb"))
  .catch((e) => logger.error("Mongo connection error", e));

const redisClient = new Redis(process.env.REDIS_URL);

//middleware
app.use(helmet());
app.use(cors());
app.use(express.json()); //makes content type json by default for incoming requests that is application-json and parses the body to req.body if multipart/form-data is used we need something like multer to parse the body

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info("Request body:", req.body);
  next();
});

//Routes->pass redis client to routes for caching
app.use(
  "/api/posts",
  (req, res, next) => {
    req.redisClient = redisClient;
    next();
  },
  postRoutes,
);

//Error handling middleware
app.use(errorHandler);

async function startServer() {
  try {
    await connectToRabbitMQ();
    app.listen(PORT, () => {
      logger.info(`Post service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Error starting server because of rabbitmq", error);
    process.exit(1);
  }
}

startServer();

// app.listen(PORT, () => {
//   logger.info(`Post service running on port ${PORT}`);
// });

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
