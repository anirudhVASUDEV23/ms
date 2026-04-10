const logger = require("../utils/logger");
const Media = require("../models/Media");
const { uploadMediaToCloudinary } = require("../utils/cloudinary");

const uploadMedia = async (req, res) => {
  logger.info("Upload media request received");
  try {
    if (!req.file) {
      logger.error("File not found");
      return res
        .status(400)
        .json({ success: false, message: "File not found" });
    }
    const { originalname, mimetype, buffer } = req.file;
    const userId = req.user.userId;
    logger.info(
      `Uploading media for user ${userId} with original name ${originalname} and mime type ${mimetype}`,
    );
    logger.info("Uploading to cloudinary... ");
    const cloudinaryUploadResult = await uploadMediaToCloudinary(req.file);
    logger.info(
      "Cloudinary upload Successful.Public ID: %s",
      cloudinaryUploadResult.public_id,
    );
    const media = await Media.create({
      publicId: cloudinaryUploadResult.public_id,
      originalName: originalname,
      mimeType: mimetype,
      url: cloudinaryUploadResult.secure_url,
      userId,
    });
    await media.save();
    return res.status(201).json({
      success: true,
      mediaId: media._id,
      url: media.url,
      message: "Media uploaded successfully",
    });
  } catch (error) {
    logger.error("Error occurred while uploading media", error);
    return res.status(500).json({
      success: false,
      message: "Error occurred while uploading media",
    });
  }
};

const getAllMedias = async (req, res) => {
  try {
    const medias = await Media.find({});
    return res.status(200).json({ medias });
  } catch (error) {
    logger.error("Error occurred while fetching media", error);
    return res.status(500).json({
      success: false,
      message: "Error occurred while fetching media",
    });
  }
};

module.exports = { uploadMedia, getAllMedias };
