import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://taleson2wheels.com";

  let rides: Array<{ id: string; status: string; startDate: Date }> = [];
  let blogs: Array<{ id: string; publishDate: Date }> = [];

  try {
    rides = await prisma.ride.findMany({
      select: { id: true, status: true, startDate: true },
    });
    blogs = await prisma.blogPost.findMany({
      select: { id: true, publishDate: true },
    });
  } catch {
    // DB unavailable during build
  }

  const rideUrls = rides.map((ride) => ({
    url: `${baseUrl}/ride/${ride.id}`,
    lastModified: ride.status === "upcoming" ? new Date() : ride.startDate,
    changeFrequency: (ride.status === "upcoming" ? "daily" : "monthly") as "daily" | "monthly",
    priority: ride.status === "upcoming" ? 1.0 : 0.6,
  }));

  const blogUrls = blogs.map((blog) => ({
    url: `${baseUrl}/blog/${blog.id}`,
    lastModified: blog.publishDate,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/rides`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/blogs`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/guidelines`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    ...rideUrls,
    ...blogUrls,
  ];
}
