# Test report: C2C marketplace (class 11, 24 Nov 2026)

Student: Leopoldo Martinez (F15381071) · Course: AI-Assisted Digital Product Development (Prof. Yi-Ning Tu) · System under test: https://immba-copia.vercel.app

## What the class asked
"Testing & Verification: test it, break it, fix it, verify it." Eleven kinds of test (functional, integration, end to end, access control, positive/negative, boundary, usability, UAT, security-related, feedback/notification, regression), a worksheet with 18 seller cases and 18 buyer cases per website, an issue log (Bug / Missing Requirement / Usability / Security / Suggestion; Critical / Major / Minor) and screenshots. In the class each student tests **four classmates' sites** (two as buyer, two as seller; slide 18). This report is a **self-test of my own site**, a dry run of the same worksheet. It does not replace the four peer tests.

## How I tested (and what I could not)
| Layer | How | Result |
|---|---|---|
| Rules (pure functions) | `npm test`, 59 tests (11 new in `tests/trade.test.js`) | 59 / 59 |
| Database permissions | `testing/permissions-tests.sql`: 28 cases, run in production inside a transaction that cannot commit | 25 / 28 before v8, **28 / 28 after** |
| Anonymous access | anon key over REST (read-only) | orders, order lines, profiles, audit: `[]`; RPCs: 401 |
| Full purchase with clicks | production, super-admin session of the student's own Chrome: add to cart → checkout → I have paid → confirm → ready → shipped → received | order #1001 Completed, stock 10/2/8, 1 order despite a double submit |
| Not done | peer sites, real second account, first-time users (UAT), logout and non-admin URL checks, e-mail delivery | listed as *Pending (student)* in the worksheet |

I did not type any password. Test data: one order (#1001, ref CLASS11-TEST). **It is still in production** (see `testing/cleanup-test-order.sql`).

## Bugs and gaps found, and what I did
| # | Type / severity | What | State |
|---|---|---|---|
| 1 | Bug · Critical | Students could not register: "email rate limit exceeded". The project allows 2 e-mails/hour (default SMTP). | **Fixed in production** (Confirm email turned off, one stuck account confirmed). Needs custom SMTP to re-enable verification. |
| 2 | Security · Major | A seller could rename an approved listing, even to "imMBA Demo Store", without re-review (tests T12/T13 failed). | **Fixed in production** (`supabase/v8.sql`), 28/28 after. |
| 3 | Missing Requirement · Major | No "Forgot password" for members on `/account.html` (only on the admin login). | **Fixed and deployed** (checked as a visitor) |
| 4 | Bug · Minor | Marketplace cards cut the description at 90 characters mid-sentence. | **Fixed and deployed** (3-line clamp, checked in production) |
| 5 | Bug · Minor | Quantity 2.7 accepted by the cart box. | **Fixed and deployed** (`cartAdd` + tests) |
| 6 | Missing Requirement · Major | E-mail verification now off (consequence of #1). | Open: set up SMTP (Resend/Brevo), re-enable, raise the limit |
| 7 | Missing Requirement · Major | No notifications (e-mail) for new order / payment / shipment. | Open (needs the SMTP of #6) |
| 8 | Usability · Major | "How to pay" still shows the default text: no real bank or LINE Pay details. | Open: write them in Transactions → Marketplace settings |
| 9 | Suggestion · Minor | Password rule is only 6 characters. | Open: Supabase Auth → Password strength |
| 10 | Suggestion · Minor | Double submit is blocked only in the browser (no server idempotency key). Not reproduced. | Open |
| 11 | Test mistake | T11 failed because my test listing was already approved. | Test fixed |

Regression: after v8 the whole permission battery was run again (28/28) and `npm test` (59/59). The production purchase was done **before** the front-end fixes were deployed; after deploying, cards, the member password-reset screen and the signed-out redirects were checked as a visitor, but the purchase itself was not repeated.

## Peer testing (the class's main task) — still to do
Assignment from slide 18 for 賴柏德 (F15381071): **buyer** on 馬吉勝 and 吳佳頤; **seller** on 沈鉑天 and 陳靖淳. Blank worksheet with those names: `C2C_Peer_System_Testing_Worksheet_PEER-TESTS_Leopoldo.docx`. Needs each classmate's URL and test accounts created with passwords the student types.

## Evidence
`testing/evidence/` · `S01` cut descriptions (fail) · `S02` order #1001 Completed · `S03` database check · `permissions-test-output.txt` · worksheet `testing/C2C_Peer_System_Testing_Worksheet_SELF-TEST_Leopoldo.docx`.
