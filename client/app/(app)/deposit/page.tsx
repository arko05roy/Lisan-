"use client";

import { PrivacyTabs } from "@/components/privacy/privacy-tabs";
import { DepositForm } from "@/components/privacy/deposit-form";

export default function DepositPage() {
  return (
    <PrivacyTabs>
      <DepositForm />
    </PrivacyTabs>
  );
}

