import { Hono } from "hono";
import { generatePresignedUrl } from "../config/s3.js";

const images = new Hono();

// Generate presigned URL for image upload
images.post("/presigned-url", async (c) => {
  try {
    const body = await c.req.json();
    const { filename, contentType, folder } = body;

    // Validate required fields
    if (!filename || typeof filename !== "string") {
      return c.json({ error: "Valid filename required" }, 400);
    }

    // Validate content type (only images)
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (contentType && !validTypes.includes(contentType)) {
      return c.json({ error: "Invalid content type. Only images are allowed" }, 400);
    }

    // Generate unique key with timestamp
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const folderPath = folder || "images";
    const key = `${folderPath}/${timestamp}-${sanitizedFilename}`;

    // Generate presigned URL for PUT operation (upload)
    const presignedUrl = await generatePresignedUrl(key, "put", 3600); // 1 hour expiration

    // Return presigned URL and the key for future reference
    return c.json({
      presignedUrl,
      key,
      expiresIn: 3600,
      publicUrl: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`,
    });
  } catch {
    return c.json({ error: "Failed to generate presigned URL" }, 500);
  }
});

export default images;
