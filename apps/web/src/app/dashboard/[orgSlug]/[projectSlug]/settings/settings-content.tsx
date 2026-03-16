"use client";

import React from "react";
import {
  Settings,
  Bell,
  Key,
  Database,
  CreditCard,
  Building2,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GeneralSection,
  AlertsSection,
  ApiKeysSection,
  BillingSection,
  DataSection,
  OrganizationsSection,
} from "./sections";

const tabs = [
  { value: "general", label: "General", icon: Settings },
  { value: "alerts", label: "Alerts", icon: Bell },
  { value: "api-keys", label: "API Keys", icon: Key },
  { value: "billing", label: "Billing", icon: CreditCard },
  { value: "data", label: "Data", icon: Database },
  { value: "organizations", label: "Organizations", icon: Building2 },
] as const;

export function SettingsContent() {
  return (
    <div className="px-4 lg:px-6">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6 h-auto flex-wrap gap-1 bg-transparent p-0">
          {tabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-lg"
            >
              <Icon className="h-4 w-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <GeneralSection />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertsSection />
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <ApiKeysSection />
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <BillingSection />
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <DataSection />
        </TabsContent>

        <TabsContent value="organizations" className="space-y-4">
          <OrganizationsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
