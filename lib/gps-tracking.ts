/**
 * GPS Tracking Service
 * 
 * Smart GPS tracking with battery-efficient updates.
 * - Foreground active delivery: 3-sec interval + meaningful movement filter
 * - Online idle: 10-sec interval
 * - No movement: Reduces to 30-sec heartbeat
 * - Only writes to Firestore on significant change (>10m movement, >15° heading, or heartbeat)
 */

export interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number; // m/s, converted to km/h for display
  heading: number; // degrees from north
  timestamp: number;
}

export interface TrackingConfig {
  /** Minimum distance (meters) before triggering a Firestore write */
  minDistance: number;
  /** Minimum heading change (degrees) before triggering a write */
  minHeadingChange: number;
  /** Maximum time (ms) between writes (heartbeat) */
  heartbeatInterval: number;
  /** High accuracy mode */
  highAccuracy: boolean;
}

const DEFAULT_CONFIG: TrackingConfig = {
  minDistance: 10, // 10 meters
  minHeadingChange: 15, // 15 degrees
  heartbeatInterval: 30000, // 30 seconds
  highAccuracy: true,
};

const ACTIVE_DELIVERY_CONFIG: TrackingConfig = {
  minDistance: 5, // 5 meters (more frequent during delivery)
  minHeadingChange: 10,
  heartbeatInterval: 15000, // 15 seconds
  highAccuracy: true,
};

/**
 * Calculate distance between two GPS coordinates in meters (Haversine formula)
 */
export function calculateDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculate heading difference accounting for wrap-around (0-360)
 */
export function headingDifference(h1: number, h2: number): number {
  let diff = Math.abs(h1 - h2);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Convert speed from m/s to km/h
 */
export function speedToKmh(speedMs: number): number {
  return Math.round(speedMs * 3.6);
}

/**
 * Format ETA in human-readable format
 */
export function formatETA(seconds: number): string {
  if (seconds < 60) return 'Less than a minute';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Format distance in human-readable format
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export type PositionCallback = (position: GPSPosition) => void;
export type ErrorCallback = (error: GeolocationPositionError) => void;

/**
 * GPS Tracker class — manages watch position and smart filtering
 */
export class GPSTracker {
  private watchId: number | null = null;
  private lastWrittenPosition: GPSPosition | null = null;
  private lastWriteTime: number = 0;
  private config: TrackingConfig;
  private onPosition: PositionCallback;
  private onError: ErrorCallback;
  private isTracking: boolean = false;

  constructor(
    onPosition: PositionCallback,
    onError: ErrorCallback,
    config?: Partial<TrackingConfig>
  ) {
    this.onPosition = onPosition;
    this.onError = onError;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Update tracking config (e.g., switch to active delivery mode)
   */
  setConfig(config: Partial<TrackingConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Switch to active delivery mode (more frequent updates)
   */
  setActiveDeliveryMode() {
    this.config = { ...ACTIVE_DELIVERY_CONFIG };
  }

  /**
   * Switch back to idle mode
   */
  setIdleMode() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Check if GPS is supported and permission status
   */
  static async checkPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    if (!navigator.geolocation) return 'unsupported';
    
    try {
      if (navigator.permissions) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        return result.state as 'granted' | 'denied' | 'prompt';
      }
      return 'prompt'; // Can't check, assume prompt
    } catch {
      return 'prompt';
    }
  }

  /**
   * Get current position as a one-shot request
   */
  static getCurrentPosition(): Promise<GPSPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed || 0,
            heading: pos.coords.heading || 0,
            timestamp: pos.timestamp,
          });
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }

  /**
   * Start continuous GPS tracking
   */
  start(): boolean {
    if (this.isTracking) return true;
    if (!navigator.geolocation) return false;

    this.isTracking = true;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.handlePosition(pos),
      (err) => this.onError(err),
      {
        enableHighAccuracy: this.config.highAccuracy,
        timeout: 15000,
        maximumAge: 0,
      }
    );

    return true;
  }

  /**
   * Stop GPS tracking
   */
  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.lastWrittenPosition = null;
    this.lastWriteTime = 0;
  }

  /**
   * Check if currently tracking
   */
  get tracking(): boolean {
    return this.isTracking;
  }

  /**
   * Internal handler — applies smart filtering before calling onPosition
   */
  private handlePosition(pos: GeolocationPosition) {
    const current: GPSPosition = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      speed: pos.coords.speed || 0,
      heading: pos.coords.heading || 0,
      timestamp: pos.timestamp,
    };

    // Should we write this update?
    if (this.shouldWrite(current)) {
      this.lastWrittenPosition = current;
      this.lastWriteTime = Date.now();
      this.onPosition(current);
    }
  }

  /**
   * Determine if position update warrants a Firestore write
   */
  private shouldWrite(current: GPSPosition): boolean {
    // Always write the first position
    if (!this.lastWrittenPosition) return true;

    const now = Date.now();

    // Heartbeat: always write after heartbeat interval
    if (now - this.lastWriteTime >= this.config.heartbeatInterval) return true;

    // Distance check
    const distance = calculateDistance(
      this.lastWrittenPosition.latitude, this.lastWrittenPosition.longitude,
      current.latitude, current.longitude
    );
    if (distance >= this.config.minDistance) return true;

    // Heading change check
    if (
      current.heading > 0 &&
      this.lastWrittenPosition.heading > 0 &&
      headingDifference(current.heading, this.lastWrittenPosition.heading) >= this.config.minHeadingChange
    ) {
      return true;
    }

    // Speed change check (significant change = >10 km/h difference)
    const speedDiff = Math.abs(
      speedToKmh(current.speed) - speedToKmh(this.lastWrittenPosition.speed)
    );
    if (speedDiff >= 10) return true;

    return false;
  }
}
