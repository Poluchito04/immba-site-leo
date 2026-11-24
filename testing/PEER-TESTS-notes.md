# Peer testing notes (visitor level, 24-nov-2026)

Tester: Leopoldo Martinez (F15381071). Only checks possible WITHOUT logging in. Anything needing an account = pending: student.

## Buyer 2 - 吳佳頤: https://fjcu-immba-website-lilac.vercel.app/market.html
- Catalog visible to visitors with stock shown. PASS (browse).
- #seller area blocked for visitors. PASS (access control).
- Login/register: no "forgot password" link, no password-rule hint. Usability / Minor.
- Admin username "jiayi" shown publicly. Security (info leak) / Minor.
- Cart, checkout, payment, order tracking: pending: student (needs account).

## Seller 1 - 沈鉑天 (F15416011, Victor Pothet): https://immba-site.vercel.app/en/marketplace
- 4 listings visible with price, stock, "Low stock" badge; filters (category, price, keyword, availability) present. PASS.
- Listing detail: description, price, condition, quantity selector capped by stock. PASS.
- /en/admin/news as visitor: redirected to login with ?next=. PASS.
- /en/marketplace/new and /me as visitor: "Sign in to sell / see your orders" message (client-side gate, no data). PASS.
- Login has "Forgot password" and "Create an account". PASS.
- /en/register returns 404 (real route is /en/signup). Not a bug.
- Seller flow (create/edit listing, orders, stock, payment confirm): pending: student (needs account).

## Not tested
- Buyer 1 - 馬吉勝 and Seller 2 - 陳靖淳: URLs and student numbers not provided/found.

## Added later (24-nov)
- Buyer 1 - 馬吉勝 (414416031): https://fjcu-immba-flame.vercel.app/marketplace.html - catalog OK; account page redirects visitors to admin-login; forgot-password link present. Listing "bottle" at NT$0 is public (price 0 accepted?). Shoppers log in via "Staff back-office" page (confusing).
- Seller 2 - 陳靖淳 (415416014): https://fjcu-immba-website-liard.vercel.app/ - 17 items, filters, /admin.html redirects visitors; prices formatted inconsistently ("NT$ 32.800" vs "NT$ 2480").
- Worksheet PEER-TESTS filled with these visitor-level results only; everything needing login = "Pending (student)".
