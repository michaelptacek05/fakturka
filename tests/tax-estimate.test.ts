import { describe, expect, it } from "vitest";

import { ActivityType } from "@/generated/prisma/enums";
import {
  estimateTaxes,
  getFlatExpenseCap,
  type TaxSettings,
} from "@/lib/tax-estimate";

const student: TaxSettings = {
  activityType: ActivityType.SECONDARY,
  applyTaxpayerCredit: true,
  flatExpenseRate: 60,
  socialThreshold: 117_521,
  taxpayerCredit: 30_840,
};

const hlavni: TaxSettings = {
  ...student,
  activityType: ActivityType.MAIN,
};

describe("paušální výdaje", () => {
  it("odečte zvolené procento z příjmů", () => {
    const estimate = estimateTaxes(500_000, student);

    expect(estimate.flatExpenses).toBe(300_000);
    expect(estimate.taxBase).toBe(200_000);
  });

  it("respektuje strop podle sazby", () => {
    expect(getFlatExpenseCap(40)).toBe(800_000);
    expect(getFlatExpenseCap(60)).toBe(1_200_000);
    expect(getFlatExpenseCap(80)).toBe(1_600_000);

    // 60 % z 2 500 000 by bylo 1 500 000, strop je ale 1 200 000.
    const estimate = estimateTaxes(2_500_000, student);

    expect(estimate.flatExpenses).toBe(1_200_000);
    expect(estimate.taxBase).toBe(1_300_000);
  });

  it("neznámou sazbu nahradí šedesáti procenty", () => {
    const estimate = estimateTaxes(100_000, { ...student, flatExpenseRate: 55 });

    expect(estimate.flatExpenses).toBe(60_000);
  });
});

describe("sociální pojistné u vedlejší činnosti", () => {
  it("je nulové pod rozhodnou částkou", () => {
    // Základ 100 000 Kč je pod 117 521 Kč.
    const estimate = estimateTaxes(250_000, student);

    expect(estimate.taxBase).toBe(100_000);
    expect(estimate.social.amount).toBe(0);
    expect(estimate.social.note).toContain("pod rozhodnou částkou");
  });

  it("ukazuje, kolik zbývá do rozhodné částky", () => {
    const estimate = estimateTaxes(250_000, student);

    expect(estimate.social.remainingToThreshold).toBe(17_521);
  });

  it("naskočí po překročení rozhodné částky", () => {
    // Základ 200 000 Kč překročil rozhodnou částku.
    const estimate = estimateTaxes(500_000, student);

    expect(estimate.social.amount).toBe(Math.round(200_000 * 0.55 * 0.292));
    expect(estimate.social.remainingToThreshold).toBe(0);
  });

  it("u hlavní činnosti se platí vždy a práh se neuplatní", () => {
    const estimate = estimateTaxes(250_000, hlavni);

    expect(estimate.social.amount).toBe(Math.round(100_000 * 0.55 * 0.292));
    expect(estimate.social.remainingToThreshold).toBeNull();
  });
});

describe("daň z příjmu a sleva na poplatníka", () => {
  it("slevou pokrytá daň je nulová", () => {
    // Daň před slevou je 15 000 Kč, sleva 30 840 Kč ji pokryje celou.
    const estimate = estimateTaxes(250_000, student);

    expect(estimate.incomeTax.beforeCredit).toBe(15_000);
    expect(estimate.incomeTax.amount).toBe(0);
    expect(estimate.incomeTax.note).toContain("Nula platí do příjmu");
  });

  it("nad hranicí slevy se daň začne platit", () => {
    // Základ 300 000 Kč → daň 45 000 Kč, po slevě 14 160 Kč.
    const estimate = estimateTaxes(750_000, student);

    expect(estimate.incomeTax.beforeCredit).toBe(45_000);
    expect(estimate.incomeTax.amount).toBe(14_160);
    expect(estimate.incomeTax.usedCredit).toBe(30_840);
  });

  it("bez uplatnění slevy se platí plná daň", () => {
    const estimate = estimateTaxes(250_000, {
      ...student,
      applyTaxpayerCredit: false,
    });

    expect(estimate.incomeTax.amount).toBe(15_000);
    expect(estimate.incomeTax.usedCredit).toBe(0);
  });

  it("sleva nikdy nevyrobí zápornou daň", () => {
    const estimate = estimateTaxes(50_000, student);

    expect(estimate.incomeTax.amount).toBe(0);
  });
});

describe("zdravotní pojistné", () => {
  it("se počítá ze skutečného zisku bez ohledu na práh", () => {
    const estimate = estimateTaxes(250_000, student);

    expect(estimate.health.amount).toBe(Math.round(100_000 * 0.5 * 0.135));
    expect(estimate.health.note).toContain("státní pojištěnce");
  });
});

describe("součet", () => {
  it("total je součtem daně a obou pojistných", () => {
    const estimate = estimateTaxes(750_000, student);

    expect(estimate.total).toBe(
      estimate.incomeTax.amount +
        estimate.social.amount +
        estimate.health.amount,
    );
  });

  it("student s malými příjmy neplatí nic", () => {
    const estimate = estimateTaxes(200_000, student);

    expect(estimate.incomeTax.amount).toBe(0);
    expect(estimate.social.amount).toBe(0);
    // Zdravotní se platí i tak, takže celek nulový není.
    expect(estimate.health.amount).toBeGreaterThan(0);
  });

  it("nulové příjmy dají nulový odhad", () => {
    const estimate = estimateTaxes(0, student);

    expect(estimate.total).toBe(0);
    expect(estimate.taxBase).toBe(0);
  });

  it("záporné příjmy nespadnou pod nulu", () => {
    const estimate = estimateTaxes(-1000, student);

    expect(estimate.revenue).toBe(0);
    expect(estimate.total).toBe(0);
  });
});
