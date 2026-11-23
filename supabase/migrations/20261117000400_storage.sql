-- =============================================================================
-- Armazenamento de imagens (Supabase Storage)
--
-- Bucket "product-images":
--   • público para leitura (as fotos aparecem no cardápio sem login)
--   • somente administradores enviam, substituem ou apagam arquivos
--   • limite de 5 MB por arquivo; apenas JPEG, PNG e WebP
-- Os arquivos ficam em products/<id-do-produto>/<arquivo>
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "product-images: admin envia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = 'products'
    and (select public.is_admin())
  );

create policy "product-images: admin substitui"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()))
  with check (bucket_id = 'product-images' and (select public.is_admin()));

create policy "product-images: admin apaga"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));

-- Listagem/metadados pela API só para admins (o download público pela URL do
-- bucket não depende desta política)
create policy "product-images: admin lista"
  on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
