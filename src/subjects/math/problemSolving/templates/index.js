import { templates as t_addition_combining } from "./addition_combining.js";
import { templates as t_subtraction_take_away } from "./subtraction_take_away.js";
import { templates as t_missing_part } from "./missing_part.js";
import { templates as t_comparison } from "./comparison.js";
import { templates as t_multiplication_equal_groups } from "./multiplication_equal_groups.js";
import { templates as t_arrays_rectangles } from "./arrays_rectangles.js";
import { templates as t_division_sharing } from "./division_sharing.js";
import { templates as t_division_group_count } from "./division_group_count.js";
import { templates as t_multiplicative_comparison } from "./multiplicative_comparison.js";
import { templates as t_two_step_add_subtract } from "./two_step_add_subtract.js";
import { templates as t_two_step_multiply_add } from "./two_step_multiply_add.js";
import { templates as t_two_step_multiply_subtract } from "./two_step_multiply_subtract.js";
import { templates as t_two_step_divide_add } from "./two_step_divide_add.js";
import { templates as t_two_step_add_divide } from "./two_step_add_divide.js";
import { templates as t_combined_multiplication } from "./combined_multiplication.js";
import { templates as t_division_remainders } from "./division_remainders.js";
import { templates as t_sufficiency } from "./sufficiency.js";
import { templates as t_hidden_operation } from "./hidden_operation.js";
import { templates as t_irrelevant_information } from "./irrelevant_information.js";
import { templates as t_open_operation_selection } from "./open_operation_selection.js";

export const ALL_PROBLEM_TEMPLATES = [
  ...t_addition_combining,
  ...t_subtraction_take_away,
  ...t_missing_part,
  ...t_comparison,
  ...t_multiplication_equal_groups,
  ...t_arrays_rectangles,
  ...t_division_sharing,
  ...t_division_group_count,
  ...t_multiplicative_comparison,
  ...t_two_step_add_subtract,
  ...t_two_step_multiply_add,
  ...t_two_step_multiply_subtract,
  ...t_two_step_divide_add,
  ...t_two_step_add_divide,
  ...t_combined_multiplication,
  ...t_division_remainders,
  ...t_sufficiency,
  ...t_hidden_operation,
  ...t_irrelevant_information,
  ...t_open_operation_selection,
];

export const TEMPLATES_BY_PATTERN = ALL_PROBLEM_TEMPLATES.reduce((acc, template) => {
  (acc[template.patternId] ||= []).push(template);
  return acc;
}, {});
