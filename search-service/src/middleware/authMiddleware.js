const logger = require("../utils/logger");

const authenticateRequest = (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    logger.warn("Unauthorized access attempt without user ID");
    return res.status(401).json({
      success: false,
      message: "Unauthorized: User ID missing,Please login to continue",
    });
  }

  req.user = { userId };
  next();
};

module.exports = authenticateRequest;
