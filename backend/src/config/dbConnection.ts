import mongoose from "mongoose";

import logger from "./loggingConfig";
import { env } from "../utils/env";

export const connectDB = async () => {
  // Set up MongoDB connection string
  // Don't include credentials formatting if username/password not present
  const mongodbCredentials = env.MONGODB_APP_USER ? `${env.MONGODB_APP_USER}:${env.MONGODB_APP_PASSWORD}@` : ''
  const mongodbUrl = `${env.MONGODB_URI_PREFIX}://${mongodbCredentials}${env.MONGODB_HOST}/${env.MONGODB_APP_DATABASE_NAME}?${env.MONGODB_OPTION_PARAMS}`

  try {
    // Only log the MongoDB URL in non-production environments
    if (env.NODE_ENV !== 'production') {
      logger.info(`Connecting to MongoDB with URL: ${mongodbUrl}`);
    }
    await mongoose.connect(mongodbUrl, {
      minPoolSize: env.MONGODB_MIN_POOL_SIZE,
      maxPoolSize: env.MONGODB_MAX_POOL_SIZE
    });
    logger.info("Successful connection to MongoDB.");
  } catch (error) {
    logger.error('Failed connection to MongoDB:', error);
  }
};