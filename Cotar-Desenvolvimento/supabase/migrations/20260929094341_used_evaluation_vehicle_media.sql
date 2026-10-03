UPDATE storage.buckets
SET file_size_limit=10485760,
    allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp','video/mp4','video/webm']
WHERE id='cotar-private';
