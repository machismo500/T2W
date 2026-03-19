import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { BlogDetailPage } from "@/components/blogs/BlogDetailPage";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const blog = await prisma.blogPost.findUnique({ where: { id } });

  if (!blog) {
    return {
      title: "Blog Not Found",
      description: "The requested blog post could not be found.",
    };
  }

  const tags: string[] = blog.tags ? JSON.parse(blog.tags) : [];
  const title = `${blog.title} | Tales on 2 Wheels Blog`;
  const description =
    blog.excerpt.length > 160
      ? blog.excerpt.slice(0, 157) + "..."
      : blog.excerpt;
  const url = `https://taleson2wheels.com/blog/${blog.id}`;

  return {
    title,
    description,
    keywords: [
      ...tags.map((t) => `${t} motorcycle`),
      "motorcycle blog India",
      "riding story",
      "Tales on 2 Wheels blog",
      "T2W blog",
      "motorcycle travel India",
    ],
    openGraph: {
      type: "article",
      title: blog.title,
      description,
      url,
      publishedTime: blog.publishDate.toISOString(),
      authors: [blog.authorName],
      tags,
      images: [
        {
          url: "/og-image.jpg",
          width: 1200,
          height: 630,
          alt: `${blog.title} - Tales on 2 Wheels`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: blog.title,
      description,
      images: ["/og-image.jpg"],
    },
    alternates: {
      canonical: url,
    },
  };
}

async function BlogArticleSchema({ blogId }: { blogId: string }) {
  const blog = await prisma.blogPost.findUnique({ where: { id: blogId } });
  if (!blog) return null;

  const tags: string[] = blog.tags ? JSON.parse(blog.tags) : [];

  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: blog.title,
    description: blog.excerpt,
    articleBody: blog.content,
    datePublished: blog.publishDate.toISOString(),
    dateModified: blog.publishDate.toISOString(),
    author: {
      "@type": "Person",
      name: blog.authorName,
    },
    publisher: {
      "@type": "Organization",
      name: "Tales on 2 Wheels",
      url: "https://taleson2wheels.com",
      logo: {
        "@type": "ImageObject",
        url: "https://taleson2wheels.com/logo.png",
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://taleson2wheels.com/blog/${blog.id}`,
    },
    image: "https://taleson2wheels.com/og-image.jpg",
    keywords: tags.join(", "),
    wordCount: blog.content.split(/\s+/).length,
    timeRequired: `PT${blog.readTime}M`,
    inLanguage: "en-IN",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <BlogArticleSchema blogId={id} />
      <BlogDetailPage blogId={id} />
    </>
  );
}
