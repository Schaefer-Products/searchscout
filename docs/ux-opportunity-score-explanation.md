# UX Research Brief: Opportunity Score Explanation (Feature 10)

**Date:** 2026-03-07
**For:** UI Designer → Frontend Developer

---

## 1. User Need

Business owners see a number (0–100) next to each keyword but have no way to know what it means or why one keyword scores 72 while another scores 31. Without understanding the score they can't trust it, and without trust they won't act on it. A brief, plain-language explanation builds confidence and teaches the user how to interpret results.

---

## 2. Explanation Content

The Opportunity Score is a 0–100 ranking of how worthwhile a keyword is to target.

**Three factors (plain language):**
- **Search volume (40%)** — how many people search for this each month. More searches = higher score.
- **Difficulty (40%)** — how hard it is to rank for this keyword. Easier keywords score higher.
- **Competitor gap (20%)** — how many of your competitors already rank for it. More competitors = more validated demand = higher score.

**Score guide:**
- 70–100: Strong opportunity — high volume, low difficulty, well-validated
- 40–69: Moderate opportunity — worth considering
- 0–39: Weak opportunity — low volume, high difficulty, or little competitor validation

---

## 3. Interaction Pattern

**Primary:** An ℹ (info) icon button placed inline with the "Opportunity Score" column header text.
- Desktop: tooltip on hover + focus (`:hover`, `:focus-visible`)
- Mobile: tooltip on tap (toggle open/close)

**Secondary (optional):** No tooltip on individual score badges — the column header tooltip is sufficient. Score badges already use colour coding (green/amber/red) which provides passive context.

---

## 4. Tooltip Content Spec

**Title:** Opportunity Score

**Body:**
> A 0–100 score ranking how worthwhile this keyword is to target.
>
> **How it's calculated:**
> - Search volume (40%) — more monthly searches = higher score
> - Keyword difficulty (40%) — easier to rank = higher score
> - Competitor validation (20%) — more competitors ranking = more validated demand
>
> **Score guide:** 70–100 Strong · 40–69 Moderate · 0–39 Weak

---

## 5. Edge Cases

- **Column not visible** (non-opportunities views: all, shared, unique): the Opportunity Score column is absent. The tooltip does not appear. No special handling needed.
- **All scores are 0**: not a realistic scenario (score is only set on `isOpportunity` keywords). If it were, the colour coding would show all red — the tooltip explanation remains valid.
- **Tooltip overflow on mobile**: constrain max-width to `280px`; allow vertical scroll within the tooltip if content overflows.
