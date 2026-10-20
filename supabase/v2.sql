-- imMBA backend v2: bilingual faculty, CMS pages, downloads, marketplace (moderated), audit log, page views.
-- Safe to re-run. Requires schema.sql + news.sql first.

-- 1. Faculty: Chinese fields ------------------------------------------------
alter table public.faculty
  add column if not exists name_zh text, add column if not exists title_zh text,
  add column if not exists department_zh text, add column if not exists education_zh text,
  add column if not exists research_fields_zh text;

-- 2. News: news vs event ------------------------------------------------------
alter table public.news add column if not exists kind text not null default 'news';
alter table public.news drop constraint if exists news_kind_check;
alter table public.news add constraint news_kind_check check (kind in ('news','event'));

-- 3. CMS pages (About / Admissions / Curriculum / ...) ----------------------
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  section text not null default 'more' check (section in ('about','admissions','curriculum','more')),
  title_en text, title_zh text, body_en text, body_zh text,
  source_url_en text, source_url_zh text,
  sort_order integer not null default 0,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);
create or replace function public.touch_updated_at() returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists pages_touch on public.pages;
create trigger pages_touch before update on public.pages for each row execute function public.touch_updated_at();

-- 4. Downloads ---------------------------------------------------------------
create table if not exists public.downloads (
  id uuid primary key default gen_random_uuid(),
  title_en text, title_zh text,
  file_url text not null,
  file_type text not null default 'PDF' check (file_type in ('PDF','DOC','XLS','PPT','OTHER')),
  category text not null default 'other' check (category in ('admissions','curriculum','graduation','dual','other')),
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  constraint downloads_has_title check (coalesce(title_en,'') <> '' or coalesce(title_zh,'') <> '')
);

-- 5. Marketplace listings (visitors submit -> admins approve) --------------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 1000),
  price numeric(10,2) not null default 0 check (price >= 0 and price <= 100000),
  category text not null default 'books' check (category in ('books','notes','electronics','other')),
  seller_name text not null check (char_length(seller_name) between 2 and 80),
  contact text not null check (char_length(contact) between 3 and 120),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

-- 6. Audit log + page views ---------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null, action text not null, row_label text, actor_email text,
  created_at timestamptz not null default now()
);
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  path text not null check (char_length(path) <= 200),
  lang text not null default 'en' check (lang in ('en','zh')),
  created_at timestamptz not null default now()
);
create index if not exists page_views_created_idx on public.page_views (created_at desc);

create or replace function public.log_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; who text;
begin
  r := to_jsonb(coalesce(new, old));
  select email into who from public.profiles where id = auth.uid();
  who := coalesce(who, case when auth.uid() is null and session_user = 'postgres' then 'system' else 'visitor' end);
  insert into public.audit_log (table_name, action, row_label, actor_email)
  values (tg_table_name, tg_op, left(coalesce(r->>'title_en', r->>'title', r->>'name', r->>'title_zh', r->>'slug', ''), 120), who);
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['faculty','news','pages','downloads','listings'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.log_change()', t);
  end loop;
end $$;

-- 7. Row Level Security -----------------------------------------------------
alter table public.pages      enable row level security;
alter table public.downloads  enable row level security;
alter table public.listings   enable row level security;
alter table public.audit_log  enable row level security;
alter table public.page_views enable row level security;

do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname='public' and tablename in ('pages','downloads','listings','audit_log','page_views') loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy "pages read"    on public.pages for select using (published or public.is_admin());
create policy "pages insert"  on public.pages for insert with check (public.is_admin());
create policy "pages update"  on public.pages for update using (public.is_admin()) with check (public.is_admin());
create policy "pages delete"  on public.pages for delete using (public.is_admin());

create policy "downloads read"   on public.downloads for select using (published or public.is_admin());
create policy "downloads insert" on public.downloads for insert with check (public.is_admin());
create policy "downloads update" on public.downloads for update using (public.is_admin()) with check (public.is_admin());
create policy "downloads delete" on public.downloads for delete using (public.is_admin());

create policy "listings read approved"  on public.listings for select using (status = 'approved' or public.is_admin());
create policy "listings submit pending" on public.listings for insert with check (status = 'pending' or public.is_admin());
create policy "listings admin update"   on public.listings for update using (public.is_admin()) with check (public.is_admin());
create policy "listings admin delete"   on public.listings for delete using (public.is_admin());

create policy "audit admin read" on public.audit_log for select using (public.is_admin());
create policy "views admin read" on public.page_views for select using (public.is_admin());
create policy "views anyone insert" on public.page_views for insert with check (true);

-- 8. Data -----------------------------------------------------------------
update public.news set kind = 'event'
 where title_en ilike '%Kickoff Lunch%' or title_en ilike '%Get to Know Fu Jen imMBA at Our Info Session%';
delete from public.downloads;

-- CMS pages (EN + ZH, imported from the official site)
insert into public.pages (slug,section,sort_order,title_en,title_zh,body_en,body_zh,source_url_en,source_url_zh) values
  ('overview','about',1,'Overview and Ranking','特色與排名','Fu Jen MBA in International Management (imMBA) is [AACSB accredited](https://www.aacsb.edu/educators/accreditation), designed to equip students with practical business and management knowledge from a global perspective to enhance their [international mobility](http://www.management.fju.edu.tw/esubweb/immbaengindex/subedit.php?EID=24). Only 5% best business schools worldwide are accredited by AACSB.

[The curriculum](https://www.management.fju.edu.tw/esubweb/immbaengindex/class.php?CID=1) delivers a strong understanding of how the world is interconnected through marketing, operations, finance, human resources, technology, and strategy to help students meet the challenges of the up-to-date global economy.

◎Ranked Top 3 in Taiwan, Top 20 in Far East Asia in International Management

According to [Eduniversal 2025](https://best-masters.com/master-international-management-ranking/far-east-asia.html), Fu Jen imMBA ranks top 3 in Taiwan and top 20 in Far East Asia in the category of International Management.

◎International MBA environment

Fu Jen imMBA recruits both local and international students who come from more than 30 countries worldwide for exchange or degree-seeking. Taking advantage of the cultural diversity, studying at Fu Jen imMBA, the ratio of local to non-local in the classroom could be 1:1.

◎Dual master''s degree from USA, France, and Spain

Fu Jen imMBA partners with the University of Michigan-Flint (UM-Flint, USA), KEDGE Business School (KEDGE, France), and IQS School of Management (IQS, Spain) to offer [dual master''s degree options](http://www.management.fju.edu.tw/esubweb/immbaengindex/subedit.php?EID=24) for all imMBA students. Students choosing this path may obtain two master''s degrees in two years in an economic way in terms of time and budget.

◎Fu Jen tuition-free exchange program with partner schools worldwide

Fu Jen imMBA students are encouraged to take this advantage to explore their international perspectives and cross-cultural experiences if they don''t plan to join the dual-degree program. For details about the global tuition-free exchange program, please visit [Fu Jen International Student Center](http://isc.oie.fju.edu.tw/generalServices.jsp?labelID=39).','輔仁大學是知名綜合型大學，歷史悠久，校友和姊妹校遍布全球，交流互動活絡。身為天主教大學，輔大更擁有獨特的國際網絡，包含天主教大學聯盟、耶穌會大學聯盟、亞洲基督宗教大學聯盟等，在國際上都是重要且嘉惠學子的黃金人脈。

輔大管理學院在2005年通過[AACSB (Association to Advance Collegiate Schools of Business)](https://www.aacsb.edu/educators/accreditation/value-of-accreditation)國際商學院認證，成為兩岸首家通過AACSB認證的學院。並在分別於2010年、2015年、2020年及2025年持續通過認證。在全球全球1萬6千多個商管學院中，僅有5%極少數優質的學院能通過AACSB 認證，顯見辦學績效獲得國際權威認證肯定。

輔大管理學院2021年獲選教育部「大專校院學生雙語化學習計畫」的重點培育學院，在全台76個申請學院中脫穎而出，成為大台北地區唯一獲得補助的私立大學管理學院。未來將挹注更豐沛的資源，培育學生的國際視野與國際移動力。

輔大國際經管(imMBA) 2006年與台大、政大同步，獲教育部遴選試辦商管專業學院，成立以實務化和國際化為目標的MBA商管碩士班，培養企業所需的國際管理人才。為強化學生就業的國際移動力 (international mobility)，自103學年度起全面以英語授課，並招收來自世界各地的學生。

國際經管(imMBA)在International Management分類排名全台Top 3、遠東地區Top 20 ([Eduniversal 2025](https://best-masters.com/master-international-management-ranking/far-east-asia.html))

◎國際化MBA學習環境

國際經管(imMBA)學生組成除本地生外，尚有亞洲、美洲、歐洲、大洋洲等超國30個不同國家的學生前來攻讀學位或交換學習，本地生與國際學生1:1合班上課，在菁英師資群的帶領下，達到在地學習、國際化的學習體驗。

◎國際移動 X MBA專業 X 數位創新 X 跨域行銷

[國際經管(imMBA)課程](https://www.management.fju.edu.tw/subweb/immba/class.php?CID=20)除涵蓋管理專業領域，如國際企業管理、行銷、人力資源、全球供應鏈管理、財務管理、服務設計等各種專業知識外，更融入跨國企業經營所需要的各種技能和智慧營運、數位創新等最新產業趨勢。培養企業所需的國際管理人才，強化學生就業的國際移動力 (international mobility)。

◎跨國雙碩士

國際經管(imMBA)與美國密西根大學Flint分校(UM-Flint)、法國KEDGE高等商學院(KEDGE)和西班牙拉孟大學IQS管理學院(IQS)簽署[跨國雙碩士學位計畫](https://www.management.fju.edu.tw/subweb/immba/subedit.php?EID=79)，凡錄取國際經管(imMBA)的學生符合雙碩士學位計畫招收資格者，都有機會以最經濟的時間和預算，最快於2年內取得兩個碩士學位。

◎全球姊妹校免學費出國交換

無意攻讀雙碩士，但也想到國外體驗學習生活的同學，可以把握輔大全球姊妹校的資源，申請[姊妹校交換學習計畫](http://www.management.fju.edu.tw/subweb/immba/subedit.php?EID=142)。','https://www.management.fju.edu.tw/esubweb/immbaengindex/profile.php?IID=2','https://www.management.fju.edu.tw/subweb/immba/profile.php?IID=33'),
  ('environment','about',2,'Our Learning Environment','學習環境','Fu Jen Catholic University sits at the junction of two MRT lines, so every corner of Greater Taipei is easy to reach, and the Airport MRT line makes it just as easy to explore the world.

Step into the Guoxi Building (MD) and you are greeted by a bright, spacious humanities hall and the aroma of fresh coffee, a perfect place to recharge between classes and discussions. Floors 10 to 12 of the Guoxi Building house the College of Management''s modern classrooms and comfortable lounges, and most imMBA classes are held there.

Studying at imMBA means learning from an expert faculty alongside a diverse international cohort, in a five-star learning environment overlooking the beautiful Fu Jen campus.

Floors 3, 4 and 5 hold a well-stocked library, and the newly opened "Fun" self-learning center on the 5th floor is the place to study and create.

*Source: official Chinese page of the Fu Jen imMBA website, summarized in English for this student project.*','[輔仁大學](https://www.fju.edu.tw/aboutFju.jsp?labelID=19)擁有得天獨厚的[雙捷運線交會](https://www.fju.edu.tw/aboutFju.jsp?labelID=9)，大台北地區[交通四通八達](https://www.fju.edu.tw/aboutFju.jsp?labelID=9)，機場捷運線讓探索全世界更便利。

走進國璽樓(MD)，映入眼簾的是寬敞明亮的人文大廳，以及一粒麥陣陣的咖啡香，讓同學在充實課程和討論學習之餘，能隨時提振精神，獲得滿滿的能量。而位在國璽樓(MD)10-12樓是管理學院的專業教室設備新穎、休息空間舒適，國際經管(imMBA)學習空間也多安排在此。

可以說在[國際經管(imMBA)](http://www.management.fju.edu.tw/subweb/immba/enroll.php?IID=26)求學，除了專業的師資陣容，國際多元同儕共同學習之外，還能享有五星級的優質學習環境，雄踞校園制高點，俯瞰美麗的輔大校園。

國璽樓3、4、5樓是藏書豐富的圖書館，埋頭研究之餘，偶而遠眺窗外，靜心沉思。不容錯過位於5樓新落成的e化「Fun學趣自學中心」，學習創作更有感。','https://www.management.fju.edu.tw/esubweb/immbaengindex/profile.php?IID=36','https://www.management.fju.edu.tw/subweb/immba/profile.php?IID=123'),
  ('admissions','admissions',3,'Apply for Fu Jen imMBA','招生資訊','Fu Jen imMBA is [AACSB accredited](https://www.aacsb.edu/accreditation). All courses are conducted in English. We offer two types of degree options:

1. Two-year FJCU imMBA program;

2. [Dual Master''s Degree Program](https://www.management.fju.edu.tw/esubweb/immbaengindex/subedit.php?EID=24): M1 at imMBA and M2 Abroad

Students complete their first year at imMBA and their second year at one of our partner institutions abroad. Students must be admitted to the partner institution. Tuition fees vary depending on the agreement with each partner institution. Upon fulfilling the graduation requirements of both institutions, students can earn two master''s degrees.

For the admissions we provide SPRING and FALL semesters for new students to enroll.

SPRING application period: Approximately mid-September to mid-October each year.

FALL application period: Two rounds each year, approximately mid-October to early December and early March to mid-May.

This track is open to international students only. If you are not an international student, please refer to [the Chinese version for admission information.](https://www.management.fju.edu.tw/subweb/immba/enroll.php?IID=26)

Fall 2027- Open Now

Application periods:

First round: Oct. 15, 2026, 13:00 – Dec. 4, 2026, 23:59 (Taiwan time)

Second round: Mar. 1, 2027, 13:00 – May 15, 2027, 23:59 (Taiwan time)

[Admission Brochure for Fall 2027](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/FJCU_116-1Admission.pdf)

[Please apply online](http://idsasys.oie.fju.edu.tw/) or [http://idsasys.oie.fju.edu.tw/](http://idsasys.oie.fju.edu.tw/)

Required Documents

1. Autobiography (English)

2. Study plan (English)

3. English proficiency certificate (e.g., TOEFL, IELTS, and TOEIC) **CEFR B2 level preferred

4. Two recommendation letters

5. Any other materials which may contribute to the application for admission

For complete details, please check our admissions brochure.

Tuition Fees and Scholarships

The standard tuition and miscellaneous fees for international students are NT$123,000 per semester. International students applying to the imMBA program may also apply for or qualify for the following scholarships, subject to the eligibility requirements and application procedures of each scholarship.

1. [MOE Taiwan Scholarship](https://idsaoie.fju.edu.tw/generalServices.jsp?labelID=1)

2. [MOFA Taiwan Scholarship](https://idsaoie.fju.edu.tw/generalServices.jsp?labelID=1)

3. [FJCU Scholarship for New International Students in Master''s Degree Programs](https://idsaoie.fju.edu.tw/generalServices.jsp?labelID=2)

For recipients of Scholarships 1–3, in addition to the benefits provided by the scholarship itself, imMBA provides an additional tuition reduction:

International Rate → Local Rate

NT$123,000 → NT$68,660 per semester

For MOE and MOFA scholarship recipients, the local-student rate applies as long as the government scholarship remains active, for up to two years.

For FJCU Scholarship recipients, the imMBA local-student rate applies for up to four consecutive semesters. This tuition reduction is available only to students who qualify for and receive the FJCU Scholarship. A leave of absence or interruption of studies will result in loss of the imMBA tuition reduction.

4. FJCU President''s Scholarship

Eligibility: New imMBA international students who meet either of the following requirements:

• From an English-speaking country or a country where English is an official language

• TOEFL iBT (72), IELTS (6), or TOEIC (785) score at CEFR B2 or above

Eligible students receive a tuition reduction of NT$40,600 per semester for up to four consecutive semesters.

International Rate → President''s Scholarship

NT$123,000 → NT$82,400 per semester

No separate application is required. The scholarship will be automatically applied and reflected on the tuition payment slip.

Students must enroll in the semester for which they are admitted and continue their studies without interruption. A leave of absence or interruption of studies will result in loss of the scholarship.

Important Note

Students may receive only one of the four scholarships.

Course Waiver (postgraduate level)

Students who have completed professional courses in the imMBA program and wish to apply for a course waiver must submit their request prior to officially enrolling in the program. [More details](https://academic.fju.edu.tw/teachingServices.jsp?labelID=24)

There is only one chance to request and the deadline is in the first week of the class begins. A course waived or not is subject to [the imMBA chair''s](https://www.management.fju.edu.tw/esubweb/immbaengindex/teacher.php) approval.','國際經管(imMBA)針對本地學生每年設有10月甄試和1月碩士兩次招生(免筆試)，非常適合大學不同主修想在商業管理領域有所發展和強化國際移動力的同學報考。更多[國際經管(imMBA)的特色與排名](https://www.management.fju.edu.tw/subweb/immba/profile.php?IID=33)

116學年度甄試招生 [外國學生申請入學請見英文版招生說明](http://www.management.fju.edu.tw/esubweb/immbaengindex/enroll.php?IID=3)

◎網路報名時間 2026年09月30日10:00 ~ 10月13日12:00

◎簡章及報名

[116甄試 簡版簡章](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/116%20imMBA.pdf)

[116甄試 完整簡章](https://exam.fju.edu.tw/admission/251)

[我要報名](https://exam.fju.edu.tw/admission/251)

116甄試口試通知 (coming soon)

◎錄取入學時間 該學年度第二學期(提早入學)或次學年度第一學期

◎招生報名資料

1.[書面資料審查表](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/116%200819.doc)

2.國民身分證影本

3.學位證書影本

4.學士班歷年成績單

5.[自傳暨讀書計畫](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/2026%201019.pdf)

6.推薦信乙封

7.英文能力證明

8.其他有助審查之資料

◎學雜費資訊

[學雜費](http://tuition.ga.fju.edu.tw/lnchargeStudent/)或[http://tuition.ga.fju.edu.tw/lnchargeStudent/index.jsp](http://tuition.ga.fju.edu.tw/lnchargeStudent/index.jsp)

◎校級獎助學金

[輔仁大學鼓勵學士班成績優異學生就讀碩士班獎學金辦法](https://www.management.fju.edu.tw/smarteditupfiles/immba/20230620.pdf)或[http://life.dsa.fju.edu.tw/resource.jsp?labelID=35](http://life.dsa.fju.edu.tw/resource.jsp?labelID=35)

[更多獎助學金資訊](https://www.management.fju.edu.tw/subweb/immba/enroll.php?IID=29)

◎國際經管imMBA獎助學金

[國際經營管理碩士學位學程學生獎助學金辦法](https://www.management.fju.edu.tw/smarteditupfiles/immba/2023%2010%2018%281%29.pdf)

◎碩士班學分抵免

>>本校設有[學生抵免科目規則](http://www.academic.fju.edu.tw/teachingServices.jsp?labelID=24)，凡曾於本碩士班修習專業課程且符合資格者，得於入學當年度當學期向註冊組提出申請，並以一次為限。

>>申請時間至開學後一週截止，逾期不予受理。請申請本項抵免之學生，同時加填[研究所科目學分證明](http://www.academic.fju.edu.tw/resource.jsp?labelID=28)(網頁下方成績項下第一點)。

◎兩次招生差異(甄試 vs.碩士招生)

>>甄試：每年10月報名、11月口試、12月放榜，2月(Spring)或9月(Fall)入學。已領有大學畢業證書者，可提前於2月入學。

>>碩士：每年1月報名、3月口試並放榜，9月(Fall)入學。','https://www.management.fju.edu.tw/esubweb/immbaengindex/enroll.php?IID=3','https://www.management.fju.edu.tw/subweb/immba/enroll.php?IID=26'),
  ('curriculum','curriculum',4,'Curriculum and Requirements','課程與修業規則','Course Waiver (postgraduate level)

Students who have completed professional courses in the imMBA program and wish to apply for a course waiver must submit their request prior to officially enrolling in the program. [More](https://academic.fju.edu.tw/teachingServices.jsp?labelID=24)

There is only one chance to request and the deadline is in the first week of the class begins. A course waived or not is subject to the [imMBA chair''s](http://www.management.fju.edu.tw/esubweb/immbaengindex/teacher.php) approval.

Course Waiver (undergraduate level)

Economics, Business Management, Statistics, and Accounting are imMBA prerequisite courses. Students with non-business-related majors are required to submit an official transcript to prove one of the prerequisite courses was taken and passed during undergraduate studies before the start of the first semester at imMBA.

Students failing to prove the above need to take and pass one prerequisite course at any [FJCU''s undergraduate studies](http://estu.fju.edu.tw/fjucourse/ava_form_eng.asp) in the first semester at imMBA.

It is mandatory to contact the imMBA office in advance to make sure the name and credits of the chosen prerequisite course are suitable and counted. imMBA graduation credits do not include prerequisite courses.

Updated Curriculum

[Fall 2026 and spring 2027 Curriculum](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/0907.pdf)

[Course Catalog and Objectives](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/imMBA_course%20introduction%202026%2005%2022.pdf)

[Course Structure for Graduation-115](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/Curriculum%20structure-115.xls)

[Course Structure for Graduation-114](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/Curriculum%20structure-114%282%29.xls)

[Course Structure for Graduation-113](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/Curriculum%20structure-113%282%29.xls)

[Course Structure for Graduation-112](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/Curriculum%20structure-112%283%29.xls)

Each semester, the imMBA office will release a list of professors in late March and early October for enrolled students to select their thesis advisor. Students are advised to wait patiently for the list.

To preserve the right to apply for the thesis defense and graduate, students need to enroll in ''''THESIS'''' before add/drop period in the same semester that they (may) plan to do so.

Graduation Requirements

[Students enrolled in/ from fall 2025](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/GR-ENG-Fall%202025%20%28v2026%2005%2018%29.pdf)

[Students enrolled in/ from fall 2024](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202024%20%28v2024%200516%29.pdf)

[Students enrolled in/ from fall 2023](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202023%20%28v20221124%29.pdf)

[Students enrolled in/ from fall 2021](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202021%20%28v20210429%29%20r1.pdf)

[Students enrolled in/ from fall 2018](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202018%20%28v20180719%29%20r1.pdf)

[Students enrolled in/ from fall 2017](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202017%20%28v20180719%29%20r1.pdf)

[Students enrolled in/ from fall 2014](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/2014%281%29.pdf)','輔大國際經管(imMBA) 為AACSB認證的全英碩士班，課程設計除涵蓋管理專業領域，如國際企業管理、行銷、人力資源、全球供應鏈管理、財務管理、服務設計等各種專業知識外，更融入跨國企業經營所需要的各種技能和智慧營運、數位創新等最新產業趨勢。培養企業所需的國際管理人才，強化學生就業的國際移動力(international mobility)。[更多特色與肯定](https://www.management.fju.edu.tw/subweb/immba/profile.php?IID=33)

◎上課時間表

[最新上課時間表](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/0907.pdf)

[課程目錄與學習目標](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/imMBA_course%20introduction%202026%2005%2022.pdf)

◎畢業修課規劃與結構

[115畢業修課規劃與結構](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/Curriculum%20structure-115.xls)

[114畢業修課規劃與結構](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/Curriculum%20structure-114%281%29.xls)

[113畢業修課規劃與結構](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/Curriculum%20structure-113%281%29.xls)

[112畢業修課規劃與結構](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/Curriculum%20structure-112%281%29.xls)

>>本碩士班每學期分別於3月底及10月初提供教師群名單，供同學自行聯繫並確認指導老師。同學在期間內依據規定辦理即可。

>>同學擬申請論文口試及畢業的當學期，必須於當學期選課期間先加選"論文"乙科，始得於當學期提出論文口試申請。

◎入學前碩士班學分抵免

本校設有學分抵免辦法，凡曾於本碩士班修習專業課程且符合資格者，得於入學當年度當學期向註冊組提出申請，並以一次為限。 申請時間至開學後一週截止，逾期不予受理。

擬申請本項抵免之學生，請備成績單正本、填寫[抵認科目申請表](https://academic.fju.edu.tw/teachingServices.jsp?labelID=24)及[學生修習科目學分證明](https://academic.fju.edu.tw/resource.jsp?labelID=28)(網頁下方成績項下第一點)，於截止日前提出。

◎入學前學士班基礎課程抵免

國際經管(imMBA)設「經濟學」、「管理學（企業管理）」、「統計學」、「會計學」為基礎課程，凡大學非主修商管相關科系的新生皆須於第一學期開學前，主動提交於學士班曾經修讀上述基礎課程之合格證明(含修課成績和學分)。

未於第一學期開學前主動提交者，視為於學士班未曾修讀基礎課程或修課未及60分，應於第一學期於[輔大學士班](http://estu.fju.edu.tw/fjucourse/ava_form.asp)選擇其中一科為補修，以免影響第二學期碩士班選課。

擬補修的基礎課程需要事先跟所辦確認課程名稱和學分是否合適，補修通過之基礎課程不列入畢業學分。

◎修業規則

>>國際經管(imMBA)最低畢業學分為42學分(含論文6學分)，一般需要規劃3-4個學期才能完成學業。

>>關於基礎課程(限大學非商管之同學)、專業必修、專業選修、論文撰寫、英文畢業門檻皆有規定，為保障自身學習權益並順利取得輔大MBA學位，請同學務必詳讀修業規則並配合辦理。

[Fall 2025入學起適用](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/GR-C-Fall%202025%28v2026%200518%29%281%29.pdf)

[Fall 2024入學起適用](https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202024%20%28v2024%200516%29%282%29.pdf)

[Fall 2023入學起適用](https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202023%20%28v20221124%29.pdf)

[Fall 2021入學起適用](https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202021%20%28v20210429%29.pdf)

[Fall 2018入學起適用](https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202018%20%28v20180719%29%281%29.pdf)

[Fall 2017入學起適用](https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202017%20%28v20180719%29%281%29.pdf)

[Fall 2014入學起適用](https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202014%20%28v2080719%29%281%29.pdf)','https://www.management.fju.edu.tw/esubweb/immbaengindex/class.php?CID=1','https://www.management.fju.edu.tw/subweb/immba/class.php?CID=20'),
  ('guide','more',5,'imMBA Guide','imMBA 全攻略','Fu Jen imMBA is an AACSB-accredited, fully English-taught master''s program. Students come from Asia, the Americas, Europe and Oceania, more than 30 countries in total, and local and international students share the same classes 1:1. Graduates receive an MBA degree.

## Who is imMBA for?
- You want to build international competitiveness.
- You want to join a large corporation or a multinational.
- You are interested in digital transformation, innovation or marketing.
- You are looking for professional management training.
- You want to become a "pi-shaped" professional or continue to academic study.

Any undergraduate major is welcome.

## How local students apply
There are two admission channels each year, both without a written exam:
- **Selection admission (甄試):** apply in October, interviews in November, results in December, start in February (Spring) or September (Fall).
- **Master''s admission (碩士):** apply in January, interviews and results in March, start in September (Fall).

Applicants go through document review and an interview (mainly in English). International students should read the Admissions page.

## Do I need a thesis advisor right away?
No. The office announces advisor information after each add/drop period. Most students need three semesters for the thesis: one to outline the topic, then two to write it with their advisor. Students planning a dual master''s abroad must finish the thesis before leaving.

*Source: official Chinese "imMBA guide" page, summarized in English for this student project.*','國際經管imMBA獲AACSB認證是全英授課的碩士班，學生組成除本地生外，尚有亞洲、美洲、歐洲、大洋洲等超國30個不同國家的學生前來攻讀學位或交換學習，本地生與國際學生1:1合班上課，授予MBA學位。[更多特色與排名](https://www.management.fju.edu.tw/subweb/immba/profile.php?IID=33)

◎國際經管imMBA適合的目標族群

如果你想培養國際競爭力

如果你想進入集團企業或外商公司

如果你對數位轉型、創新或行銷有興趣

如果你尋求專業管理訓練

如果你想成為π型或繼續學術深造

不限大學主修，國際經管都可以提供發展的舞台

因為你的未來 從這裡開始

◎國際經管imMBA招生管道

針對本地生每年設有甄試和碩士兩次招生，皆免筆試。

>>甄試招生：每年10月報名、11月口試、12月放榜，2月(Spring)或9月(Fall)入學。已領有大學畢業證書者，可提前於2月(Spring)入學。

>>碩士招生：每年1月報名、3月口試並放榜，9月(Fall)入學。

考生須通過書審及口試兩關審查。招生評委會依據考生提供之書審資料，如讀書計畫、英檢成績、歷年成績單及推薦信等綜合考量；口試則英文為主、中文為輔。[更多招生資訊](https://www.management.fju.edu.tw/subweb/immba/enroll.php?IID=26)

◎考上國際經管imMBA需要馬上找論文指導老師嗎?

不用的。所辦於每學期加退選結束後皆會公告論文指導老師相關訊息，同學可依自身規劃選擇跟上的時間點。

同學通常需要三學期完成論文，一學期構思論文主題架構並獲指導老師確認，接下來兩學期與指導老師定期討論、實質撰寫論文並完成。

如果同學計畫出國攻讀雙碩士課程，必須於出國前完成論文。

[關於論文指導老師](https://www.management.fju.edu.tw/subweb/immba/class.php?CID=20)

[關於跨國雙碩士](https://www.management.fju.edu.tw/subweb/immba/subedit.php?EID=79)

◎碩一新鮮人該如何安排課程(含課程抵免)

基礎課程抵免：國際經管設「經濟學」、「管理學（企業管理）」、「統計學」、「會計學」為基礎課程，凡大學非商管主修的同學皆須於第一學期開學前，主動提交曾經修讀上述基礎課程之合格證明(含修課成績和學分)。未於第一學期開學前主動提交者，應於第一學期至大學部選擇其中一科為補修，以免影響第二學期碩士班選課。擬補修的基礎課程須事先跟所辦確認課程名稱和學分是否合適，補修通過之基礎課程不列入畢業學分。

碩士課程抵免：凡於國際經管修課且符合資格者，可於入學當年度當學期向註冊組提出申請，並以一次為限。 申請時間至開學後一週截止，逾期不予受理。

MBA正規課程安排：同學應在開學前一個月瀏覽國際經管官網，了解修課資訊及畢業規定；所辦會在開學前三週以Email公告選課細節，同學必須依據內容跟上進度。[更多課程及抵免相關資訊](https://www.management.fju.edu.tw/subweb/immba/class.php?CID=20)','https://www.management.fju.edu.tw/esubweb/immbaengindex/subedit.php?EID=35','https://www.management.fju.edu.tw/subweb/immba/subedit.php?EID=243'),
  ('graduation','more',6,'Graduation','畢業與離校','Graduation requirements, please read the version that suits you:

[Students enrolled in/ from fall 2025](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/GR-ENG-Fall%202025%20%28v2026%2005%2018%29%281%29.pdf)

[Students enrolled in/ from fall 2024](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202024%20%28v2024%200516%29.pdf)

[Students enrolled in/ from fall 2023](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202023%20%28v20221124%29.pdf)

[Students enrolled in/ from fall 2021](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202021%20%28v20210429%29%20r1.pdf)

[Students enrolled in/ from fall 2018](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202018%20%28v20180719%29%20r1.pdf)

[Students enrolled in/ from fall 2017](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202017%20%28v20180719%29%20r1.pdf)

[Students enrolled in/ from fall 2014](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/2014%281%29.pdf)

>>Each semester, the imMBA office will release a list of professors in late March and September for enrolled students to select their thesis advisor. Students are advised to wait patiently for the list.

>>To preserve the right to apply for the thesis defense and graduate, students need to enroll in ''''THESIS'''' before add/drop period in the same semester that they (may) plan to do so.

Thesis, defense process and graduation guideline

[Overall steps for the thesis defense and graduation](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/OD%20Process%202026%200709.pdf)

[Thesis resources from FJCU library](https://home.lib.fju.edu.tw/TC/essaywriting)

[00 Thesis Format](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/imMBA%20thesis%20format%201210.pdf)

[01 Thesis Final Defense Agreement](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/01%20OD%20Agreement%202026%200825.pdf)

[02 Thesis Acceptance](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/02%20Acceptance%281%29.pdf)','◎論文口試與離校流程

同學必須符合[修業規則](http://www.management.fju.edu.tw/subweb/immba/class.php?CID=20)之規定，才具備申請論文口試之資格。每一個學期皆可申請論文口試，Fall的口試截止日為每年的1月31日、Sping的口試截止日為每年的7月31日(實際截止日需要配合當年度的[輔大行事曆](http://www.secretariat.fju.edu.tw/article.jsp?articleID=8))。

論文口試前和後皆有必要程序需要充足作業時間，請同學務必依據「論文口試流程與畢業規範」提前規劃辦理，以便順利取得輔大MBA學位。

[論文口試流程與畢業規範](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/OD%20Process%202026%200709.pdf)

[圖書館論文資源](https://home.lib.fju.edu.tw/TC/essaywriting)

[00論文格式](https://www.management.fju.edu.tw/smarteditupfiles/immba/imMBA%20thesis%20format%201210%281%29.pdf)

[01論文口試同意書](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/01%20OD%20Agreement%202026%200825%283%29.pdf)

[02論文修改完成證明書](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/02%20Acceptance.pdf)

◎修業規則

國際經管(imMBA)最低畢業學分為42學分(含論文6學分)，一般需要規劃4個學期才能完成學業，關於基礎課程、專業必修、專業選修、論文撰寫、英文畢業門檻皆有所規定，為保障自己的學習權益，請同學務必詳讀修業規則並配合辦理。[更多細部規定](http://www.management.fju.edu.tw/subweb/immba/class.php?CID=20)

>>本碩士班每學期分別於3月底及10月初提供教師群名單，供同學自行聯繫並確認指導老師。同學在期間內依據規定辦理即可。

>>同學擬申請論文口試及畢業的當學期，必須於當學期選課期間先加選"論文"乙科，始得於當學期提出論文口試申請。','https://www.management.fju.edu.tw/esubweb/immbaengindex/subedit.php?EID=16','https://www.management.fju.edu.tw/subweb/immba/subedit.php?EID=48'),
  ('dual-degree','more',7,'Dual Degree','跨國雙碩士','Fu Jen imMBA offers two types of degree options to students:

1. Two-year FJCU imMBA program;

2. Dual master''s degree programs: the first year at FJCU and the second year at one of the partner schools, the University of Michigan-Flint (UM-Flint, USA), Kedge Business School (Kedge, France), and IQS School of Management (IQS, Spain). Students may obtain two master''s degrees in two years if the graduation requirements of two institutions are met.

[Regulations Governing the Assessment and Recognition of Foreign Academic Records by Institutions of Higher Education](https://law.moj.gov.tw/ENG/LawClass/LawAll.aspx?pcode=H0030039)

Below is the study schedule for dual master''s degree students:

◎The first semester- Fall (Phase 1)

1. Submit [the dual-degree application](https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/0310.pdf) within the first week of the semester.

2. Enroll in courses as outlined in the dual degree contract listed on this page.

3. Confirm your thesis advisor and begin working on your thesis.

◎The second semester- Spring (Phase 2)

1. Complete the first three-chapter thesis presentation on the date scheduled by the office (When submitting the consent form for the presentation, please also provide the required application documents as outlined in the dual degree contract, including proof of English proficiency).

2. Finalize the thesis and submit the signed [thesis defense agreement](https://www.management.fju.edu.tw/esubweb/immbaengindex/subedit.php?EID=16), along with the required supporting documents, during the final exam week.

3. Apply for the [scholarship offered by imMBA](https://www.management.fju.edu.tw/subweb/immba/enroll.php?IID=29) (optional).

◎The third semester- Fall (Phase 3)

1. Complete registration and pay full tuition at FJCU.

2. Take courses (and pay tuition) at partner school.

3. Provide the registered course list to FJCU at the beginning of the semester.

◎The fourth semester- Spring (Phase 4)

1. Complete registration and pay full tuition at FJCU.

2. Take courses (and pay tuition) at the partner school.

3. Provide the registered course list to FJCU at the beginning of the semester.

4. Complete the course requirements at the partner institution and meet the imMBA graduation requirements to qualify for the thesis defense application at FJCU.

5. Complete the thesis defense and related graduation procedures at FJCU to obtain the degree certificate.

>>Without keeping up with the above schedule means students give up the dual master''s degree application without objections. One may reapply for this program from the first semester (phase 1).

>>If the number of qualified students exceeds the limit listed on the signed contract, the imMBA chair will recommend those according to the below priorities: junior (in their first year of study), academic performance, and English proficiency.

Dual master degree with School of Management, University of Michigan-Flint (UM-Flint, USA)

UM-Flint is located in the city of Flint, 100 km northwest of Detroit. The average winter temperature in Flint is -10 degrees Celsius, while in summer the temperature is around 25 degrees Celsius.UM-Flint is well known for its business management-related programs and has partnered with imMBA to offer imMBA students the opportunity to pursue an MBA in the US. [Discover Flint](https://www.umflint.edu/about/explore-flint/)

Rankings and recognitions

AACSB accredited

Best Graduate Business Programs

Top 15 best business schools in Michigan [More](https://www.umflint.edu/som/rankings-recognitions/)

9 concentrations and degree awarded

[Master of Business Administration (MBA)](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/UM-Flint%201+1-2024%200219.pdf)

Application and qualifications

Students need to declare their intention to the imMBA office in the first week of the first semester. So that in the following two semesters, students can take courses differently from their counterparts who only plan to pursue the imMBA degree at FJCU.

In the second semester, students have to apply to the partner school directly. Due to the limited seats, the imMBA office will recommend students to the partner school according to their performance. The partner school has the final decision on whether to accept a student.

In the first year at FJCU:

1. Complete thesis and courses required by FJCU-UM(Flint) agreement

2. GPA 3.0

3.TOEFL iBT

Minimum English requirements are subject to change, including sub-cores, please visit the partner school''s website for updates.

[More course arrangements](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/UM-Flint%201+1-2024%200219%282%29.pdf)

Tuition and fees

UM-Flint offers in-state tuition fees and scholarships to imMBA students. [More](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/UM-Flint%201+1-2024%200219%283%29.pdf)

Dual Master Degree with KEDGE Business School (KEDGE, France)

KEDGE is the result of the merger of two famous and century-old business schools—Bordeaux Ecole de Management (ESC Bordeaux, 1874) and Euromed Management (ESC Marseille, 1872). Founded in 2013, KEDGE thus inherits both former schools'' specialties, traditions, networking resources and keeps playing a key role in elite education.imMBA students may choose either Bordeaux or Marseille as their campus to study at KEDGE.

[Discover Bordeaux](https://www.bordeaux-tourism.co.uk/?_wrapper_format=html)

[Discover Marseille](https://www.marseille-tourisme.com/en/)

Rankings and recognitions

KEDGE is a triple accredited school (AACSB, AMBA, and EQUIS) and Grandes Ecoles. Less than 1% of the business schools globally have held the ''''Triple Crown Accreditation''''. [More](https://student.kedge.edu/)

Major and degree awarded

[Master in Management](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/2026%2004%2003.pdf) (60 ECTS). It also requires a minimum of 6 months of internship or practical experience following admission to KEDGE.

Application and qualifications

Students need to declare their intention to the imMBA office in the first week of the first semester. So that in the following two semesters, students can take courses differently from their counterparts who only plan to pursue the imMBA degree at FJCU.

In the second semester, students have to apply to the partner school directly. Due to the limited seats, the imMBA office will recommend students to the partner school according to their performance. The partner school has the final decision on whether to accept a student.

In the first year at FJCU:

1. Hold at least 240 ECTS (120 credits) in undergraduate studies

2. Complete thesis and courses required by FJCU-KEDGE agreement

3. Meet English proficiency qualification

Minimum English requirements are subject to change, including sub-cores, please visit the partner school''s website for updates.

[More course arrangements](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/2026%2004%2003%281%29.pdf)

Tuition and fees

Students only have to pay full tuition and fees at FJCU, and it''s free to study at KEDGE.

Experiences shared

[Experiences shared by alumni](https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=2985)

Dual Master Degree with IQS School of Management, Ramon Llull University (IQS, Spain)

IQS (1905) is one of the initial members of Ramon Llull University and the International Association of Jesuit Business Schools (IAJBS), accredited by AACSB and recognized by internal rankings. IQS is located in Barcelona, a city famous for its tourism. [Discover Barcelona](https://www.barcelona.cat/en)

Rankings and recognitions

IQS is AACSB accredited and top 20 Master in Management worldwide according to Financial Times. [More](https://www.iqs.edu/en/about-iqs/accreditations-and-rankings)

Major and degree awarded

[Master in International Marketing in a Digital Environment (MIMDE)](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/1+1%20with%20IQS-Intl_%20marketing%20in%20a%20digital%20environment%202024-2029.pdf)

[Master in Industrial Business Management (MIBM)](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/1+1%20with%20IQS-Industrial%20business%20mgmt%202024-2029.pdf)

Application and qualifications

Students need to declare their intention to the imMBA office in the first week of the first semester. So that in the following two semesters, students can take courses differently from their counterparts who only plan to pursue the imMBA degree at FJCU.

In the second semester, students have to apply to the partner school directly. Due to the limited seats, the imMBA office will recommend students to the partner school according to their performance. The partner school has the final decision on whether to accept a student.

In the first year at FJCU:

1. Complete thesis and courses required by FJCU-IQS agreement

2. GPA

3. Meet English proficiency qualification

Minimum English requirements are subject to change, including sub-cores, please visit the partner school''s website for updates.

More course arrangements [MIMDE](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/1+1%20with%20IQS-Intl_%20marketing%20in%20a%20digital%20environment%202024-2029%281%29.pdf) [MIB](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/1+1%20with%20IQS-Industrial%20business%20mgmt%202024-2029%281%29.pdf)[M](https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/1+1%20with%20IQS-Industrial%20business%20mgmt%202024-2029%281%29.pdf)

Tuition and fees

Please see the agreements for details. The tuition fee is reviewed each year.','國際經管imMBA的特色之一，是提供學生國際化的多元選擇。國際經管imMBA碩一新生於指定時間內向所辦確認是否參加跨國雙碩士課程。決定參加者於碩一進行課程分流，碩二可選擇到美國、法國、西班牙等名校留學一年，享有優惠學費、輔大獎學金和學分互相承認抵免，以最具經濟效益的方式體驗海外學習與實習，並取得跨國雙碩士學位。[大學辦理國外學歷採認辦法](https://law.moj.gov.tw/LawClass/LawAll.aspx?PCode=H0030039)

跨國雙碩士四學期(四階段)主要作業規劃：

◎第一學期(Fall)(第一階段)

1.開學一週內繳交[申請書](https://www.management.fju.edu.tw/smarteditupfiles/immba/0310.pdf)，確認參加意願；

2.依據本網頁公布的合約內容修讀課程；

3.確認論文指導老師，撰寫論文。

◎第二學期(Spring)(第二階段)

1.於集體前三章活動，完成論文前三章發表 (繳交論文前三章發表同意書時，請同時繳交合約要求之申請文件至所辦(含英檢)；

2.期末考週完成論文撰寫並繳交論文口試[同意書](https://www.management.fju.edu.tw/subweb/immba/subedit.php?EID=48)(含同意書所要求之證明文件)；

3.於指定期限內申請[國際經管獎助學金](https://www.management.fju.edu.tw/subweb/immba/enroll.php?IID=29)(非必要項目)，其餘獎學金請依各別辦法自行辦理。

◎第三學期(Fall)(第三階段)

1.完成輔大註冊並繳交全額學雜費；

2.依據合約，於雙聯學校註冊(繳費)選課；

3.學期初將雙聯學校選修課程提報回輔大登錄。

◎第四學期(Spring)(第四階段)

1.完成輔大註冊並繳交全額學雜費；

2.依據合約，於雙聯學校註冊(繳費)選課；

3.學期初將雙聯學校選修課程提報回輔大登錄；

4.完成雙聯學校修課要求，並符合國際經管修業規則，即具於輔大申請論文口試之資格；

5.完成輔大論文口試及相關離校程序，取得畢業證書。

>>有意參加跨國雙碩士課程的同學，若未能如期完成上述作業，視為自動放棄資格。若有需要，請重新於第一學期(第一階段)提出申請。

>>遇有合格人數超過簽約學校人數限制，將依低年級、學業成績、英檢成績等順序，由國際經管imMBA主任綜合評估後推薦之。

Dual Master Degree with School of Management, University of Michigan-Flint (UM-Flint, USA)

密西根大學-Flint分校隸屬於著名的密西根大學系統，坐落於素有教育中心之稱的城市Flint，密西根州最大城市底特律在其東南方106公里處，冬天均溫在零下10度、夏天則25度左右。密西根大學-Flint分校以商管領域見長，與輔大國際經管(imMBA)簽署1+1雙碩士學術合約，提供同學以一年攻讀美國MBA的機會。[探索和體驗Flint 的人文氣息](https://www.umflint.edu/about/explore-flint/)

◎國際認證和排名

AACSB國際認證

Best Graduate Business Programs

Top 15 best business schools in Michigan

[更多認證與排名](https://www.umflint.edu/som/rankings-recognitions/)

◎9大專業領域和授予學位

[Master of Business Administration (MBA)](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/UM-Flint%201+1-2024%200219.pdf)

◎申請日期及入學條件

第一學期開學指定期限內，向國際經管(imMBA)辦公室提出雙聯意願，以利於碩一做課程分流。第二學期向合作學校申請入學，國際經管(imMBA)擇優推派、合作學校對於是否錄取有最終決定權。

1.完成輔大指定課程和論文；

2.在輔大的學業成績 GPA 3.0 ；

3.英檢托福成績

Minimum English requirements are subject to change, including sub-cores, please visit the partner school''s website for updates.

[更多雙方課程修業規劃](https://www.management.fju.edu.tw/smarteditupfiles/immba/UM-Flint%201+1-2024%200219%281%29.pdf)

◎學雜費和獎學金

密西根大學-Flint分校以in-state標準收取學雜費並提供獎學金和研究助理職缺給優秀且積極爭取的同學。[更多資訊及合約內容](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/UM-Flint%201+1-2024%200219%282%29.pdf)

Dual Master Degree with KEDGE Business School (KEDGE, France)

KEDGE高等商學院前身為波爾多高等商學院(1874)和馬賽商學院(1872)，由於兩所商學院在各自領域都有百年以上的卓越辦學成績，KEDGE(2013)可以說是承襲優良傳統和豐富資源，繼續在高教領域投入心力。國際經管(imMBA)學生未來到KEDGE留學可以選波爾多或馬賽校區。

[探索波爾多](https://www.bordeaux-tourism.co.uk/?_wrapper_format=html)、[探索馬賽](https://www.marseille-tourisme.com/en/)

◎國際認證和排名

KEDGE高等商學院獲得三桂冠認證(AACSB、EQUIS和AMBA) ，全球不到1%的學校獲此殊榮。KEDGE高等商學院同時也是法國Grandes Ecoles的一員。

[更多排名與肯定](https://student.kedge.edu/)

◎專業領域和授予學位

[Master in Management](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/2026%2004%2003%281%29.pdf) (60 ECTS) 並要求入學KEDGE之後6個月以上的實習/實務經驗。

◎申請日期及入學條件

第一學期開學指定期限內，向國際經管(imMBA)辦公室提出雙聯意願，以利於碩一做課程分流。第二學期向合作學校申請入學，國際經管(imMBA)擇優推派、合作學校對於是否錄取有最終決定權。

1.大學修業至少240ECTS (120學分)；

2.完成輔大指定課程和論文；

3.英檢成績

Minimum English requirements are subject to change, including sub-cores, please visit the partner school''s website for updates.

[更多雙方課程修業規劃](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/2026%2004%2003.pdf)

◎學雜費

到KEDGE高等商學院參加雙聯課程學雜費是全免的，同學僅須繳交輔大全額學雜費。

◎學長姐分享

[Experiences shared by alumni](https://www.management.fju.edu.tw/subweb/immba/news-detail.php?NID=2985)

Dual Master Degree with IQS School of Management, Ramon Llull University (IQS, Spain)

IQS管理學院隸屬拉孟大學，是拉孟大學的創始成員，辦學已有百年歷史(since 1905)，是國際耶穌會商管學院聯盟(IAJBS)的會員，同時獲得AACSB認證、國際排名也備受肯定。IQS位於西班牙巴塞隆納，冬天氣溫平均10度、夏天則是乾燥炎熱，以陽光充足日照長著稱。由於整座城市建築獨具特色於 1999 年獲得英國皇家建築學會頒發「皇家建築金獎」。就讀IQS可說是結合了學術和世界級旅遊勝地。

[探索和體驗巴塞隆納](https://www.barcelona.cat/en)

◎國際認證和排名

IQS管理學院獲得AACSB認證，管理碩士類別被Financial Times評為全球前20大。[更多認證與肯定](https://www.iqs.edu/en/about-iqs/accreditations-and-rankings)

◎專業領域和授予學位

[1.Master in International Marketing in a Digital Environment (MIMDE)](https://www.management.fju.edu.tw/smarteditupfiles/immba/1+1%20with%20IQS-Intl_%20marketing%20in%20a%20digital%20environment%202024-2029.pdf)

[2.Master in Industrial Business Management (MIBM)](https://www.management.fju.edu.tw/smarteditupfiles/immba/1+1%20with%20IQS-Industrial%20business%20mgmt%202024-2029.pdf)

◎申請日期及入學條件

第一學期開學指定期限內，向國際經管(imMBA)辦公室提出雙聯意願，以利於碩一做課程分流。第二學期向合作學校申請入學，國際經管(imMBA)擇優推派、合作學校對於是否錄取有最終決定權。

1. 完成輔大指定課程和論文；

2. 在輔大的學業成績 GPA；

3.英檢成績

Minimum English requirements are subject to change, including sub-cores, please visit the partner school''s website for updates.

更多雙方課程修業規劃 [MIMDE](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/1+1%20with%20IQS-Intl_%20marketing%20in%20a%20digital%20environment%202024-2029%281%29.pdf) [MIBM](https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/1+1%20with%20IQS-Industrial%20business%20mgmt%202024-2029%282%29.pdf)

◎學雜費

詳見雙方簽署之合約，惟國外學費每年調整。','https://www.management.fju.edu.tw/esubweb/immbaengindex/subedit.php?EID=24','https://www.management.fju.edu.tw/subweb/immba/subedit.php?EID=79'),
  ('exchange','more',8,'Overseas Exchange','海外交換','Global tuition-free exchange program with partner schools worldwide

With abundant resources in academic networking, Fu Jen Catholic University has partnered schools globally with [a tuition-free exchange program](http://isc.oie.fju.edu.tw/generalServices.jsp?labelID=39).

Fu Jen imMBAstudents are encouraged to take this advantage to explore their international perspectives and cross-cultural experiences if they don''t plan to join a dual degree program at one of the contracted institutions abroad.

For details about the global tuition-free exchange program in terms of application procedures, requirements, deadline, school information, and so on, please visit [Fu Jen International Student Center](http://isc.oie.fju.edu.tw/generalServices.jsp?labelID=39).','全球姐妹校免學費出國交換

輔仁大學[海外姐妹學校](http://isc.oie.fju.edu.tw/generalServices.jsp?labelID=39)數量和資源之豐富全台數一數二，締結友好學術關係的姐妹校遍布全球。

每學期全球各地的姐妹校皆提供免學費的交換課程(非攻讀另一學位)給輔大學生。國際經管(imMBA)因為是全英碩士班、國際化程度高，每年都有學長姐把握難得機會，爭取到美法西等簽約學校攻讀[跨國雙碩士學位](https://www.management.fju.edu.tw/subweb/immba/subedit.php?EID=79)，或是到海外姐妹校交換、累積更多跨文化的學習經驗。

海外姐妹校每學期之申請作業，包括申請方式、條件、交換學校、主修等相關細節，請參閱輔仁大學國際學生中心的[全球交換生計畫](http://isc.oie.fju.edu.tw/generalServices.jsp?labelID=39)。','https://www.management.fju.edu.tw/esubweb/immbaengindex/subedit.php?EID=25','https://www.management.fju.edu.tw/subweb/immba/subedit.php?EID=142')
on conflict (slug) do update set body_en=excluded.body_en, body_zh=excluded.body_zh, title_en=excluded.title_en, title_zh=excluded.title_zh;

-- Downloads (links to official files)
insert into public.downloads (title_en,title_zh,file_url,file_type,category,sort_order) values
  ('Admission Brochure for Fall 2027',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/FJCU_116-1Admission.pdf','PDF','admissions',1),
  (null,'116甄試 簡版簡章','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/116%20imMBA.pdf','PDF','admissions',2),
  (null,'書面資料審查表','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/116%200819.doc','DOC','admissions',3),
  (null,'自傳暨讀書計畫','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/2026%201019.pdf','PDF','admissions',4),
  (null,'輔仁大學鼓勵學士班成績優異學生就讀碩士班獎學金辦法','https://www.management.fju.edu.tw/smarteditupfiles/immba/20230620.pdf','PDF','admissions',5),
  (null,'國際經營管理碩士學位學程學生獎助學金辦法','https://www.management.fju.edu.tw/smarteditupfiles/immba/2023%2010%2018%281%29.pdf','PDF','admissions',6),
  ('Fall 2026 and spring 2027 Curriculum',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/0907.pdf','PDF','curriculum',7),
  ('Course Catalog and Objectives',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/imMBA_course%20introduction%202026%2005%2022.pdf','PDF','curriculum',8),
  ('Course Structure for Graduation-115',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/Curriculum%20structure-115.xls','XLS','curriculum',9),
  ('Course Structure for Graduation-114',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/Curriculum%20structure-114%282%29.xls','XLS','curriculum',10),
  ('Course Structure for Graduation-113',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/Curriculum%20structure-113%282%29.xls','XLS','curriculum',11),
  ('Course Structure for Graduation-112',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/Curriculum%20structure-112%283%29.xls','XLS','curriculum',12),
  ('Students enrolled in/ from fall 2025',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/GR-ENG-Fall%202025%20%28v2026%2005%2018%29.pdf','PDF','curriculum',13),
  ('Students enrolled in/ from fall 2024',null,'https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202024%20%28v2024%200516%29.pdf','PDF','graduation',14),
  ('Students enrolled in/ from fall 2023',null,'https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202023%20%28v20221124%29.pdf','PDF','graduation',15),
  ('Students enrolled in/ from fall 2021',null,'https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202021%20%28v20210429%29%20r1.pdf','PDF','graduation',16),
  ('Students enrolled in/ from fall 2018',null,'https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202018%20%28v20180719%29%20r1.pdf','PDF','graduation',17),
  ('Students enrolled in/ from fall 2017',null,'https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/GR-ENG-Fall%202017%20%28v20180719%29%20r1.pdf','PDF','graduation',18),
  ('Students enrolled in/ from fall 2014',null,'https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/2014%281%29.pdf','PDF','graduation',19),
  (null,'最新上課時間表','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/0907.pdf','PDF','curriculum',20),
  (null,'課程目錄與學習目標','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/imMBA_course%20introduction%202026%2005%2022.pdf','PDF','curriculum',21),
  (null,'115畢業修課規劃與結構','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/Curriculum%20structure-115.xls','XLS','curriculum',22),
  (null,'114畢業修課規劃與結構','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/Curriculum%20structure-114%281%29.xls','XLS','curriculum',23),
  (null,'113畢業修課規劃與結構','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/Curriculum%20structure-113%281%29.xls','XLS','curriculum',24),
  (null,'112畢業修課規劃與結構','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/Curriculum%20structure-112%281%29.xls','XLS','curriculum',25),
  (null,'Fall 2025入學起適用','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/GR-C-Fall%202025%28v2026%200518%29%281%29.pdf','PDF','curriculum',26),
  (null,'Fall 2024入學起適用','https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202024%20%28v2024%200516%29%282%29.pdf','PDF','curriculum',27),
  (null,'Fall 2023入學起適用','https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202023%20%28v20221124%29.pdf','PDF','curriculum',28),
  (null,'Fall 2021入學起適用','https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202021%20%28v20210429%29.pdf','PDF','curriculum',29),
  (null,'Fall 2018入學起適用','https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202018%20%28v20180719%29%281%29.pdf','PDF','curriculum',30),
  (null,'Fall 2017入學起適用','https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202017%20%28v20180719%29%281%29.pdf','PDF','curriculum',31),
  (null,'Fall 2014入學起適用','https://www.management.fju.edu.tw/smarteditupfiles/immba/GR-C-Fall%202014%20%28v2080719%29%281%29.pdf','PDF','curriculum',32),
  ('Students enrolled in/ from fall 2025',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/GR-ENG-Fall%202025%20%28v2026%2005%2018%29%281%29.pdf','PDF','graduation',33),
  ('Overall steps for the thesis defense and graduation',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/OD%20Process%202026%200709.pdf','PDF','graduation',34),
  ('00 Thesis Format',null,'https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/imMBA%20thesis%20format%201210.pdf','PDF','graduation',35),
  ('01 Thesis Final Defense Agreement',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/01%20OD%20Agreement%202026%200825.pdf','PDF','graduation',36),
  ('02 Thesis Acceptance',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/02%20Acceptance%281%29.pdf','PDF','graduation',37),
  (null,'論文口試流程與畢業規範','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/OD%20Process%202026%200709.pdf','PDF','graduation',38),
  (null,'00論文格式','https://www.management.fju.edu.tw/smarteditupfiles/immba/imMBA%20thesis%20format%201210%281%29.pdf','PDF','graduation',39),
  (null,'01論文口試同意書','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/01%20OD%20Agreement%202026%200825%283%29.pdf','PDF','graduation',40),
  (null,'02論文修改完成證明書','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/02%20Acceptance.pdf','PDF','graduation',41),
  ('the dual-degree application',null,'https://www.management.fju.edu.tw/smarteditupfiles/immbaengindex/0310.pdf','PDF','dual',42),
  ('Master of Business Administration (MBA)',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/UM-Flint%201+1-2024%200219.pdf','PDF','dual',43),
  ('More course arrangements',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/UM-Flint%201+1-2024%200219%282%29.pdf','PDF','dual',44),
  ('More',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/UM-Flint%201+1-2024%200219%283%29.pdf','PDF','dual',45),
  ('Master in Management',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/2026%2004%2003.pdf','PDF','dual',46),
  ('More course arrangements',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/2026%2004%2003%281%29.pdf','PDF','dual',47),
  ('Master in International Marketing in a Digital Environment (MIMDE)',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/1+1%20with%20IQS-Intl_%20marketing%20in%20a%20digital%20environment%202024-2029.pdf','PDF','dual',48),
  ('Master in Industrial Business Management (MIBM)',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/1+1%20with%20IQS-Industrial%20business%20mgmt%202024-2029.pdf','PDF','dual',49),
  ('MIMDE',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/1+1%20with%20IQS-Intl_%20marketing%20in%20a%20digital%20environment%202024-2029%281%29.pdf','PDF','dual',50),
  ('M',null,'https://www.management.fju.edu.tw/esubweb/immbaengindex/smarteditupfiles/immbaengindex/1+1%20with%20IQS-Industrial%20business%20mgmt%202024-2029%281%29.pdf','PDF','dual',51),
  (null,'申請書','https://www.management.fju.edu.tw/smarteditupfiles/immba/0310.pdf','PDF','dual',52),
  (null,'Master of Business Administration (MBA)','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/UM-Flint%201+1-2024%200219.pdf','PDF','dual',53),
  (null,'更多雙方課程修業規劃','https://www.management.fju.edu.tw/smarteditupfiles/immba/UM-Flint%201+1-2024%200219%281%29.pdf','PDF','dual',54),
  (null,'更多資訊及合約內容','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/UM-Flint%201+1-2024%200219%282%29.pdf','PDF','dual',55),
  (null,'Master in Management','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/2026%2004%2003%281%29.pdf','PDF','dual',56),
  (null,'更多雙方課程修業規劃','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/2026%2004%2003.pdf','PDF','dual',57),
  (null,'1.Master in International Marketing in a Digital Environment (MIMDE)','https://www.management.fju.edu.tw/smarteditupfiles/immba/1+1%20with%20IQS-Intl_%20marketing%20in%20a%20digital%20environment%202024-2029.pdf','PDF','dual',58),
  (null,'2.Master in Industrial Business Management (MIBM)','https://www.management.fju.edu.tw/smarteditupfiles/immba/1+1%20with%20IQS-Industrial%20business%20mgmt%202024-2029.pdf','PDF','dual',59),
  (null,'MIMDE','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/1+1%20with%20IQS-Intl_%20marketing%20in%20a%20digital%20environment%202024-2029%281%29.pdf','PDF','dual',60),
  (null,'MIBM','https://www.management.fju.edu.tw/subweb/immba/smarteditupfiles/immba/1+1%20with%20IQS-Industrial%20business%20mgmt%202024-2029%282%29.pdf','PDF','dual',61);

-- Faculty Chinese data (from the official Chinese page)
update public.faculty f set name_zh=v.n, title_zh=v.t, department_zh=v.d, education_zh=v.e, research_fields_zh=v.r
from (values
  ('082435@mail.fju.edu.tw','杜逸寧','副教授兼國際經營管理碩士(imMBA)主任','統計資訊系專任','政治大學資訊管理學博士','資料探勘、文字探勘、人工智慧、機器學習、資訊檢索'),
  ('036665@mail.fju.edu.tw','李天行','講座教授 (前國際與資源發展副校長)','商學博士班專任','美國奧斯汀德州大學作業研究與工業工程博士','顧客關係管理、人工智慧、應用統計、作業研究'),
  ('065999@mail.fju.edu.tw','林耀南','教授(前國際教育長)','企業管理系專任','美國舊金山金門大學企業管理博士','消費者心理學、產品與行銷創新、創造力、人力資源管理'),
  ('155456@mail.fju.edu.tw','許育銘','副教授兼科技管理碩士學程主任','金融國企系專任','台灣大學國際企業研究所博士','行銷管理、數位行銷、資訊科技行銷、社群商務、國際企業管理'),
  ('144629@mail.fju.edu.tw','林芷安','副教授兼學術交流中心主任','金融國企系專任','台灣大學國際企業博士','供應鏈管理、媒體傳播、整合行銷、品牌管理'),
  ('129741@mail.fju.edu.tw','黃愷平','副教授','企業管理系專任','澳洲雪梨科技大學企業管理博士','中小企業、創業精神、行銷管理、人力資源管理'),
  ('142652@mail.fju.edu.tw','曾祥景','副教授','企業管理系專任','政治大學企業管理博士','行銷相關領域'),
  ('151308@mail.fju.edu.tw','林玫君','副教授','金融國企系專任','成功大學工業與資訊管理博士','產業分析與競爭策略、科技創新、服務行銷、供應鏈管理'),
  ('151667@mail.fju.edu.tw','鄭淑玲','副教授','金融國企系專任','成功大學企業管理系博士','行銷研究、資料分析、國際金融'),
  ('128144@mail.fju.edu.tw','胡碧嬋','副教授(前學術交流中心主任)','跨文化研究所專任','政治大學應用英語語言學博士','國際商務談判、法律語言學、財經法律翻譯、法律口筆譯、醫療口筆譯、一般口筆譯'),
  ('156503@mail.fju.edu.tw','林淑雯','助理教授',null,'英國杜倫大學教育博士','通識及專業英文、世界性英語'),
  ('051266@mail.fju.edu.tw','江翠玲','助理教授','金融國企系專任','輔仁大學商學研究所博士','經濟學、財務管理與公司治理、投資學與財務個案分析、國際財務管理、金融市場、信用風險管理'),
  ('145785@mail.fju.edu.tw','顏孟賢','助理教授','企業管理系專任','政治大學企業管理學系博士','一般管理、策略管理、國際企業'),
  ('144779@mail.fju.edu.tw','徐皓馨','助理教授','企業管理系專任','交通大學管理科學系博士','組織行為、職場健康心理學、人力資源管理、效率及生產力分析領域'),
  ('152400@mail.fju.edu.tw','黃凱斌','助理教授','企業管理系專任','交通大學工業工程與管理學系博士','統計推論與實務應用、品質工程及可靠度分析、資料探勘及機器學習、人工智慧於再生能源管理之應用、實驗室品質管理'),
  ('158325@mail.fju.edu.tw','黃慶偉','助理教授','企業管理系專任','中正大學財務金融博士','投資學、行為財務學、環境財經、綠色金融、氣候金融、永續金融'),
  ('167167@mail.fju.edu.tw','王滄賢','助理教授','金融國企系專任','臺灣科技大學管理研究所博士','消費者行為、行銷管理、創新與產品管理、國際企業管理、品牌管理'),
  ('167208@mail.fju.edu.tw','林佳樺','助理教授','企業管理系專任','中正大學心理學系博士','組織行為、工商心理學'),
  ('wanghm.tw@gmail.com','王慧美','兼任副教授 (前國際經營管理碩士(imMBA)主任)',null,'台灣大學國際企業博士','國際企業、國際行銷')
) as v(em,n,t,d,e,r) where lower(trim(f.email))=lower(v.em);
update public.faculty set category='adjunct' where email='wanghm.tw@gmail.com';

-- Sample marketplace listings (clearly marked as samples)
insert into public.listings (title, description, price, category, seller_name, contact, status)
select * from (values
 ('Principles of Marketing (Kotler) - sample listing', 'Sample listing for the demo. 15th edition, light highlighting.', 650, 'books', 'imMBA student (demo)', 'demo@example.com', 'approved'),
 ('Statistics for Managers - lecture notes - sample listing', 'Sample listing for the demo. Typed notes for the full semester.', 120, 'notes', 'imMBA student (demo)', 'demo@example.com', 'approved'),
 ('USB-C hub for laptops - sample listing', 'Sample listing for the demo. Works with all MacBooks.', 300, 'electronics', 'imMBA student (demo)', 'demo@example.com', 'approved')
) as v(title, description, price, category, seller_name, contact, status)
where not exists (select 1 from public.listings);
