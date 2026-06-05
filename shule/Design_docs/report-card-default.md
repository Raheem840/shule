# Shule — Default Report Card Layout (ASCII Reference)

> This is the default text-only fallback layout rendered by `src/lib/reportCardPdf.ts`
> when no school letterhead template has been uploaded.
> When a template image is uploaded, the top header section is replaced by the image,
> but all sections below (student info onward) remain identical.

---

## CBC Grade Scale (UNEB Official)

| Grade | Range    | Descriptor      | Points |
|-------|----------|-----------------|--------|
| A     | 80 – 100 | Excellent        | 6      |
| B     | 70 – 79  | Very Good        | 5      |
| C     | 60 – 69  | Good             | 4      |
| D     | 50 – 59  | Satisfactory     | 3      |
| E     | 0 – 49   | Needs Improvement| 2      |

**CBC Formula:**
- `ca_out_of_20 = (total_ca_points / (assessed × 3)) × 20`
- `total = ca_out_of_20 + exam_score (out of 80)`

---

## Default Layout — Full Page (A4 Portrait)

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                  ║
║              NEW YOUTH COMPREHENSIVE SCHOOL                                      ║
║                "Excellence Through Service"                                      ║
║                                                                                  ║
║                      STUDENT REPORT CARD                                         ║
║                   Term 1  ·  Academic Year 2025                                  ║
║                                                                                  ║
╠══════════════════════════════════════════════════════════════════════════════════╣  ← teal rule
║                                                                                  ║
║  Name:        OKELLO JAMES OPIO          │  Adm. No:  NYS/2025/001              ║
║  Class:       Senior 2 West              │  Gender:   Male                      ║
║  Term Dates:  3 Feb 2025 – 15 Apr 2025                                          ║
║                                                                                  ║
╠──────────────────────────────────────────────────────────────────────────────────╣  ← light rule
║                                                                                  ║
║  ACADEMIC PERFORMANCE                                                            ║
║                                                                                  ║
║  ┌──────────────────────┬────┬────┬────┬─────┬─────┬──────┬──────┬───────┬─────┐ ║
║  │ Subject              │ C1 │ C2 │ C3 │ Pts │ Max │  /20 │ Exam │ Total │  G  │ ║  ← teal header row
║  ├──────────────────────┼────┼────┼────┼─────┼─────┼──────┼──────┼───────┼─────┤ ║
║  │ Mathematics          │  3 │  2 │  3 │  8  │  9  │ 17.8 │  65  │  82.8 │  B  │ ║
║  │ English Language     │  3 │  3 │  3 │  9  │  9  │ 20.0 │  72  │  92.0 │  A  │ ║
║  │ Physics              │  2 │  3 │  2 │  7  │  9  │ 15.6 │  58  │  73.6 │  B  │ ║
║  │ Chemistry            │  3 │  2 │  1 │  6  │  9  │ 13.3 │  50  │  63.3 │  C  │ ║
║  │ Biology              │  1 │  2 │  2 │  5  │  9  │ 11.1 │  44  │  55.1 │  D  │ ║
║  │ History              │  3 │  3 │  2 │  8  │  9  │ 17.8 │  67  │  84.8 │  B  │ ║
║  │ Geography            │ ABS│  2 │  3 │  5  │  6  │ 16.7 │  61  │  77.7 │  B  │ ║  ← ABS = absent for that CA
║  └──────────────────────┴────┴────┴────┴─────┴─────┴──────┴──────┴───────┴─────┘ ║
║                                                                                  ║
╠──────────────────────────────────────────────────────────────────────────────────╣
║                                                                                  ║
║  OVERALL PERFORMANCE                                                             ║
║  Total Grade Points:  34          Average Grade:  B — Very Good                 ║
║                                                                                  ║
╠──────────────────────────────────────────────────────────────────────────────────╣
║                                                                                  ║
║  ATTENDANCE                                  (hidden when no data recorded)      ║
║  Days Present:  55     Days Absent:  3     Attendance Rate:  95%                ║
║                                                                                  ║
╠──────────────────────────────────────────────────────────────────────────────────╣
║                                                                                  ║
║  CLASS TEACHER'S REMARKS                                                        ║
║  James has demonstrated commendable effort this term. He needs to focus          ║
║  more on Biology and Chemistry. Encourage group study sessions next term.        ║
║                                                                                  ║
╠──────────────────────────────────────────────────────────────────────────────────╣
║                                                                                  ║
║  PRINCIPAL'S REMARKS                                                            ║
║  ___________________________________________________________________________    ║  ← blank line if no remarks set
║                                                                                  ║
╠──────────────────────────────────────────────────────────────────────────────────╣
║                                                                                  ║
║  Next Term Begins:  10 Jun 2025                                                 ║
║                                                                                  ║
║  Class Teacher: _________________________  Date: _____________                  ║
║  Principal:     _________________________                                        ║
║                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

---

## Column Reference (Academic Performance Table)

| Column  | Source                                   | Width   |
|---------|------------------------------------------|---------|
| Subject | `subjects.name`                          | 38 mm   |
| C1…Cn   | CA scores (dynamic, 1 col per CA entry)  | 7 mm ea |
| Pts     | `sum(ca_scores)`                         | 10 mm   |
| Max     | `assessed × 3`                           | 10 mm   |
| /20     | `(Pts / Max) × 20`                       | 10 mm   |
| Exam    | End-of-term exam score (out of 80)       | 10 mm   |
| Total   | `/20 + Exam`                             | 12 mm   |
| Grade   | A / B / C / D / E (colour-coded)         | 11 mm   |

- `ABS` appears in a CA cell when `is_absent = true` for that assessment
- `—` appears in Exam/Total when no exam result recorded
- Grade cell text colour: A=green, B=blue, C=amber, D=orange, E=red

---

## Layout Variants

### With Uploaded Template (letterhead image)
```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                  ║
║   ┌──────────────────────────────────────────────────────────────────────────┐  ║
║   │                                                                          │  ║
║   │   [SCHOOL LETTERHEAD IMAGE — full width, max 60mm tall]                  │  ║
║   │   (logo, school name, motto, address — all from the image)               │  ║
║   │                                                                          │  ║
║   └──────────────────────────────────────────────────────────────────────────┘  ║
║                                                                                  ║
╠══════════════════════════════════════════════════════════════════════════════════╣  ← teal rule
║                      STUDENT REPORT CARD                                         ║
║                   Term 1  ·  Academic Year 2025                                  ║
╠──────────────────────────────────────────────────────────────────────────────────╣
║  [ ... rest of layout identical to default ... ]                                 ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

Template images are stored in the **`templates`** bucket (private).
URL saved in `school_profile.report_template_url`.
Upload via: Admin → School Settings → Report Card Template.

---

## Report Card Status Flow

```
  [Teacher enters marks + remarks]
           │
           ▼
      ┌─────────┐
      │  DRAFT  │  ← report_cards.status = 'draft'
      └─────────┘
           │  Secretary generates PDF
           ▼
      ┌─────────┐
      │  READY  │  ← PDF in report-cards bucket, pdf_url stored
      └─────────┘
           │  Principal reviews + approves
           ▼
      ┌──────────┐
      │ APPROVED │
      └──────────┘
           │  Principal releases to parents
           ▼
      ┌──────────────┐
      │   RELEASED   │  ← parent can download PDF
      └──────────────┘
           │  Principal unlocks for correction (if needed)
           ▼
      ┌─────────┐
      │  DRAFT  │  ← unlock_count incremented, unlock_reason stored
      └─────────┘
```

Source: `src/lib/reportCardPdf.ts`, `src/hooks/useReportCards.ts`
