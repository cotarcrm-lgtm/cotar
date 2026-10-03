INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('cotar-private','cotar-private',false,2097152,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
