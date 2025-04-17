import multer from "multer";
import multerS3 from "multer-s3";
import { S3 } from "@aws-sdk/client-s3";

import path from "path";
import crypto from "crypto";

import { env } from "./env";

// Set S3 endpoint to DigitalOcean Spaces
const s3 = new S3({
  forcePathStyle: false, // Configures to use subdomain/virtual calling format.
  endpoint: env.DIGITAL_OCEAN_BUCKET_ORIGIN_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: env.DIGITAL_OCEAN_BUCKET_ACCESS_KEY,
    secretAccessKey: env.DIGITAL_OCEAN_BUCKET_SECRET_KEY
  }
});

const getExtension = (fileName: string) => path.extname(fileName).toLowerCase();

const storage = multerS3({
  s3,
  bucket: env.DIGITAL_OCEAN_BUCKET_NAME,
  acl: 'public-read',
  contentType: multerS3.AUTO_CONTENT_TYPE,
  key: function (request: any, file: any, callback: any) {
    const extension = getExtension(file.originalname);
    callback(null, `${crypto.randomUUID()}${extension}`);
  }
});

const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  const extension = getExtension(file.originalname);
  if (!(extension === ".jpg" || extension === ".jpeg" || extension === ".png")) {
    const error: any = {
      code: "INVALID_FILE_TYPE",
      message: "Wrong format for file",
    };
    cb(new Error(error.message));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter
});

export default upload;