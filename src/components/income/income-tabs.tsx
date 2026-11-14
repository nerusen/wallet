"use client";

import * as React from "react";

import { FreelanceForm } from "@/components/income/freelance-form";
import { SalaryForm } from "@/components/income/salary-form";
import { TabRail } from "@/components/ui/tabs";
import { Reveal } from "@/components/ui/motion";
import type { Transaction, Wallet } from "@/lib/types/database";

type IncomeTab = "gaji" | "freelance";

/** Tab switch between the two income streams. */
export function IncomeTabs({
  wallets,
  transactions,
  today,
  salaryCount,
  freelanceCount,
}: {
  wallets: readonly Wallet[];
  transactions: readonly Transaction[];
  today: string;
  salaryCount: number;
  freelanceCount: number;
}) {
  const [tab, setTab] = React.useState<IncomeTab>("gaji");

  return (
    <div className="flex flex-col gap-6">
      <TabRail
        items={[
          { value: "gaji" as const, label: "Gaji Utama / Part-Time", meta: String(salaryCount) },
          { value: "freelance" as const, label: "Freelance · Nelsen Creative", meta: String(freelanceCount) },
        ]}
        value={tab}
        onChange={setTab}
        className="border-b-0"
      />

      <Reveal key={tab}>
        {tab === "gaji" ? (
          <SalaryForm wallets={wallets} today={today} />
        ) : (
          <FreelanceForm
            wallets={wallets}
            transactions={transactions}
            today={today}
          />
        )}
      </Reveal>
    </div>
  );
}
