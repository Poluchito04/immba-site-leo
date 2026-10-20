-- English department names for faculty (Chinese ones came from the official Chinese page)
update public.faculty set department = case department_zh
  when '統計資訊系專任' then 'Department of Statistics and Information Science (full-time)'
  when '商學博士班專任' then 'Ph.D. Program in Business (full-time)'
  when '企業管理系專任' then 'Department of Business Administration (full-time)'
  when '金融國企系專任' then 'Department of Finance and International Business (full-time)'
  when '跨文化研究所專任' then 'Graduate Institute of Intercultural Studies (full-time)'
  else department end
where department is null and department_zh is not null;
