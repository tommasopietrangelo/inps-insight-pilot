UPDATE public.sources
SET publication_date = COALESCE(
  CASE
    WHEN official_url ~ '\.news\.\d{4}\.\d{2}\.'
      THEN to_date(
        substring(official_url from '\.news\.(\d{4}\.\d{2})\.') || '.01',
        'YYYY.MM.DD'
      )
    WHEN official_url ~ '/notizie/\d{4}[./]\d{2}[./]'
      THEN to_date(
        regexp_replace(substring(official_url from '/notizie/(\d{4}[./]\d{2})[./]'), '\.', '-', 'g') || '-01',
        'YYYY-MM-DD'
      )
    ELSE CURRENT_DATE
  END,
  CURRENT_DATE
)
WHERE source_type = 'notizia' AND publication_date > CURRENT_DATE;