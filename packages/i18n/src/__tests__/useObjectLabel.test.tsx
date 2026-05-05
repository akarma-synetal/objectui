import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { I18nProvider } from '../provider';
import { createI18n } from '../i18n';
import { useObjectLabel } from '../useObjectLabel';

/**
 * Create a wrapper with custom translations to simulate CRM locale bundles.
 */
function createWrapper(lang: string, translations?: Record<string, unknown>) {
  const instance = createI18n({ defaultLanguage: lang, detectBrowserLanguage: false });
  if (translations) {
    instance.addResourceBundle(lang, 'translation', translations, true, true);
  }
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(I18nProvider, { instance }, children);
}

describe('useObjectLabel', () => {
  describe('objectLabel', () => {
    it('returns the plain label when no translation exists', () => {
      const wrapper = createWrapper('en');
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      const label = result.current.objectLabel({ name: 'order_item', label: 'Order Item' });
      expect(label).toBe('Order Item');
    });

    it('returns the translated label when a translation exists', () => {
      const wrapper = createWrapper('zh', {
        crm: { objects: { order_item: { label: '订单明细' } } },
      });
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      const label = result.current.objectLabel({ name: 'order_item', label: 'Order Item' });
      expect(label).toBe('订单明细');
    });

    it('falls back to plain label when translation key returns empty string', () => {
      const wrapper = createWrapper('zh', {
        crm: { objects: { order_item: { label: '' } } },
      });
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      const label = result.current.objectLabel({ name: 'order_item', label: 'Order Item' });
      expect(label).toBe('Order Item');
    });
  });

  describe('objectDescription', () => {
    it('returns undefined when objectDef has no description', () => {
      const wrapper = createWrapper('en');
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      const desc = result.current.objectDescription({ name: 'order_item' });
      expect(desc).toBeUndefined();
    });

    it('returns the plain description when no translation exists', () => {
      const wrapper = createWrapper('en');
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      const desc = result.current.objectDescription({ name: 'order_item', description: 'Line items in an order' });
      expect(desc).toBe('Line items in an order');
    });

    it('returns the translated description when a translation exists', () => {
      const wrapper = createWrapper('zh', {
        crm: { objects: { order_item: { description: '订单中的商品条目' } } },
      });
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      const desc = result.current.objectDescription({ name: 'order_item', description: 'Line items in an order' });
      expect(desc).toBe('订单中的商品条目');
    });
  });

  describe('fieldLabel', () => {
    it('returns the fallback label when no translation exists', () => {
      const wrapper = createWrapper('en');
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      const label = result.current.fieldLabel('order_item', 'name', 'Line Item');
      expect(label).toBe('Line Item');
    });

    it('returns the translated label when a translation exists', () => {
      const wrapper = createWrapper('zh', {
        crm: { fields: { order_item: { name: '订单项' } } },
      });
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      const label = result.current.fieldLabel('order_item', 'name', 'Line Item');
      expect(label).toBe('订单项');
    });

    it('falls back to plain label when translation key returns empty string', () => {
      const wrapper = createWrapper('zh', {
        crm: { fields: { order_item: { name: '' } } },
      });
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      const label = result.current.fieldLabel('order_item', 'name', 'Line Item');
      expect(label).toBe('Line Item');
    });
  });

  describe('multiple objects', () => {
    it('resolves labels for different objects independently', () => {
      const wrapper = createWrapper('zh', {
        crm: {
          objects: {
            contact: { label: '联系人' },
            opportunity: { label: '商机' },
          },
          fields: {
            contact: { email: '邮箱' },
            opportunity: { stage: '阶段' },
          },
        },
      });
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      expect(result.current.objectLabel({ name: 'contact', label: 'Contact' })).toBe('联系人');
      expect(result.current.objectLabel({ name: 'opportunity', label: 'Opportunity' })).toBe('商机');
      expect(result.current.fieldLabel('contact', 'email', 'Email')).toBe('邮箱');
      expect(result.current.fieldLabel('opportunity', 'stage', 'Stage')).toBe('阶段');
    });
  });

  describe('dashboardLabel / dashboardDescription', () => {
    it('returns plain label / description when no translation exists', () => {
      const wrapper = createWrapper('en');
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      expect(
        result.current.dashboardLabel({ name: 'sales_dashboard', label: 'Sales Performance' }),
      ).toBe('Sales Performance');
      expect(
        result.current.dashboardDescription({
          name: 'sales_dashboard',
          description: 'Pipeline analytics',
        }),
      ).toBe('Pipeline analytics');
    });

    it('returns translated label / description when present', () => {
      const wrapper = createWrapper('zh', {
        crm: {
          dashboards: {
            sales_dashboard: {
              label: '销售业绩',
              description: '管道分析、赢率趋势及代表绩效',
            },
          },
        },
      });
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      expect(
        result.current.dashboardLabel({ name: 'sales_dashboard', label: 'Sales Performance' }),
      ).toBe('销售业绩');
      expect(
        result.current.dashboardDescription({
          name: 'sales_dashboard',
          description: 'Pipeline analytics',
        }),
      ).toBe('管道分析、赢率趋势及代表绩效');
    });

    it('falls back to dashboard.name when no label provided', () => {
      const wrapper = createWrapper('en');
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      expect(result.current.dashboardLabel({ name: 'sales_dashboard' })).toBe('sales_dashboard');
    });

    it('returns undefined description when neither metadata nor translation provides one', () => {
      const wrapper = createWrapper('en');
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      expect(result.current.dashboardDescription({ name: 'sales_dashboard' })).toBeUndefined();
    });
  });

  describe('dashboardActionLabel / widgetTitle / widgetDescription', () => {
    const translations = {
      crm: {
        dashboards: {
          sales_dashboard: {
            actions: {
              create_opportunity: { label: '新建商机' },
            },
            widgets: {
              total_pipeline: {
                title: '总管道',
                description: '所有未关闭商机的金额合计',
              },
            },
          },
        },
      },
    };

    it('returns translated header-action label keyed by actionUrl', () => {
      const wrapper = createWrapper('zh', translations);
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      expect(
        result.current.dashboardActionLabel('sales_dashboard', 'create_opportunity', 'New Opportunity'),
      ).toBe('新建商机');
    });

    it('falls back to provided English label when no translation exists', () => {
      const wrapper = createWrapper('en');
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      expect(
        result.current.dashboardActionLabel('sales_dashboard', 'create_opportunity', 'New Opportunity'),
      ).toBe('New Opportunity');
    });

    it('returns translated widget title and description', () => {
      const wrapper = createWrapper('zh', translations);
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      expect(result.current.widgetTitle('sales_dashboard', 'total_pipeline', 'Total Pipeline')).toBe(
        '总管道',
      );
      expect(
        result.current.widgetDescription(
          'sales_dashboard',
          'total_pipeline',
          'Sum of open opportunity value',
        ),
      ).toBe('所有未关闭商机的金额合计');
    });

    it('falls back to plain title / description when key is missing', () => {
      const wrapper = createWrapper('en');
      const { result } = renderHook(() => useObjectLabel(), { wrapper });

      expect(result.current.widgetTitle('sales_dashboard', 'total_pipeline', 'Total Pipeline')).toBe(
        'Total Pipeline',
      );
      expect(
        result.current.widgetDescription('sales_dashboard', 'total_pipeline', 'Sum of open value'),
      ).toBe('Sum of open value');
      expect(result.current.widgetDescription('sales_dashboard', 'total_pipeline')).toBeUndefined();
    });
  });
});
