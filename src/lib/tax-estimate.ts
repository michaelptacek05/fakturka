/**
 * Orientační odhad daně a odvodů OSVČ.
 *
 * Sazby, které se roky nemění, jsou konstanty. Částky, které se mění každý
 * rok a u kterých se zdroje rozcházejí (rozhodná částka, sleva na poplatníka),
 * si uživatel nastavuje sám v profilu — jinak by aplikace tvrdila čísla,
 * která můžou být po Novém roce mimo.
 *
 * Nejde o daňové poradenství. Výpočet je zjednodušený, viz `SIMPLIFICATIONS`.
 */

import { ActivityType } from "@/generated/prisma/enums";

/** Sazba daně z příjmu fyzických osob. */
const INCOME_TAX_RATE = 0.15;

/** Sociální pojistné se počítá z 55 % daňového základu. */
const SOCIAL_ASSESSMENT_RATE = 0.55;
const SOCIAL_INSURANCE_RATE = 0.292;

/** Zdravotní pojistné se počítá z 50 % daňového základu. */
const HEALTH_ASSESSMENT_RATE = 0.5;
const HEALTH_INSURANCE_RATE = 0.135;

/** Strop paušálních výdajů podle použitého procenta. */
const FLAT_EXPENSE_CAPS: Record<number, number> = {
  40: 800_000,
  60: 1_200_000,
  80: 1_600_000,
};

export const FLAT_EXPENSE_RATES = [80, 60, 40] as const;

export const FLAT_EXPENSE_LABELS: Record<number, string> = {
  40: "40 % — svobodná povolání, jiné příjmy",
  60: "60 % — živnost volná i řemeslná",
  80: "80 % — zemědělská výroba, řemeslná živnost",
};

/** Co odhad neumí. Zobrazuje se u výsledku, ať se na něj nikdo nespoléhá. */
export const SIMPLIFICATIONS = [
  "Nepočítá minimální zálohy u hlavní činnosti.",
  "Nepočítá zvýšenou sazbu daně 23 % u vysokých příjmů.",
  "Nezná další slevy a odpočty kromě slevy na poplatníka.",
  "Vychází ze zaplacených faktur v kalendářním roce, ne z daňové evidence.",
];

export type TaxSettings = {
  activityType: ActivityType;
  applyTaxpayerCredit: boolean;
  flatExpenseRate: number;
  socialThreshold: number;
  taxpayerCredit: number;
};

export type EstimateItem = {
  amount: number;
  /** Proč vyšla zrovna tahle částka, hlavně když je nulová. */
  note: string;
};

export type TaxEstimate = {
  flatExpenses: number;
  health: EstimateItem;
  incomeTax: EstimateItem & {
    beforeCredit: number;
    usedCredit: number;
  };
  isSecondary: boolean;
  revenue: number;
  social: EstimateItem & {
    /** Kolik ještě zbývá do rozhodné částky. Null u hlavní činnosti. */
    remainingToThreshold: number | null;
  };
  taxBase: number;
  /** Součet všeho, co se doplácí po podání přiznání a přehledů. */
  total: number;
};

function round(value: number) {
  return Math.round(value);
}

export function getFlatExpenseCap(rate: number) {
  return FLAT_EXPENSE_CAPS[rate] ?? FLAT_EXPENSE_CAPS[60];
}

export function estimateTaxes(
  revenue: number,
  settings: TaxSettings,
): TaxEstimate {
  const safeRevenue = Math.max(revenue, 0);
  const rate = FLAT_EXPENSE_CAPS[settings.flatExpenseRate] ? settings.flatExpenseRate : 60;
  const flatExpenses = Math.min(
    safeRevenue * (rate / 100),
    getFlatExpenseCap(rate),
  );
  const taxBase = Math.max(safeRevenue - flatExpenses, 0);
  const isSecondary = settings.activityType === ActivityType.SECONDARY;

  // --- daň z příjmu ------------------------------------------------------
  const incomeTaxBeforeCredit = taxBase * INCOME_TAX_RATE;
  const credit = settings.applyTaxpayerCredit
    ? Math.max(settings.taxpayerCredit, 0)
    : 0;
  const usedCredit = Math.min(credit, incomeTaxBeforeCredit);
  const incomeTax = Math.max(incomeTaxBeforeCredit - credit, 0);

  let incomeTaxNote: string;

  if (!settings.applyTaxpayerCredit) {
    incomeTaxNote = "Bez slevy na poplatníka.";
  } else if (incomeTax === 0 && incomeTaxBeforeCredit > 0) {
    // Kolik ještě můžeš vyfakturovat, než sleva přestane stačit.
    const baseCoveredByCredit = credit / INCOME_TAX_RATE;
    const revenueCoveredByCredit = baseCoveredByCredit / (1 - rate / 100);

    incomeTaxNote = `Slevu na poplatníka daň nevyčerpá. Nula platí do příjmu zhruba ${round(
      revenueCoveredByCredit,
    ).toLocaleString("cs-CZ")} Kč.`;
  } else if (incomeTax === 0) {
    incomeTaxNote = "Zatím žádný daňový základ.";
  } else {
    incomeTaxNote = `Sleva na poplatníka snížila daň o ${round(
      usedCredit,
    ).toLocaleString("cs-CZ")} Kč.`;
  }

  // --- sociální pojistné -------------------------------------------------
  // U vedlejší činnosti se platí, až když zisk překročí rozhodnou částku.
  const isUnderThreshold = isSecondary && taxBase <= settings.socialThreshold;
  const socialAssessmentBase = taxBase * SOCIAL_ASSESSMENT_RATE;
  const social = isUnderThreshold
    ? 0
    : socialAssessmentBase * SOCIAL_INSURANCE_RATE;

  let socialNote: string;

  if (isUnderThreshold) {
    socialNote = `Zisk je pod rozhodnou částkou ${settings.socialThreshold.toLocaleString(
      "cs-CZ",
    )} Kč, sociální se u vedlejší činnosti neplatí.`;
  } else if (isSecondary) {
    socialNote = "Rozhodná částka je překročená, pojistné se doplácí podle přehledu.";
  } else {
    socialNote = "Hlavní činnost. Odhad nepočítá minimální zálohy.";
  }

  // --- zdravotní pojistné ------------------------------------------------
  const healthAssessmentBase = taxBase * HEALTH_ASSESSMENT_RATE;
  const health = healthAssessmentBase * HEALTH_INSURANCE_RATE;
  const healthNote = isSecondary
    ? "Za studenty a další státní pojištěnce neplatí minimální základ, platí se ze skutečného zisku."
    : "Hlavní činnost. Odhad nepočítá minimální vyměřovací základ.";

  return {
    flatExpenses: round(flatExpenses),
    health: { amount: round(health), note: healthNote },
    incomeTax: {
      amount: round(incomeTax),
      beforeCredit: round(incomeTaxBeforeCredit),
      note: incomeTaxNote,
      usedCredit: round(usedCredit),
    },
    isSecondary,
    revenue: round(safeRevenue),
    social: {
      amount: round(social),
      note: socialNote,
      remainingToThreshold: isSecondary
        ? Math.max(settings.socialThreshold - taxBase, 0)
        : null,
    },
    taxBase: round(taxBase),
    total: round(incomeTax + social + health),
  };
}
