// src/components/map/MapView.tsx
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Issue, IssueStatus } from '../../types';

// Fix Leaflet default marker issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapViewProps {
  issues: Issue[];
  onIssueClick?: (issue: Issue) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
}

const statusColors: Record<IssueStatus, string> = {
  reported: '#dc2626',
  verified: '#f59e0b',
  escalated_l1: '#f59e0b',
  escalated_l2: '#f59e0b',
  escalated_l3: '#f59e0b',
  resolved: '#059669',
};

const statusLabels: Record<IssueStatus, string> = {
  reported: 'New',
  verified: 'Verified',
  escalated_l1: 'Escalated L1',
  escalated_l2: 'Escalated L2',
  escalated_l3: 'Escalated L3',
  resolved: 'Resolved',
};

export const MapView: React.FC<MapViewProps> = ({
  issues,
  onIssueClick,
  center = { lat: 12.9716, lng: 77.5946 }, // Bengaluru default
  zoom = 13,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !markersRef.current) return;

    markersRef.current.clearLayers();

    issues.forEach((issue) => {
      if (!issue.location?.lat || !issue.location?.lng) return;

      const color = statusColors[issue.status] || '#64748b';
      const statusLabel = statusLabels[issue.status] || issue.status;

      // Create custom marker with status dot
      const icon = L.divIcon({
        html: `
          <div style="
            width: 32px;
            height: 32px;
            background: white;
            border-radius: 50%;
            border: 3px solid ${color};
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.25);
            cursor: pointer;
            transition: transform 0.2s;
          ">
            <div style="
              width: 14px;
              height: 14px;
              background: ${color};
              border-radius: 50%;
            "></div>
          </div>
        `,
        className: 'custom-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([issue.location.lat, issue.location.lng], { icon })
        .addTo(markersRef.current!)
        .bindPopup(`
          <div class="min-w-[200px] p-1">
            <div class="font-semibold text-gray-800 text-sm">${issue.title}</div>
            <div class="text-xs text-gray-500 mt-0.5">${issue.category} · ${statusLabel}</div>
            <div class="text-xs text-gray-600 mt-1 line-clamp-2">${issue.description}</div>
            <button
              class="mt-2 w-full text-xs bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors"
              onclick="window.__issueClick_${issue.id}()"
            >
              View Details
            </button>
          </div>
        `);

      // Store click handler on window for popup button
      (window as any)[`__issueClick_${issue.id}`] = () => {
        if (onIssueClick) onIssueClick(issue);
      };

      marker.on('click', () => {
        if (onIssueClick) onIssueClick(issue);
      });
    });

    // Fit bounds if there are issues
    if (issues.length > 0) {
      const bounds = L.latLngBounds(
        issues.map(i => [i.location.lat, i.location.lng])
      );
      mapRef.current?.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else {
      mapRef.current?.setView([center.lat, center.lng], zoom);
    }
  }, [issues, mapReady, onIssueClick, center, zoom]);

  return <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />;
};

export default MapView;