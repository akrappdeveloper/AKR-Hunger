'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Navigation, Gauge, Clock, MapPin, Bike, Signal } from 'lucide-react';

interface DriverInfoPanelProps {
  driverName: string;
  driverPhone?: string;
  driverVehicle?: string;
  speed?: number; // km/h
  heading?: number;
  accuracy?: number;
  isOnline?: boolean;
  distance?: string;
  eta?: string;
  phase?: 'going_to_restaurant' | 'going_to_customer' | 'delivered' | string;
  compact?: boolean;
  className?: string;
}

export default function DriverInfoPanel({
  driverName,
  driverPhone,
  driverVehicle,
  speed = 0,
  heading = 0,
  accuracy,
  isOnline = true,
  distance,
  eta,
  phase,
  compact = false,
  className = '',
}: DriverInfoPanelProps) {
  const getPhaseLabel = () => {
    switch (phase) {
      case 'going_to_restaurant': return 'Heading to Restaurant';
      case 'going_to_customer': return 'On the way to you';
      case 'delivered': return 'Delivered';
      default: return 'En Route';
    }
  };

  const getPhaseColor = () => {
    switch (phase) {
      case 'going_to_restaurant': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'going_to_customer': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'delivered': return 'bg-green-500/20 text-green-300 border-green-500/30';
      default: return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    }
  };

  const getHeadingDirection = (h: number) => {
    if (h >= 337.5 || h < 22.5) return 'N';
    if (h >= 22.5 && h < 67.5) return 'NE';
    if (h >= 67.5 && h < 112.5) return 'E';
    if (h >= 112.5 && h < 157.5) return 'SE';
    if (h >= 157.5 && h < 202.5) return 'S';
    if (h >= 202.5 && h < 247.5) return 'SW';
    if (h >= 247.5 && h < 292.5) return 'W';
    return 'NW';
  };

  const getSignalStrength = (acc?: number) => {
    if (!acc) return { label: 'No Signal', color: 'text-gray-500', bars: 0 };
    if (acc <= 5) return { label: 'Excellent', color: 'text-green-400', bars: 4 };
    if (acc <= 15) return { label: 'Good', color: 'text-green-400', bars: 3 };
    if (acc <= 30) return { label: 'Fair', color: 'text-yellow-400', bars: 2 };
    return { label: 'Weak', color: 'text-red-400', bars: 1 };
  };

  const signal = getSignalStrength(accuracy);

  if (compact) {
    return (
      <div className={`bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Bike className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">{driverName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={`text-[10px] ${getPhaseColor()} border px-2 py-0`}>
                  {getPhaseLabel()}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right">
            {distance && <p className="text-white font-bold text-lg">{distance}</p>}
            {eta && <p className="text-blue-400 text-xs font-mono">ETA {eta}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black/70 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 border-2 border-blue-500/40 flex items-center justify-center">
                <Bike className="w-6 h-6 text-blue-400" />
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-black ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
            </div>
            <div>
              <p className="text-white font-bold">{driverName}</p>
              {driverVehicle && <p className="text-gray-400 text-xs">{driverVehicle}</p>}
            </div>
          </div>
          {driverPhone && (
            <a href={`tel:${driverPhone}`}>
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white rounded-full h-9 w-9 p-0">
                <Phone className="w-4 h-4" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="p-4 space-y-3">
        {phase && (
          <Badge variant="outline" className={`${getPhaseColor()} border w-full justify-center py-1.5 text-xs font-bold`}>
            {getPhaseLabel()}
          </Badge>
        )}

        {/* ETA & Distance */}
        {(distance || eta) && (
          <div className="grid grid-cols-2 gap-3">
            {distance && (
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <MapPin className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                <p className="text-white font-bold text-lg">{distance}</p>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider font-bold">Distance</p>
              </div>
            )}
            {eta && (
              <div className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                <Clock className="w-4 h-4 text-green-400 mx-auto mb-1" />
                <p className="text-white font-bold text-lg">{eta}</p>
                <p className="text-gray-500 text-[10px] uppercase tracking-wider font-bold">ETA</p>
              </div>
            )}
          </div>
        )}

        {/* Speed & GPS Info */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <Gauge className="w-3.5 h-3.5 text-yellow-400 mx-auto mb-1" />
            <p className="text-white font-bold text-sm">{speed} km/h</p>
            <p className="text-gray-500 text-[9px] uppercase">Speed</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <Navigation className="w-3.5 h-3.5 text-purple-400 mx-auto mb-1" style={{ transform: `rotate(${heading}deg)` }} />
            <p className="text-white font-bold text-sm">{getHeadingDirection(heading)}</p>
            <p className="text-gray-500 text-[9px] uppercase">Heading</p>
          </div>
          <div className="bg-white/5 rounded-lg p-2 text-center">
            <Signal className={`w-3.5 h-3.5 ${signal.color} mx-auto mb-1`} />
            <p className="text-white font-bold text-sm">{accuracy ? `${accuracy}m` : '—'}</p>
            <p className="text-gray-500 text-[9px] uppercase">GPS</p>
          </div>
        </div>
      </div>
    </div>
  );
}
