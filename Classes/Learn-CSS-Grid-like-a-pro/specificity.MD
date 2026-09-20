CSS SPECIFICITY
================

একই Element-এর জন্য একাধিক CSS Rule থাকলে
কোন Rule আগে কাজ করবে—এটাই CSS Specificity।

সহজে মনে রাখো:
----------------
INLINE  = 1000
#ID     = 100
.CLASS  = 10
ELEMENT = 1

অর্থাৎ,
সংখ্যা বেশি → Priority বেশি


উদাহরণ:
---------
#box .title p

= 100 + 10 + 1
= 111

তাই এটি শুধু `p`-এর চেয়ে বেশি Priority পাবে।


কিন্তু মনে রাখবে:
-----------------
1000 / 100 / 10 / 1 হলো
বিষয়টি সহজে বোঝার জন্য আমাদের Teaching Model।

CSS-এর আসল Specificity:
------------------------
Inline → ID → CLASS → ELEMENT

এটি তুলনা করা হয়:
(Inline, ID, CLASS, ELEMENT)

যেমন:
#box .title p
→ (0, 1, 1, 1)


শেষ কথা:
---------
Specificity বেশি
→ Priority বেশি
→ সেই Rule প্রাধান্য পাবে।
