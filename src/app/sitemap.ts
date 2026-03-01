import { MetadataRoute } from "next";
import { mockRides, mockBlogs } from "@/data/mock";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://taleson2wheels.com";

  const rideUrls = mockRides.map((ride) => ({
    url: `${baseUrl}/ride?id=${ride.id}`,
    lastModified: new Date(ride.startDate),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const blogUrls = mockBlogs.map((blog) => ({
    url: `${baseUrl}/blogs#${blog.id}`,
    lastModified: new Date(blog.publishDate),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/rides`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blogs`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/guidelines`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/ride`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...rideUrls,
    ...blogUrls,
  ];
}
