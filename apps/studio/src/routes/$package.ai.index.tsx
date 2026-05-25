// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { createFileRoute, Link } from '@tanstack/react-router';
import { Shield } from 'lucide-react';
import { MetadataListPage } from '@/components/MetadataListPage';

function AiListComponent() {
  const { package: packageId } = Route.useParams();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b bg-muted/30 px-6 py-3">
        <Link
          to="/$package/ai/approvals"
          params={{ package: packageId }}
          className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent"
        >
          <Shield className="h-3.5 w-3.5" />
          HITL Approvals
          <span className="text-muted-foreground">
            — review destructive tool calls awaiting sign-off
          </span>
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <MetadataListPage
          title="AI"
          subtitle="Agents, tools, and skills. Pick an agent and chat with it from the right-hand assistant panel, or invoke a tool from Playground → Tool."
          types={['agent', 'tool', 'skill']}
          packageId={packageId}
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute('/$package/ai/')({
  component: AiListComponent,
});
