'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Compass } from 'lucide-react';

export default function TrackingPage() {
  return (
    <div className="p-8 h-[calc(100vh-64px)] flex flex-col">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Live Tracking</h1>
          <p className="text-muted-foreground">Real-time location and route optimization</p>
        </div>
        <Button className="gap-2">
          <Compass className="w-4 h-4" />
          Recenter Map
        </Button>
      </div>

      <Card className="flex-1 overflow-hidden relative border-0 shadow-lg">
        {/* Mock Map Background */}
        <div className="absolute inset-0 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, #808080 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}>
          </div>

          {/* Route path visualization */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <path d="M 200 300 Q 400 100 600 300 T 1000 300" stroke="hsl(var(--primary))" strokeWidth="4" fill="none" strokeDasharray="10 5" />
          </svg>

          <div className="relative text-center z-10 p-8 bg-background/80 backdrop-blur-sm rounded-xl border shadow-sm max-w-md">
            <MapPin className="w-12 h-12 text-primary mx-auto mb-4 animate-bounce" />
            <h3 className="text-xl font-bold mb-2">Map View Active</h3>
            <p className="text-muted-foreground mb-6">
              Real-time GPS tracking is active. Your location is being updated every 30 seconds.
            </p>
            <div className="grid grid-cols-2 gap-4 text-left text-sm">
              <div className="bg-secondary/50 p-3 rounded-lg">
                <p className="text-muted-foreground text-xs uppercase font-bold">Current Speed</p>
                <p className="font-mono font-medium">45 km/h</p>
              </div>
              <div className="bg-secondary/50 p-3 rounded-lg">
                <p className="text-muted-foreground text-xs uppercase font-bold">Distance</p>
                <p className="font-mono font-medium">2.4 km</p>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Action Panel */}
        <div className="absolute bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-80 bg-background/95 backdrop-blur shadow-2xl border rounded-lg p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold">Heading to Pickup</h4>
              <p className="text-xs text-muted-foreground">Pizza Paradise • 1.2km away</p>
            </div>
          </div>
          <div className="space-y-2">
            <Button className="w-full">Open in Google Maps</Button>
            <Button variant="outline" className="w-full">Report Issue</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
