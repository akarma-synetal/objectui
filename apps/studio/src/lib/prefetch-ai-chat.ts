// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Speculatively warm the lazy AI chat chunk graph (shiki / streamdown /
 * mermaid / @ai-sdk / plugin-chatbot, ~20MB total). Call from a toolbar
 * `onMouseEnter` / `onFocus` so by the time the user actually clicks,
 * the chunks are already in flight or cached.
 *
 * Repeated calls are cheap — the browser de-duplicates the `import()`.
 */
export const prefetchAiChatPanel = () => {
  void import('@/components/AiChatPanel');
};
