// Pure ROI compute. Kept outside the Client component so it stays testable.
// Model: hoursSaved = team * 40h * 46 weeks * repetitive% * aiCoverage%.
// hourlyRate uses an employer-loaded cost factor (gross + 40 %).
// Deployment one-off ~ €5,000 → paybackWeeks = deployment / weeklySavings.

export interface RoiInputs {
  teamSize: number;
  annualSalaryK: number; // €K gross
  repetitivePct: number; // 0..100
  aiCoveragePct: number; // 0..100
}

export interface RoiResult {
  annualSavings: number; // €
  hoursSavedPerWeek: number; // h
  paybackWeeks: number; // weeks (≥ 1 once savings > 0)
}

export const ROI_CONSTANTS = {
  weeklyHours: 40,
  workingWeeks: 46,
  loadFactor: 1.4,
  deploymentCost: 5_000,
} as const;

export function computeRoi(inputs: RoiInputs): RoiResult {
  const { teamSize, annualSalaryK, repetitivePct, aiCoveragePct } = inputs;
  const { weeklyHours, workingWeeks, loadFactor, deploymentCost } = ROI_CONSTANTS;

  const annualSalary = annualSalaryK * 1000;
  const loaded = annualSalary * loadFactor;
  const hourlyRate = loaded / (weeklyHours * workingWeeks);
  const hoursSavedPerYear =
    teamSize * weeklyHours * workingWeeks * (repetitivePct / 100) * (aiCoveragePct / 100);
  const annualSavings = Math.round(hoursSavedPerYear * hourlyRate);
  const hoursSavedPerWeek = Math.round(hoursSavedPerYear / workingWeeks);
  const weeklySavings = annualSavings / workingWeeks;
  const paybackWeeks =
    weeklySavings > 0 ? Math.max(1, Math.round(deploymentCost / weeklySavings)) : 0;

  return { annualSavings, hoursSavedPerWeek, paybackWeeks };
}
