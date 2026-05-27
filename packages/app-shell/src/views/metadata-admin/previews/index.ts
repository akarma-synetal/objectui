// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Built-in Preview-tab registrations.
 *
 * Each registration is one line; new types are trivially added without
 * touching `ResourceEditPage.tsx`. To opt OUT of a built-in preview in
 * a downstream app, call `registerMetadataPreview(type, MyVersion)`
 * after this module runs — `registerMetadataPreview` is last-write-wins.
 */

import { registerMetadataPreview } from '../preview-registry';
import { PagePreview } from './PagePreview';
import { ViewPreview } from './ViewPreview';
import { DashboardPreview } from './DashboardPreview';
import { ReportPreview } from './ReportPreview';
import { AppPreview } from './AppPreview';
import { ObjectPreview } from './ObjectPreview';
import { EmailTemplatePreview } from './EmailTemplatePreview';

export function registerBuiltinPreviews(): void {
  registerMetadataPreview('page', PagePreview);
  registerMetadataPreview('view', ViewPreview);
  registerMetadataPreview('dashboard', DashboardPreview);
  registerMetadataPreview('report', ReportPreview);
  registerMetadataPreview('app', AppPreview);
  registerMetadataPreview('object', ObjectPreview);
  registerMetadataPreview('email_template', EmailTemplatePreview);
}
