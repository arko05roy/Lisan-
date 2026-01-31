"use client";

import { PrivacyTabs } from "@/components/privacy/privacy-tabs";
import { WithdrawManager } from "@/components/privacy/withdraw-manager";

export default function WithdrawPage() {
  return (
    <PrivacyTabs>
      <WithdrawManager />
    </PrivacyTabs>
  );
}
