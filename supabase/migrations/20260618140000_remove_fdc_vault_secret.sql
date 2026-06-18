-- Run AFTER setting FDC_API_KEY in Supabase Edge Function secrets and verifying manual food search.
DELETE FROM vault.secrets WHERE name = 'fdc_api_key';
