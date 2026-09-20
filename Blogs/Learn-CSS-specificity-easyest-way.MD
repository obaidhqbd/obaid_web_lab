# CSS Specificity — কোন CSS Rule আগে কাজ করবে?

একই HTML Element-এর জন্য যদি একাধিক CSS Rule প্রযোজ্য হয়, তখন **কোন Rule-টি বেশি প্রাধান্য পাবে?**

এই প্রাধান্য নির্ধারণের ব্যবস্থাকেই বলা হয় **CSS Specificity**।

---

## 🎯 সহজে মনে রাখো

শেখার সুবিধার জন্য আমরা এভাবে মনে রাখতে পারি:

```text
INLINE      = 1000
#ID         = 100
.CLASS      = 10
ELEMENT     = 1
```

অর্থাৎ,

> **সংখ্যা যত বেশি → Priority তত বেশি।**

### উদাহরণ

```css
#box .title p
```

এখানে আছে:

```text
#ID      = 100
.CLASS   = 10
ELEMENT  = 1

Total = 111
```

তাই `#box .title p`-এর Specificity হলো **111** — আমাদের সহজ Teaching Model অনুযায়ী।

---

## ⚠️ তবে একটি বিষয় মনে রাখবে

`1000 / 100 / 10 / 1` হলো **বোঝার সুবিধার জন্য একটি Teaching Model**।

CSS-এর অফিসিয়াল Specificity-কে এভাবে লেখা হয়:

```text
(Inline, ID, CLASS, ELEMENT)
```

তাই,

```css
#box .title p
```

এর Specificity:

```text
(0, 1, 1, 1)
```

এখানে আগে **Inline**, তারপর **ID**, তারপর **Class**, তারপর **Element** তুলনা করা হয়।

---

## 🧠 এক লাইনে মনে রাখো

```text
INLINE > ID > CLASS > ELEMENT
```

**Specificity বেশি → Priority বেশি → সেই Rule প্রাধান্য পাবে।**
