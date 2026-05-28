import type { Example, ExampleMeta } from './types.js';
import loginSimple from './schemas/auth/login-simple.json' with { type: 'json' };
import signup from './schemas/auth/signup.json' with { type: 'json' };
import forgotPassword from './schemas/auth/forgot-password.json' with { type: 'json' };
import twoFactor from './schemas/auth/two-factor.json' with { type: 'json' };
import forms_contact_form from './schemas/forms/contact-form.json' with { type: 'json' };
import forms_settings_form from './schemas/forms/settings-form.json' with { type: 'json' };
import forms_newsletter_signup from './schemas/forms/newsletter-signup.json' with { type: 'json' };
import forms_payment_form from './schemas/forms/payment-form.json' with { type: 'json' };
import ecommerce_product_card from './schemas/ecommerce/product-card.json' with { type: 'json' };
import ecommerce_product_grid from './schemas/ecommerce/product-grid.json' with { type: 'json' };
import ecommerce_shopping_cart from './schemas/ecommerce/shopping-cart.json' with { type: 'json' };
import ecommerce_order_summary from './schemas/ecommerce/order-summary.json' with { type: 'json' };
import marketing_pricing_table from './schemas/marketing/pricing-table.json' with { type: 'json' };
import marketing_features_grid from './schemas/marketing/features-grid.json' with { type: 'json' };
import marketing_call_to_action from './schemas/marketing/call-to-action.json' with { type: 'json' };
import marketing_testimonials from './schemas/marketing/testimonials.json' with { type: 'json' };
import dashboard_stats_cards_grid from './schemas/dashboard/stats-cards-grid.json' with { type: 'json' };
import dashboard_recent_activity_card from './schemas/dashboard/recent-activity-card.json' with { type: 'json' };
import dashboard_dashboard_overview from './schemas/dashboard/dashboard-overview.json' with { type: 'json' };

export type { Example, ExampleMeta } from './types.js';

/**
 * Registry of all examples shipped by ObjectUI.
 *
 * Keys are stable IDs of the shape `<category>/<slug>` and are used by:
 *   - The docs site's <SchemaExample id="..." /> MDX component
 *   - The smoke test that mounts every example
 *   - AI agents performing few-shot retrieval
 *
 * To add an example: drop a JSON file under src/schemas/<cat>/<slug>.json,
 * import it above, and add an entry below.
 */
const REGISTRY: Record<string, Example> = {
  'auth/login-simple': {
    id: 'auth/login-simple',
    meta: {
      title: "Simple Login Form",
      description: "Email + password sign-in with \"remember me\" and a social provider button.",
      category: 'auth',
      tags: ["login", "form", "card", "oauth"],
    },
    schema: loginSimple,
  },
  'auth/signup': {
    id: 'auth/signup',
    meta: {
      title: "Sign Up Form",
      description: "Two-column registration form with terms acceptance.",
      category: 'auth',
      tags: ["signup", "register", "form", "grid"],
    },
    schema: signup,
  },
  'auth/forgot-password': {
    id: 'auth/forgot-password',
    meta: {
      title: "Forgot Password",
      description: "Request a password reset email.",
      category: 'auth',
      tags: ["password", "reset", "form"],
    },
    schema: forgotPassword,
  },
  'auth/two-factor': {
    id: 'auth/two-factor',
    meta: {
      title: "Two-Factor Authentication",
      description: "6-digit code verification with resend.",
      category: 'auth',
      tags: ["2fa", "otp", "verification"],
    },
    schema: twoFactor,
  },
  'forms/contact-form': {
    id: 'forms/contact-form',
    meta: {
      title: "Contact Form",
      description: "Basic contact form layout",
      category: 'forms',
    },
    schema: forms_contact_form,
  },
  'forms/settings-form': {
    id: 'forms/settings-form',
    meta: {
      title: "Settings Form",
      description: "User preferences and settings",
      category: 'forms',
    },
    schema: forms_settings_form,
  },
  'forms/newsletter-signup': {
    id: 'forms/newsletter-signup',
    meta: {
      title: "Newsletter Signup",
      description: "Email subscription form",
      category: 'forms',
    },
    schema: forms_newsletter_signup,
  },
  'forms/payment-form': {
    id: 'forms/payment-form',
    meta: {
      title: "Payment Form",
      description: "Credit card payment form",
      category: 'forms',
    },
    schema: forms_payment_form,
  },
  'ecommerce/product-card': {
    id: 'ecommerce/product-card',
    meta: {
      title: "Product Card",
      description: "Single product card with add to cart",
      category: 'ecommerce',
    },
    schema: ecommerce_product_card,
  },
  'ecommerce/product-grid': {
    id: 'ecommerce/product-grid',
    meta: {
      title: "Product Grid",
      description: "Responsive product listing",
      category: 'ecommerce',
    },
    schema: ecommerce_product_grid,
  },
  'ecommerce/shopping-cart': {
    id: 'ecommerce/shopping-cart',
    meta: {
      title: "Shopping Cart",
      description: "Cart items and total",
      category: 'ecommerce',
    },
    schema: ecommerce_shopping_cart,
  },
  'ecommerce/order-summary': {
    id: 'ecommerce/order-summary',
    meta: {
      title: "Order Summary",
      description: "Final order review before payment",
      category: 'ecommerce',
    },
    schema: ecommerce_order_summary,
  },
  'marketing/pricing-table': {
    id: 'marketing/pricing-table',
    meta: {
      title: "Pricing Table",
      description: "Three-tier pricing layout",
      category: 'marketing',
    },
    schema: marketing_pricing_table,
  },
  'marketing/features-grid': {
    id: 'marketing/features-grid',
    meta: {
      title: "Features Grid",
      description: "Product feature highlights",
      category: 'marketing',
    },
    schema: marketing_features_grid,
  },
  'marketing/call-to-action': {
    id: 'marketing/call-to-action',
    meta: {
      title: "Call to Action",
      description: "Convert visitors into customers",
      category: 'marketing',
    },
    schema: marketing_call_to_action,
  },
  'marketing/testimonials': {
    id: 'marketing/testimonials',
    meta: {
      title: "Testimonials",
      description: "Social proof from happy customers",
      category: 'marketing',
    },
    schema: marketing_testimonials,
  },
  'dashboard/stats-cards-grid': {
    id: 'dashboard/stats-cards-grid',
    meta: {
      title: "Stats Cards Grid",
      description: "Revenue and user statistics",
      category: 'dashboard',
    },
    schema: dashboard_stats_cards_grid,
  },
  'dashboard/recent-activity-card': {
    id: 'dashboard/recent-activity-card',
    meta: {
      title: "Recent Activity Card",
      description: "List of recent transactions",
      category: 'dashboard',
    },
    schema: dashboard_recent_activity_card,
  },
  'dashboard/dashboard-overview': {
    id: 'dashboard/dashboard-overview',
    meta: {
      title: "Dashboard Overview",
      description: "Complete dashboard with stats and activity",
      category: 'dashboard',
    },
    schema: dashboard_dashboard_overview,
  },
};

/** Look up an example by id. Throws if the id is unknown. */
export function getExample(id: string): Example {
  const entry = REGISTRY[id];
  if (!entry) {
    throw new Error(
      `Unknown example id: "${id}". Known ids: ${Object.keys(REGISTRY).join(', ')}`,
    );
  }
  return entry;
}

/** Returns all examples in registry order. */
export function allExamples(): Example[] {
  return Object.values(REGISTRY);
}

/** Returns examples filtered by category. */
export function examplesByCategory(category: string): Example[] {
  return allExamples().filter((e) => e.meta.category === category);
}

/** Convenience: list all known ids (for debugging / tooling). */
export function allExampleIds(): string[] {
  return Object.keys(REGISTRY);
}
