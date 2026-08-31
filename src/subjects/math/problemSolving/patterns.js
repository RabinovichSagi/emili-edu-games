export const PROBLEM_PATTERNS = [
  { id: "addition_combining", titleHe: "חיבור — צירוף כמויות", structure: "חלק + חלק = שלם", operation: "addition" },
  { id: "subtraction_take_away", titleHe: "חיסור — לקחו או השתמשו", structure: "שלם − חלק = נשאר", operation: "subtraction" },
  { id: "missing_part", titleHe: "חלק חסר", structure: "שלם − חלק ידוע = חלק חסר", operation: "subtraction" },
  { id: "comparison", titleHe: "השוואה", structure: "גדול − קטן = הפרש", operation: "subtraction" },
  { id: "multiplication_equal_groups", titleHe: "כפל — קבוצות שוות", structure: "מספר קבוצות × גודל קבוצה = סך הכול", operation: "multiplication" },
  { id: "arrays_rectangles", titleHe: "מערכים ומלבנים", structure: "שורות × טורים = סך הכול", operation: "multiplication" },
  { id: "division_sharing", titleHe: "חילוק — חלוקה שווה", structure: "סך הכול ÷ מספר קבוצות = בכל קבוצה", operation: "division" },
  { id: "division_group_count", titleHe: "חילוק — כמה קבוצות", structure: "סך הכול ÷ גודל קבוצה = מספר קבוצות", operation: "division" },
  { id: "multiplicative_comparison", titleHe: "השוואה כפולית", structure: "כמות בסיס × פי כמה = כמות מושווית", operation: "multiplication" },
  { id: "two_step_add_subtract", titleHe: "דו־שלבי — מוסיפים ואז מחסרים", structure: "(התחלה + תוספת) − הורדה", operation: "two-step" },
  { id: "two_step_multiply_add", titleHe: "דו־שלבי — כפל ואז חיבור", structure: "(קבוצות × גודל) + תוספת", operation: "two-step" },
  { id: "two_step_multiply_subtract", titleHe: "דו־שלבי — כפל ואז חיסור", structure: "(קבוצות × גודל) − הוצאה", operation: "two-step" },
  { id: "two_step_divide_add", titleHe: "דו־שלבי — חילוק ואז חיבור", structure: "(סך הכול ÷ קבוצות) + תוספת", operation: "two-step" },
  { id: "two_step_add_divide", titleHe: "דו־שלבי — חיבור ואז חילוק", structure: "(חלק 1 + חלק 2) ÷ קבוצות", operation: "two-step" },
  { id: "combined_multiplication", titleHe: "שתי מכפלות שמתחברות", structure: "(מכפלה 1) + (מכפלה 2)", operation: "two-step" },
  { id: "division_remainders", titleHe: "חילוק עם שארית", structure: "חילוק שמייצר פריטים שנשארים", operation: "division" },
  { id: "sufficiency", titleHe: "האם יש מספיק?", structure: "השוואת כמות זמינה לכמות נדרשת", operation: "comparison" },
  { id: "hidden_operation", titleHe: "פעולה נסתרת", structure: "הפעולה מוסקת מהסיפור", operation: "mixed" },
  { id: "irrelevant_information", titleHe: "מידע מיותר", structure: "יש מספר שאינו דרוש לפתרון", operation: "mixed" },
  { id: "open_operation_selection", titleHe: "בחירת פעולה פתוחה", structure: "התלמיד/ה בוחר/ת את הפעולה", operation: "mixed" },
];

export const PATTERN_BY_ID = Object.fromEntries(PROBLEM_PATTERNS.map((pattern) => [pattern.id, pattern]));
