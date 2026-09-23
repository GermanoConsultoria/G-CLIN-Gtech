-- Adiciona dados de identificação legal/contato da clínica.

ALTER TABLE public.clinic_settings
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS contact_email text;
