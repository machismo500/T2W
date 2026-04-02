import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const alt = "T2W Ride";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let ride: {
    title: string;
    rideNumber: string;
    startLocation: string;
    endLocation: string;
    distanceKm: number;
    type: string;
    posterUrl: string | null;
    status: string;
    difficulty: string;
  } | null = null;

  try {
    ride = await prisma.ride.findUnique({
      where: { id },
      select: {
        title: true,
        rideNumber: true,
        startLocation: true,
        endLocation: true,
        distanceKm: true,
        type: true,
        posterUrl: true,
        status: true,
        difficulty: true,
      },
    });
  } catch {
    // DB unavailable — fall through to default branded image
  }

  // If the ride has a poster, render it as the OG image (1200×630 crop)
  if (ride?.posterUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            position: "relative",
            background: "#0d0d12",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ride.posterUrl}
            alt={ride.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {/* Bottom branding strip */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 6,
              background: "linear-gradient(90deg, #f5a623, #e8563d)",
            }}
          />
        </div>
      ),
      { ...size }
    );
  }

  // No poster — generate a branded ride-info card
  const difficultyColor: Record<string, string> = {
    easy: "#4ade80",
    moderate: "#facc15",
    challenging: "#fb923c",
    extreme: "#f87171",
  };
  const typeLabel: Record<string, string> = {
    day: "Day Ride",
    weekend: "Weekend Ride",
    "multi-day": "Multi-Day",
    expedition: "Expedition",
    overnight: "Overnight",
  };

  const kmDisplay =
    ride?.distanceKm && ride.distanceKm >= 1000
      ? `${(ride.distanceKm / 1000).toFixed(1)}k km`
      : `${ride?.distanceKm ?? ""} km`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#0d0d12",
          padding: "52px 60px 0",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background texture — subtle radial gradient */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(245,166,35,0.12) 0%, transparent 70%)",
          }}
        />

        {/* T2W branding top */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#f5a623",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              fontWeight: 900,
              color: "#0d0d12",
            }}
          >
            T
          </div>
          <span
            style={{
              color: "#f5a623",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Tales on 2 Wheels
          </span>
        </div>

        {/* Badges row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 20,
          }}
        >
          {ride?.rideNumber && (
            <span
              style={{
                background: "rgba(245,166,35,0.15)",
                color: "#f5a623",
                padding: "5px 14px",
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 700,
                border: "1px solid rgba(245,166,35,0.3)",
              }}
            >
              {ride.rideNumber}
            </span>
          )}
          {ride?.type && (
            <span
              style={{
                background: "rgba(255,255,255,0.07)",
                color: "#aaa",
                padding: "5px 14px",
                borderRadius: 8,
                fontSize: 16,
                textTransform: "capitalize",
              }}
            >
              {typeLabel[ride.type] || ride.type}
            </span>
          )}
          {ride?.difficulty && (
            <span
              style={{
                background: "rgba(255,255,255,0.07)",
                color: difficultyColor[ride.difficulty] || "#aaa",
                padding: "5px 14px",
                borderRadius: 8,
                fontSize: 16,
                textTransform: "capitalize",
              }}
            >
              {ride.difficulty}
            </span>
          )}
          {ride?.status === "upcoming" && (
            <span
              style={{
                background: "rgba(96,165,250,0.15)",
                color: "#60a5fa",
                padding: "5px 14px",
                borderRadius: 8,
                fontSize: 16,
                border: "1px solid rgba(96,165,250,0.3)",
              }}
            >
              Open for Registration
            </span>
          )}
        </div>

        {/* Ride title */}
        <div
          style={{
            fontSize: ride?.title && ride.title.length > 40 ? 46 : 56,
            fontWeight: 800,
            color: "#ffffff",
            lineHeight: 1.1,
            marginBottom: 28,
            maxWidth: 950,
          }}
        >
          {ride?.title ?? "Motorcycle Ride"}
        </div>

        {/* Route + distance */}
        {ride?.startLocation && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              marginBottom: 0,
            }}
          >
            <span style={{ color: "#cccccc", fontSize: 28, fontWeight: 500 }}>
              {ride.startLocation}
            </span>
            <span style={{ color: "#f5a623", fontSize: 32, fontWeight: 700 }}>
              →
            </span>
            <span style={{ color: "#cccccc", fontSize: 28, fontWeight: 500 }}>
              {ride.endLocation}
            </span>
            {ride.distanceKm > 0 && (
              <span
                style={{
                  color: "#666",
                  fontSize: 22,
                  marginLeft: 8,
                  fontWeight: 400,
                }}
              >
                · {kmDisplay}
              </span>
            )}
          </div>
        )}

        {/* Motorcycle icon strip at the bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            right: 60,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "rgba(255,255,255,0.12)",
            fontSize: 13,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          taleson2wheels.com
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 7,
            background: "linear-gradient(90deg, #f5a623, #e8563d)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
