"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Users,
  MapPin,
  Trophy,
  Bike,
} from "lucide-react";
import { api } from "@/lib/api-client";

interface HeroStats {
  activeRiders: number;
  ridesCompleted: number;
  kmsCovered: number;
  countriesRidden: number;
}

export function HeroSection() {
  const [nextRide, setNextRide] = useState<{ title: string; date: string } | null>(null);
  const [stats, setStats] = useState<HeroStats>({
    activeRiders: 0,
    ridesCompleted: 0,
    kmsCovered: 0,
    countriesRidden: 0,
  });

  useEffect(() => {
    // Fetch dynamic stats (non-blocking — stats show 0 then update)
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data: HeroStats) => setStats(data))
      .catch(() => {});

    // Fetch next upcoming ride
    api.rides.list().then((data: unknown) => {
      const { rides } = data as { rides: Array<{ title: string; startDate: string; status: string }> };
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = rides
        .filter((r) => r.status === "upcoming" && new Date(r.startDate) >= today)
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      if (upcoming.length > 0) {
        const ride = upcoming[0];
        const dateStr = new Date(ride.startDate).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        });
        setNextRide({ title: ride.title, date: dateStr });
      }
    }).catch(() => {});
  }, []);

  return (
    <section className="noise-bg relative flex min-h-screen items-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-hero-pattern" />
      <div className="absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-t2w-accent/5 blur-[120px]" />
      <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-t2w-gold/5 blur-[100px]" />

      {/* Grid Pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Background Logo Watermark — lazy, non-blocking */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-[280px] w-[280px] opacity-[0.05] sm:h-[600px] sm:w-[600px] md:h-[700px] md:w-[700px] lg:h-[800px] lg:w-[800px]">
          <Image
            src="/logo.png"
            alt=""
            fill
            className="object-contain"
            loading="lazy"
            priority={false}
            sizes="(max-width: 640px) 280px, (max-width: 768px) 600px, (max-width: 1024px) 700px, 800px"
          />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="max-w-4xl">
          {/* Badge - dynamically shows next upcoming ride */}
          {nextRide && (
            <div className="mb-8 inline-flex animate-fade-in items-center gap-2 rounded-full border border-t2w-accent/20 bg-t2w-accent/10 px-4 py-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-t2w-accent" />
              <span className="text-sm font-medium text-t2w-accent">
                Next Ride: {nextRide.title} &mdash; {nextRide.date}
              </span>
            </div>
          )}

          {/* Heading — always visible, CSS animation only */}
          <h1
            className="animate-slide-up font-display text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl"
            style={{ animationDelay: "100ms", animationFillMode: "both" }}
          >
            Every Road
            <br />
            <span className="gradient-text">Tells a Story</span>
          </h1>

          {/* Subheading */}
          <p
            className="mt-6 max-w-2xl animate-slide-up text-lg leading-relaxed text-gray-400 md:text-xl"
            style={{ animationDelay: "200ms", animationFillMode: "both" }}
          >
            India&apos;s premier motorcycle riding community, based in Bangalore.
            Group rides to Ladakh, Nepal, Thailand, Dhanushkodi, Munnar, Goa &amp;
            across India. Join us and write your own tale on two wheels.
          </p>

          {/* CTAs */}
          <div
            className="mt-10 flex animate-slide-up flex-col gap-4 sm:flex-row"
            style={{ animationDelay: "300ms", animationFillMode: "both" }}
          >
            <Link
              href="/register"
              className="btn-primary group flex items-center justify-center gap-2 text-lg"
            >
              Start Your Journey
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/rides"
              className="btn-secondary flex items-center justify-center gap-2 text-lg"
            >
              Explore Rides
            </Link>
          </div>

          {/* Stats */}
          <div
            className="mt-20 grid animate-slide-up grid-cols-2 gap-6 sm:grid-cols-4"
            style={{ animationDelay: "500ms", animationFillMode: "both" }}
          >
            {[
              { label: "Active Riders", value: stats.activeRiders, icon: Users },
              { label: "Rides Completed", value: stats.ridesCompleted, icon: MapPin },
              { label: "KMs Covered", value: stats.kmsCovered, icon: Bike },
              { label: "Countries Ridden", value: stats.countriesRidden, icon: Trophy },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="group">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-t2w-surface-light text-t2w-accent transition-colors group-hover:bg-t2w-accent/10">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-display text-2xl font-bold text-white">
                      {value.toLocaleString()}
                    </div>
                    <div className="text-xs text-t2w-muted">{label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown className="h-6 w-6 text-t2w-muted" />
      </div>
    </section>
  );
}
