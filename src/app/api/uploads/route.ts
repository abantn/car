import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, runQuery, getQuery } from '@/lib/database';
import { calculateVideoDeletionDate } from '@/lib/calculations';
import fs from 'fs-extra';
import path from 'path';
import { writeFile } from 'fs/promises';

// Initialize database on first request
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

// Ensure upload directories exist
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const VIDEOS_DIR = path.join(UPLOAD_DIR, 'videos');
const PHOTOS_DIR = path.join(UPLOAD_DIR, 'photos');

async function ensureUploadDirs() {
  await fs.ensureDir(UPLOAD_DIR);
  await fs.ensureDir(VIDEOS_DIR);
  await fs.ensureDir(PHOTOS_DIR);
}

// File size limits (in bytes)
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;  // 10MB

// Allowed file types
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// POST handle file uploads
export async function POST(request: NextRequest) {
  try {
    await ensureDb();
    await ensureUploadDirs();
    
    const formData = await request.formData();
    const uploadType = formData.get('upload_type') as string; // 'video', 'id_photo', 'damage_photo'
    const carId = formData.get('car_id') as string;
    const rentalId = formData.get('rental_id') as string;
    const customerId = formData.get('customer_id') as string;
    const videoType = formData.get('video_type') as string; // 'before', 'after'
    const photoType = formData.get('photo_type') as string; // 'license_front', 'license_back'
    const damageDescription = formData.get('damage_description') as string;
    const damageSeverity = formData.get('damage_severity') as string;
    const daysToKeep = parseInt(formData.get('days_to_keep') as string) || 30;
    
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file type and size
    let uploadDir: string;
    let maxFileSize: number;
    let allowedTypes: string[];
    
    if (uploadType === 'video') {
      uploadDir = VIDEOS_DIR;
      maxFileSize = MAX_VIDEO_SIZE;
      allowedTypes = ALLOWED_VIDEO_TYPES;
    } else if (uploadType === 'id_photo' || uploadType === 'damage_photo') {
      uploadDir = PHOTOS_DIR;
      maxFileSize = MAX_PHOTO_SIZE;
      allowedTypes = ALLOWED_PHOTO_TYPES;
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid upload type' },
        { status: 400 }
      );
    }
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `File type ${file.type} is not allowed` },
        { status: 400 }
      );
    }
    
    if (file.size > maxFileSize) {
      const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
      return NextResponse.json(
        { success: false, error: `File size exceeds maximum limit of ${maxSizeMB}MB` },
        { status: 400 }
      );
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileExtension = path.extname(file.name);
    const filename = `${timestamp}_${randomString}${fileExtension}`;
    const filePath = path.join(uploadDir, filename);
    
    // Save file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);
    
    // Create public URL
    const publicUrl = `/uploads/${uploadType === 'video' ? 'videos' : 'photos'}/${filename}`;
    
    // Save to database based on upload type
    if (uploadType === 'video') {
      if (!carId || !videoType) {
        return NextResponse.json(
          { success: false, error: 'Missing car_id or video_type for video upload' },
          { status: 400 }
        );
      }
      
      const deleteAfterDate = calculateVideoDeletionDate(new Date().toISOString(), daysToKeep);
      
      await runQuery(
        `INSERT INTO videos (car_id, rental_id, video_type, video_url, file_size, delete_after_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [carId, rentalId, videoType, publicUrl, file.size, deleteAfterDate]
      );
      
      return NextResponse.json({
        success: true,
        data: {
          url: publicUrl,
          file_size: file.size,
          video_type: videoType,
          delete_after_date: deleteAfterDate,
          message: 'Video uploaded successfully'
        }
      });
      
    } else if (uploadType === 'id_photo') {
      if (!customerId) {
        return NextResponse.json(
          { success: false, error: 'Missing customer_id for ID photo upload' },
          { status: 400 }
        );
      }
      
      // Check if ID verification record exists
      const existingVerification = await getQuery(
        'SELECT id FROM id_verifications WHERE rental_id = ? OR (customer_id = ? AND rental_id IS NULL)',
        [rentalId, customerId]
      );
      
      if (existingVerification) {
        // Update existing record
        const updateField = photoType === 'license_front' ? 'license_front_url' : 'license_back_url';
        await runQuery(
          `UPDATE id_verifications SET ${updateField} = ? WHERE id = ?`,
          [publicUrl, existingVerification.id]
        );
      } else {
        // Create new record
        await runQuery(
          `INSERT INTO id_verifications (customer_id, rental_id, ${photoType})
           VALUES (?, ?, ?)`,
          [customerId, rentalId, publicUrl]
        );
      }
      
      return NextResponse.json({
        success: true,
        data: {
          url: publicUrl,
          photo_type: photoType,
          message: 'ID photo uploaded successfully'
        }
      });
      
    } else if (uploadType === 'damage_photo') {
      if (!carId || !damageDescription) {
        return NextResponse.json(
          { success: false, error: 'Missing car_id or damage_description for damage photo' },
          { status: 400 }
        );
      }
      
      await runQuery(
        `INSERT INTO damages (car_id, rental_id, description, severity, photo_url, status)
         VALUES (?, ?, ?, ?, ?, 'reported')`,
        [carId, rentalId, damageDescription, damageSeverity || 'minor', publicUrl]
      );
      
      return NextResponse.json({
        success: true,
        data: {
          url: publicUrl,
          damage_description: damageDescription,
          severity: damageSeverity || 'minor',
          message: 'Damage report uploaded successfully'
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        url: publicUrl,
        message: 'File uploaded successfully'
      }
    });
    
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// GET check storage usage and get upload info
export async function GET(request: NextRequest) {
  try {
    await ensureDb();
    
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    
    if (action === 'storage_usage') {
      // Get storage usage statistics
      const videos = await getQuery('SELECT SUM(file_size) as total_size FROM videos');
      const videoCount = await getQuery('SELECT COUNT(*) as count FROM videos');
      
      const totalSize = videos?.total_size || 0;
      const totalSizeMB = Math.round(totalSize / (1024 * 1024));
      const totalSizeGB = Math.round(totalSize / (1024 * 1024 * 1024) * 100) / 100;
      
      return NextResponse.json({
        success: true,
        data: {
          total_size_bytes: totalSize,
          total_size_mb: totalSizeMB,
          total_size_gb: totalSizeGB,
          video_count: videoCount?.count || 0,
          storage_limit_mb: 1000, // 1GB limit
          storage_usage_percent: Math.round((totalSizeMB / 1000) * 100)
        }
      });
    }
    
    if (action === 'cleanup_expired') {
      // Clean up expired videos
      const now = new Date().toISOString();
      const deletedVideos = await getQuery(
        'SELECT video_url FROM videos WHERE delete_after_date <= ?',
        [now]
      );
      
      if (deletedVideos) {
        // Delete files from filesystem
        for (const video of [deletedVideos]) {
          if (video.video_url) {
            const filePath = path.join(process.cwd(), 'public', video.video_url);
            try {
              await fs.remove(filePath);
            } catch (error) {
              console.error('Failed to delete video file:', error);
            }
          }
        }
        
        // Delete from database
        await getQuery('DELETE FROM videos WHERE delete_after_date <= ?', [now]);
      }
      
      return NextResponse.json({
        success: true,
        data: {
          deleted_count: deletedVideos ? Object.keys(deletedVideos).length : 0,
          message: 'Cleanup completed successfully'
        }
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });
    
  } catch (error) {
    console.error('Error in upload GET:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

// DELETE remove uploaded files
export async function DELETE(request: NextRequest) {
  try {
    await ensureDb();
    
    const { searchParams } = new URL(request.url);
    const fileType = searchParams.get('file_type'); // 'video', 'damage', 'id_verification'
    const recordId = searchParams.get('record_id');
    
    if (!fileType || !recordId) {
      return NextResponse.json(
        { success: false, error: 'Missing file_type or record_id' },
        { status: 400 }
      );
    }
    
    if (fileType === 'video') {
      const video = await getQuery('SELECT * FROM videos WHERE id = ?', [recordId]);
      if (video && video.video_url) {
        // Delete file from filesystem
        const filePath = path.join(process.cwd(), 'public', video.video_url);
        await fs.remove(filePath);
        
        // Delete from database
        await getQuery('DELETE FROM videos WHERE id = ?', [recordId]);
      }
    } else if (fileType === 'damage') {
      const damage = await getQuery('SELECT * FROM damages WHERE id = ?', [recordId]);
      if (damage && damage.photo_url) {
        // Delete file from filesystem
        const filePath = path.join(process.cwd(), 'public', damage.photo_url);
        await fs.remove(filePath);
        
        // Delete from database
        await getQuery('DELETE FROM damages WHERE id = ?', [recordId]);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'File deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}