import { Hono } from 'hono';
import multer from 'multer';
import pool from '../config/database.js';
import { deleteImageFromS3, generatePresignedUrl, uploadImageToS3 } from '../config/s3.js';
import { authMiddleware } from '../middleware/auth.js';
const images = new Hono();
// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed'));
        }
    }
});
// Upload single image
images.post('/upload', authMiddleware, async (c) => {
    try {
        // Use multer to handle file upload
        const multerMiddleware = upload.single('image');
        await new Promise((resolve, reject) => {
            multerMiddleware(c.req.raw, {}, (err) => {
                if (err)
                    reject(err);
                else
                    resolve(true);
            });
        });
        const file = c.req.raw.file;
        if (!file) {
            return c.json({ error: 'No image file provided' }, 400);
        }
        // Get folder from query params or default to 'products'
        const folder = c.req.query('folder') || 'products';
        // Upload to S3
        const uploadedImage = await uploadImageToS3(file, folder);
        // Store image metadata in database
        const result = await pool.query('INSERT INTO images (image) VALUES ($1) RETURNING id', [uploadedImage.url] // Store S3 URL instead of binary data
        );
        const imageId = result.rows[0].id;
        return c.json({
            message: 'Image uploaded successfully',
            image: {
                id: imageId,
                ...uploadedImage
            }
        }, 201);
    }
    catch (error) {
        console.error('Image upload error:', error);
        if (error instanceof Error) {
            return c.json({ error: error.message }, 400);
        }
        return c.json({ error: 'Failed to upload image' }, 500);
    }
});
// Upload multiple images
images.post('/upload-multiple', authMiddleware, async (c) => {
    try {
        const multerMiddleware = upload.array('images', 10); // Max 10 images
        await new Promise((resolve, reject) => {
            multerMiddleware(c.req.raw, {}, (err) => {
                if (err)
                    reject(err);
                else
                    resolve(true);
            });
        });
        const files = c.req.raw.files;
        if (!files || files.length === 0) {
            return c.json({ error: 'No image files provided' }, 400);
        }
        const folder = c.req.query('folder') || 'products';
        const uploadedImages = [];
        for (const file of files) {
            try {
                const uploadedImage = await uploadImageToS3(file, folder);
                // Store in database
                const result = await pool.query('INSERT INTO images (image) VALUES ($1) RETURNING id', [uploadedImage.url]);
                uploadedImages.push({
                    id: result.rows[0].id,
                    ...uploadedImage
                });
            }
            catch (error) {
                console.error(`Failed to upload ${file.originalname}:`, error);
            }
        }
        return c.json({
            message: `${uploadedImages.length} images uploaded successfully`,
            images: uploadedImages
        }, 201);
    }
    catch (error) {
        console.error('Multiple image upload error:', error);
        if (error instanceof Error) {
            return c.json({ error: error.message }, 400);
        }
        return c.json({ error: 'Failed to upload images' }, 500);
    }
});
// Get image by ID
images.get('/:id', async (c) => {
    try {
        const imageId = parseInt(c.req.param('id'));
        if (isNaN(imageId)) {
            return c.json({ error: 'Invalid image ID' }, 400);
        }
        const result = await pool.query('SELECT id, image FROM images WHERE id = $1', [imageId]);
        if (result.rows.length === 0) {
            return c.json({ error: 'Image not found' }, 404);
        }
        return c.json({ image: result.rows[0] });
    }
    catch (error) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
// Delete image
images.delete('/:id', authMiddleware, async (c) => {
    try {
        const imageId = parseInt(c.req.param('id'));
        if (isNaN(imageId)) {
            return c.json({ error: 'Invalid image ID' }, 400);
        }
        // Get image details before deletion
        const imageResult = await pool.query('SELECT image FROM images WHERE id = $1', [imageId]);
        if (imageResult.rows.length === 0) {
            return c.json({ error: 'Image not found' }, 404);
        }
        const imageUrl = imageResult.rows[0].image;
        // Extract S3 key from URL
        const urlParts = imageUrl.split('/');
        const key = urlParts.slice(-2).join('/'); // folder/filename
        // Delete from S3
        try {
            await deleteImageFromS3(key);
        }
        catch (s3Error) {
            console.error('Failed to delete from S3:', s3Error);
            // Continue with database deletion even if S3 fails
        }
        // Delete from database
        await pool.query('DELETE FROM images WHERE id = $1', [imageId]);
        return c.json({ message: 'Image deleted successfully' });
    }
    catch (error) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
// Generate presigned URL for direct upload
images.post('/presigned-url', authMiddleware, async (c) => {
    try {
        const body = await c.req.json();
        const { filename, folder = 'products', expiresIn = 3600 } = body;
        if (!filename) {
            return c.json({ error: 'Filename is required' }, 400);
        }
        const key = `${folder}/${Date.now()}-${filename}`;
        const presignedUrl = await generatePresignedUrl(key, 'put', expiresIn);
        return c.json({
            upload_url: presignedUrl,
            key: key,
            expires_in: expiresIn
        });
    }
    catch (error) {
        return c.json({ error: 'Failed to generate presigned URL' }, 500);
    }
});
// Get images by folder
images.get('/folder/:folder', async (c) => {
    try {
        const folder = c.req.param('folder');
        const page = parseInt(c.req.query('page') || '1');
        const limit = parseInt(c.req.query('limit') || '20');
        const offset = (page - 1) * limit;
        // Get images that contain the folder in their URL
        const result = await pool.query(`SELECT id, image FROM images 
       WHERE image LIKE $1 
       ORDER BY id DESC 
       LIMIT $2 OFFSET $3`, [`%${folder}/%`, limit, offset]);
        // Get total count
        const countResult = await pool.query('SELECT COUNT(*) FROM images WHERE image LIKE $1', [`%${folder}/%`]);
        const total = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(total / limit);
        return c.json({
            images: result.rows,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    }
    catch (error) {
        return c.json({ error: 'Internal server error' }, 500);
    }
});
export default images;
