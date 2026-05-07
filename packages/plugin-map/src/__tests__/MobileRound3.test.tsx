/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Mobile UX round 3 — Map: bottom-sheet record card on mobile, geolocate
 * button + permission flow, and cluster tap-through.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const setMobile = (mobile: boolean) => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: mobile ? 375 : 1280 });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: mobile && /max-width:\s*767/.test(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
};

const flyToCalls: any[] = [];
vi.mock('react-map-gl/maplibre', () => ({
  default: React.forwardRef(({ children }: any, ref: any) => {
    React.useEffect(() => {
      const fake = { flyTo: (opts: any) => flyToCalls.push(opts) };
      if (typeof ref === 'function') ref(fake);
      else if (ref) ref.current = fake;
    }, [ref]);
    return <div aria-label="Map">{children}</div>;
  }),
  Map: ({ children }: any) => <div aria-label="Map">{children}</div>,
  NavigationControl: () => <div data-testid="nav-control" />,
  Marker: ({ children, longitude, latitude, onClick }: any) => (
    <div
      data-testid="map-marker"
      data-lat={latitude}
      data-lng={longitude}
      onClick={() => onClick?.({ originalEvent: { stopPropagation: () => {} } })}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="map-popup">{children}</div>,
}));

import { ObjectMap } from '../ObjectMap';

const mockData = [
  { id: '1', name: 'A', latitude: 40, longitude: -74 },
  { id: '2', name: 'B', latitude: 41, longitude: -75 },
];

const baseSchema: any = {
  type: 'map',
  map: { latitudeField: 'latitude', longitudeField: 'longitude', titleField: 'name' },
  data: { provider: 'value', items: mockData },
};

beforeEach(() => {
  flyToCalls.length = 0;
  setMobile(false);
});

describe('Mobile UX Round 3 — ObjectMap', () => {
  it('renders a geolocate button', async () => {
    render(<ObjectMap schema={baseSchema} />);
    await waitFor(() => {
      expect(screen.getByTestId('map-geolocate')).toBeDefined();
    });
  });

  it('calls navigator.geolocation.getCurrentPosition when clicked', async () => {
    const getCurrentPosition = vi.fn();
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<ObjectMap schema={baseSchema} />);
    const btn = await screen.findByTestId('map-geolocate');
    fireEvent.click(btn);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('flies the map to the user location on success', async () => {
    const getCurrentPosition = vi.fn((success: any) => {
      success({ coords: { longitude: -73, latitude: 40.7 } });
    });
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<ObjectMap schema={baseSchema} />);
    const btn = await screen.findByTestId('map-geolocate');
    await act(async () => { fireEvent.click(btn); });
    expect(flyToCalls.some(c => c?.center?.[0] === -73 && c?.center?.[1] === 40.7)).toBe(true);
  });

  it('shows an error banner when geolocation is rejected', async () => {
    const getCurrentPosition = vi.fn((_success: any, error: any) => {
      error({ code: 1, message: 'Permission denied' });
    });
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(<ObjectMap schema={baseSchema} />);
    const btn = await screen.findByTestId('map-geolocate');
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeDefined();
    });
  });

  it('renders the mobile bottom-sheet record card on mobile when a marker is selected', async () => {
    setMobile(true);
    render(<ObjectMap schema={baseSchema} />);
    const markers = await screen.findAllByTestId('map-marker');
    fireEvent.click(markers[0]);
    const sheet = await screen.findByTestId('map-mobile-record-sheet');
    expect(sheet).toBeDefined();
    expect(screen.queryByTestId('map-popup')).toBeNull();
  });

  it('renders the desktop popup on desktop when a marker is selected', async () => {
    setMobile(false);
    render(<ObjectMap schema={baseSchema} />);
    const markers = await screen.findAllByTestId('map-marker');
    fireEvent.click(markers[0]);
    await waitFor(() => {
      expect(screen.queryByTestId('map-popup')).toBeDefined();
    });
    expect(screen.queryByTestId('map-mobile-record-sheet')).toBeNull();
  });

  it('closes the bottom sheet when the X button is pressed', async () => {
    setMobile(true);
    render(<ObjectMap schema={baseSchema} />);
    const markers = await screen.findAllByTestId('map-marker');
    fireEvent.click(markers[0]);
    const closeBtn = await screen.findByTestId('map-mobile-record-close');
    fireEvent.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByTestId('map-mobile-record-sheet')).toBeNull();
    });
  });

  it('flies in toward the cluster when tapped', async () => {
    const dense = [
      { id: '1', name: 'A', latitude: 40.000, longitude: -74.000 },
      { id: '2', name: 'B', latitude: 40.001, longitude: -74.001 },
      { id: '3', name: 'C', latitude: 40.002, longitude: -74.002 },
    ];
    const schema: any = {
      ...baseSchema,
      enableClustering: true,
      clusterRadius: 80,
      data: { provider: 'value', items: dense },
    };
    render(<ObjectMap schema={schema} enableClustering clusterRadius={80} />);
    const cluster = await waitFor(() => {
      const node = screen.queryByTestId('map-cluster');
      if (!node) throw new Error('no cluster');
      return node;
    });
    fireEvent.click(cluster.parentElement!);
    expect(flyToCalls.length).toBeGreaterThan(0);
  });
});
