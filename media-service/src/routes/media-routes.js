const express = require("express");
const multer = require("multer");
const {
  uploadMedia,
  getAllMedias,
} = require("../controllers/media-controller");
const { authenticateRequest } = require("../middleware/authMiddleware");
const logger = require("../utils/logger");

const router = express.Router();

//configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, //10MB file size limit
}).single("file");

router.post(
  "/upload",
  authenticateRequest,
  (req, res, next) => {
    upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        logger.error("Multer error during file upload", err);
        return res
          .status(400)
          .json({ success: false, message: err.message, stack: err.stack });
      } else if (err) {
        logger.error("Unknown Error during file upload", err);
        return res
          .status(400)
          .json({ success: false, message: err.message, stack: err.stack });
      } else {
        if (!req.file) {
          logger.error("File not found in request");
          return res
            .status(400)
            .json({ success: false, message: "File not found" });
        }
        next(); //pass control to next middleware which is the uploadMedia controller
      }
    });
  },
  uploadMedia,
);

router.get("/get", authenticateRequest, getAllMedias);

module.exports = router;
