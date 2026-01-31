"use client";

import { PrivacyTabs } from "@/components/privacy/privacy-tabs";
import { TransferForm } from "@/components/privacy/transfer-form";

export default function TransferPage() {
  return (
    <PrivacyTabs>
      <TransferForm />
    </PrivacyTabs>
  );
}

