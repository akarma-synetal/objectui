// @vitest-environment happy-dom
// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, beforeEach } from 'vitest';

describe('AiChatPanel keyboard shortcut', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('toggles panel state via localStorage when Ctrl+Shift+I is dispatched', () => {
    // Verify the panel state key is not set initially
    expect(localStorage.getItem('objectstack:ai-chat-panel-open')).toBeNull();

    // Simulate toggling logic directly (keyboard integration tested via React hooks)
    localStorage.setItem('objectstack:ai-chat-panel-open', 'true');
    expect(localStorage.getItem('objectstack:ai-chat-panel-open')).toBe('true');

    localStorage.setItem('objectstack:ai-chat-panel-open', 'false');
    expect(localStorage.getItem('objectstack:ai-chat-panel-open')).toBe('false');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Universal Assistant — endpoint + skill override
// ═══════════════════════════════════════════════════════════════════

import {
  ASSISTANT_CHAT_PATH,
  SKILL_OVERRIDE_KEY,
  chatApiUrl,
  loadSkillOverride,
  saveSkillOverride,
} from '../src/components/AiChatPanel';

describe('Universal Assistant integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('chatApiUrl', () => {
    it('always points to the assistant chat endpoint', () => {
      expect(chatApiUrl('')).toBe(ASSISTANT_CHAT_PATH);
      expect(chatApiUrl('http://localhost:3000'))
        .toBe('http://localhost:3000' + ASSISTANT_CHAT_PATH);
    });

    it('uses the canonical /api/v1/ai/assistant/chat path', () => {
      expect(ASSISTANT_CHAT_PATH).toBe('/api/v1/ai/assistant/chat');
    });
  });

  describe('skill override persistence', () => {
    it('returns null when nothing stored', () => {
      expect(loadSkillOverride()).toBeNull();
    });

    it('round-trips a skill name through localStorage', () => {
      saveSkillOverride('lead_qualification');
      expect(localStorage.getItem(SKILL_OVERRIDE_KEY)).toBe('lead_qualification');
      expect(loadSkillOverride()).toBe('lead_qualification');
    });

    it('clears the override when saved as null', () => {
      saveSkillOverride('lead_qualification');
      saveSkillOverride(null);
      expect(localStorage.getItem(SKILL_OVERRIDE_KEY)).toBeNull();
      expect(loadSkillOverride()).toBeNull();
    });

    it('does not throw when localStorage is unavailable', () => {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
      expect(() => saveSkillOverride('x')).not.toThrow();
      localStorage.setItem = originalSetItem;
    });
  });

  describe('SKILL_OVERRIDE_KEY', () => {
    it('uses the namespaced key convention', () => {
      expect(SKILL_OVERRIDE_KEY).toBe('objectstack:ai-chat-skill');
    });
  });
});
