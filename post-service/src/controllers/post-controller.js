const logger = require("../utils/logger");
const Post = require("../models/Post");
const { validateCreatePost } = require("../utils/validation");
const { publishEvent } = require("../utils/rabbitmq");

async function invalidateCache(req, input) {
  const cachedKey = `post:${input}`;
  await req.redisClient.del(cachedKey);
  logger.info(`Cache invalidated for key: ${cachedKey}`);
  const keys = await req.redisClient.keys("posts:*");
  if (keys.length > 0) {
    await req.redisClient.del(keys);
    logger.info("Cache invalidated for keys:", keys);
  }
  //we need the post id to add event to queue which will be consumed by search service to update its index and media service
}

const createPost = async (req, res) => {
  logger.info("Create post request received with data:", req.body);
  try {
    const { content, mediaIds } = req.body;
    const { error } = validateCreatePost({ content, mediaIds });
    if (error) {
      logger.error("Validation error:", error.details[0].message);
      return res
        .status(400)
        .json({ success: false, message: error.details[0].message });
    }
    if (!content) {
      logger.error("Content is required for a post");
      return res
        .status(400)
        .json({ success: false, message: "Content is required for a post" });
    }
    const newPost = new Post({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || [],
    });
    await newPost.save();

    //publishing post.created event to rabbitmq which will be consumed by search service to update its index and media service to link media with the post

    await publishEvent("post.created", {
      postId: newPost._id.toString(),
      userId: newPost.user.toString(),
      content: newPost.content,
      createdAt: newPost.createdAt,
    });

    await invalidateCache(req, newPost._id.toString());
    logger.info("Post created successfully", newPost);
    logger.info("Cache invalidated after post creation");
    res
      .status(201)
      .json({ success: true, message: "Post created successfully" });
  } catch (error) {
    logger.error("Error creating post:", error);
    res.status(500).json({ success: false, message: "Error creating post" });
  }
};

const getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;

    const cachekey = `posts:${page}:${limit}`;
    const cachedPosts = await req.redisClient.get(cachekey);

    if (cachedPosts) {
      return res.json(JSON.parse(cachedPosts));
    }

    const posts = await Post.find({})
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    const totalNoOfPosts = await Post.countDocuments();

    const result = {
      posts,
      currentPage: page,
      totalPages: Math.ceil(totalNoOfPosts / limit),
      totalPosts: totalNoOfPosts,
    };

    //save posts in redis
    await req.redisClient.setex(cachekey, 300, JSON.stringify(result)); // Cache for 1 hour

    res.json(result);
  } catch (error) {
    logger.error("Error fetching posts:", error);
    res.status(500).json({ success: false, message: "Error fetching posts" });
  }
};

const getPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const cacheKey = `post:${postId}`;
    const cachedPost = await req.redisClient.get(cacheKey);
    if (cachedPost) {
      return res.json(JSON.parse(cachedPost));
    }
    // Fetch post from database by id
    const post = await Post.findById(postId);
    if (!post) {
      logger.warn(`Post with ID ${postId} not found`);
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }
    // Save post in Redis cache for future requests
    await req.redisClient.setex(cacheKey, 3600, JSON.stringify(post)); // Cache for 1 hour
    res.json(post);
  } catch (error) {
    logger.error("Error fetching post:", error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching post by ID" });
  }
};

const deletePost = async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId,
    });
    if (!post) {
      logger.warn(
        `Post with ID ${req.params.id} not found or user not authorized to delete`,
      );
      return res
        .status(404)
        .json({ success: false, message: "Post not found or unauthorized" });
    }
    await invalidateCache(req, post._id.toString());
    //publish post delete event to rabbitmq which will be consumed by search service to update its index and media service to delete media associated with the post
    await publishEvent("post.deleted", {
      postId: post._id.toString(),
      userId: req.user.userId,
      mediaIds: post.mediaIds,
    });
    logger.info(`Post with ID ${post._id} deleted successfully`);
    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    logger.error("Error deleting post:", error);
    res
      .status(500)
      .json({ success: false, message: "Error deleting post by ID" });
  }
};

module.exports = {
  createPost,
  getAllPosts,
  getPost,
  deletePost,
};
