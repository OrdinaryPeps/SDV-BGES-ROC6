from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from pathlib import Path
from datetime import datetime, timezone, timedelta
from PIL import Image
import uuid
import os
import io
import asyncio
from ..core.deps import get_current_user, is_admin_role
from ..models.user import User
from ..core.logging import logger

router = APIRouter()

# Configuration
UPLOAD_DIR = Path("/var/www/botsdv/SDV-BGES-ROC6/uploads")
ORIGINAL_DIR = UPLOAD_DIR / "originals"
THUMBNAIL_DIR = UPLOAD_DIR / "thumbnails"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
THUMBNAIL_SIZE = (200, 200)
ORIGINAL_MAX_SIZE = (1200, 1200)  # Compress original to max 1200px
ORIGINAL_QUALITY = 80  # JPEG quality for originals
THUMBNAIL_QUALITY = 70  # JPEG quality for thumbnails
AUTO_DELETE_DAYS = 30  # Delete originals after 30 days

# Ensure directories exist
ORIGINAL_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)


def compress_image(image: Image.Image, max_size: tuple, quality: int) -> io.BytesIO:
    """Compress and resize image, convert to JPEG"""
    # Convert to RGB if necessary (for PNG with transparency)
    if image.mode in ('RGBA', 'P'):
        background = Image.new('RGB', image.size, (255, 255, 255))
        if image.mode == 'RGBA':
            background.paste(image, mask=image.split()[3])
        else:
            background.paste(image)
        image = background
    elif image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Resize if larger than max_size
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    
    # Save to buffer
    buffer = io.BytesIO()
    image.save(buffer, format='JPEG', quality=quality, optimize=True)
    buffer.seek(0)
    return buffer


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload image with compression and thumbnail generation"""
    
    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Format tidak didukung. Gunakan: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Read file content
    content = await file.read()
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File terlalu besar. Maksimal {MAX_FILE_SIZE // (1024*1024)}MB")
    
    try:
        # Open image
        image = Image.open(io.BytesIO(content))
        
        # Generate unique filename
        file_id = str(uuid.uuid4())
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{file_id}.jpg"
        
        # Compress original
        original_buffer = compress_image(image.copy(), ORIGINAL_MAX_SIZE, ORIGINAL_QUALITY)
        original_path = ORIGINAL_DIR / filename
        with open(original_path, 'wb') as f:
            f.write(original_buffer.getvalue())
        
        # Generate thumbnail
        thumbnail_buffer = compress_image(image.copy(), THUMBNAIL_SIZE, THUMBNAIL_QUALITY)
        thumbnail_path = THUMBNAIL_DIR / filename
        with open(thumbnail_path, 'wb') as f:
            f.write(thumbnail_buffer.getvalue())
        
        # Get file sizes
        original_size = os.path.getsize(original_path)
        thumbnail_size = os.path.getsize(thumbnail_path)
        
        logger.info(f"Image uploaded: {filename} (original: {original_size//1024}KB, thumbnail: {thumbnail_size//1024}KB)")
        
        return {
            "success": True,
            "filename": filename,
            "original_url": f"/api/uploads/originals/{filename}",
            "thumbnail_url": f"/api/uploads/thumbnails/{filename}",
            "original_size": original_size,
            "thumbnail_size": thumbnail_size,
            "uploaded_by": current_user.username,
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"Failed to process image: {e}")
        raise HTTPException(status_code=400, detail="Gagal memproses gambar")


@router.get("/originals/{filename}")
async def get_original(filename: str):
    """Serve original image"""
    file_path = ORIGINAL_DIR / filename
    if not file_path.exists():
        # Check if thumbnail exists (original may have been deleted)
        thumb_path = THUMBNAIL_DIR / filename
        if thumb_path.exists():
            raise HTTPException(status_code=410, detail="Gambar asli sudah dihapus, gunakan thumbnail")
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    return FileResponse(file_path, media_type="image/jpeg")


@router.get("/thumbnails/{filename}")
async def get_thumbnail(filename: str):
    """Serve thumbnail image"""
    file_path = THUMBNAIL_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail tidak ditemukan")
    return FileResponse(file_path, media_type="image/jpeg")


async def cleanup_old_originals():
    """Delete original images older than AUTO_DELETE_DAYS (run via cron)"""
    cutoff = datetime.now() - timedelta(days=AUTO_DELETE_DAYS)
    deleted_count = 0
    
    for file_path in ORIGINAL_DIR.iterdir():
        if file_path.is_file():
            # Get file modification time
            mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
            if mtime < cutoff:
                try:
                    file_path.unlink()
                    deleted_count += 1
                    logger.info(f"Auto-deleted old original: {file_path.name}")
                except Exception as e:
                    logger.error(f"Failed to delete {file_path.name}: {e}")
    
    return deleted_count


@router.delete("/cleanup")
async def manual_cleanup(current_user: User = Depends(get_current_user)):
    """Manually trigger cleanup of old originals (admin only)"""
    if not is_admin_role(current_user.role):
        raise HTTPException(status_code=403, detail="Hak akses admin diperlukan")
    
    deleted = await cleanup_old_originals()
    return {"message": f"Deleted {deleted} old original images"}
