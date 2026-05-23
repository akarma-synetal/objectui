import type { ReactNode } from 'react';

/**
 * Generic data source interface
 * Third-party systems can implement this to connect their own backends
 */
export interface DataSource {
  find(objectName: string, params?: any): Promise<any>;
  findOne(objectName: string, id: string, params?: any): Promise<any>;
  create(objectName: string, data: any): Promise<any>;
  update(objectName: string, id: string, data: any): Promise<any>;
  delete(objectName: string, id: string): Promise<void>;
  getMetadata?(): Promise<any>;
  [key: string]: any; // Allow additional methods
}

export interface AppShellProps {
  /** Sidebar component (optional) */
  sidebar?: ReactNode;
  /** Header component (optional) */
  header?: ReactNode;
  /** Footer component (optional) */
  footer?: ReactNode;
  /** Main content */
  children: ReactNode;
  /** Custom className */
  className?: string;
}
