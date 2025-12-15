-- Add exam_config column to schools table
alter table public.schools 
add column if not exists exam_config jsonb default '{
  "current_term": "First Term",
  "academic_year": "2024/2025",
  "weights": {
    "class": 30,
    "exam": 70
  },
  "grading": [
    { "grade": "A", "min": 80, "max": 100, "remark": "Excellent" },
    { "grade": "B", "min": 70, "max": 79, "remark": "Very Good" },
    { "grade": "C", "min": 60, "max": 69, "remark": "Good" },
    { "grade": "D", "min": 50, "max": 59, "remark": "Credit" },
    { "grade": "E", "min": 40, "max": 49, "remark": "Pass" },
    { "grade": "F", "min": 0, "max": 39, "remark": "Fail" }
  ]
}'::jsonb;
