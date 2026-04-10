const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    mediaIds: [{ type: String }], // Array of media IDs
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

//because we will be having a different service for search,there's no need to create index here
postSchema.index({ content: "text" });

const Post = mongoose.model("Post", postSchema);
module.exports = Post;
