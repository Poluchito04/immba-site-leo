-- The university serves its files from /smarteditupfiles/... at the site root.
-- Earlier copies used /esubweb/immbaengindex/smarteditupfiles/... and /subweb/immba/smarteditupfiles/..., which return 404.
-- Safe to re-run.
update public.downloads
set file_url = regexp_replace(file_url, '^https://www\.management\.fju\.edu\.tw/(esubweb/immbaengindex|subweb/immba)/smarteditupfiles/', 'https://www.management.fju.edu.tw/smarteditupfiles/')
where file_url ~ '/(esubweb/immbaengindex|subweb/immba)/smarteditupfiles/';

update public.pages
set body_en = regexp_replace(body_en, 'https://www\.management\.fju\.edu\.tw/(esubweb/immbaengindex|subweb/immba)/smarteditupfiles/', 'https://www.management.fju.edu.tw/smarteditupfiles/', 'g'),
    body_zh = regexp_replace(body_zh, 'https://www\.management\.fju\.edu\.tw/(esubweb/immbaengindex|subweb/immba)/smarteditupfiles/', 'https://www.management.fju.edu.tw/smarteditupfiles/', 'g');
