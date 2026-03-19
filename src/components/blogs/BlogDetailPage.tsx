"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Calendar,
  Heart,
  Video,
  FileText,
  Play,
  User,
  Tag,
} from "lucide-react";
import { api } from "@/lib/api-client";

type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  publishDate: string;
  tags: string[];
  type: string;
  isVlog: boolean;
  videoUrl?: string | null;
  readTime: number;
  likes: number;
};

export function BlogDetailPage({ blogId }: { blogId: string }) {
  const [blog, setBlog] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.blogs
      .listApproved()
      .then((data: unknown) => {
        const d = data as { blogs: BlogPost[] };
        const found = d.blogs.find((b) => b.id === blogId);
        setBlog(found || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [blogId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <FileText className="h-8 w-8 animate-pulse text-t2w-accent" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <div className="text-center">
          <FileText className="mx-auto h-16 w-16 text-t2w-border" />
          <h1 className="mt-4 font-display text-2xl font-bold text-white">
            Blog Post Not Found
          </h1>
          <p className="mt-2 text-t2w-muted">
            This post may have been removed or is awaiting approval.
          </p>
          <Link
            href="/blogs"
            className="mt-6 inline-flex items-center gap-2 text-t2w-accent hover:text-t2w-accent/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blogs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          href="/blogs"
          className="mb-8 inline-flex items-center gap-2 text-sm text-t2w-muted hover:text-t2w-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Blogs & Vlogs
        </Link>

        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                blog.type === "official"
                  ? "bg-t2w-accent/10 text-t2w-accent"
                  : "bg-purple-400/10 text-purple-400"
              }`}
            >
              {blog.type === "official" ? "Official T2W" : "Rider Story"}
            </span>
            {blog.isVlog && (
              <span className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
                <Video className="h-3 w-3" />
                Vlog
              </span>
            )}
          </div>

          <h1 className="font-display text-3xl font-bold text-white md:text-4xl leading-tight">
            {blog.title}
          </h1>

          <p className="mt-4 text-lg text-t2w-muted leading-relaxed">
            {blog.excerpt}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4 border-b border-t2w-border pb-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-t2w-accent/10 text-xs font-bold text-t2w-accent">
                {(blog.authorName || "")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <span className="text-sm font-medium text-white">
                {blog.authorName}
              </span>
            </div>
            <span className="flex items-center gap-1.5 text-sm text-t2w-muted">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(blog.publishDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-t2w-muted">
              <Clock className="h-3.5 w-3.5" />
              {blog.readTime} min read
            </span>
            <span className="flex items-center gap-1.5 text-sm text-t2w-muted">
              <Heart className="h-3.5 w-3.5" />
              {blog.likes} likes
            </span>
          </div>
        </header>

        {/* Video embed if vlog */}
        {blog.isVlog && blog.videoUrl && (
          <div className="mb-8 aspect-video overflow-hidden rounded-2xl bg-t2w-surface">
            <iframe
              src={blog.videoUrl.replace("watch?v=", "embed/")}
              className="h-full w-full"
              allowFullScreen
              title={blog.title}
            />
          </div>
        )}

        {/* Featured image placeholder */}
        {!blog.isVlog && (
          <div className="mb-8 flex h-64 items-center justify-center rounded-2xl bg-gradient-to-br from-t2w-accent/20 to-t2w-gold/10">
            <FileText className="h-16 w-16 text-t2w-accent/50" />
          </div>
        )}

        {/* Content */}
        <div className="prose prose-invert max-w-none">
          {blog.content.split("\n").map((paragraph, i) => (
            <p
              key={i}
              className="mb-4 text-base leading-relaxed text-gray-300"
            >
              {paragraph}
            </p>
          ))}
        </div>

        {/* Tags */}
        <div className="mt-8 flex flex-wrap gap-2 border-t border-t2w-border pt-6">
          <Tag className="h-4 w-4 text-t2w-muted" />
          {blog.tags.map((tag) => (
            <Link
              key={tag}
              href={`/blogs?tag=${tag}`}
              className="rounded-lg bg-t2w-surface px-3 py-1.5 text-sm text-t2w-muted hover:text-t2w-accent transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>

        {/* Back to blogs */}
        <div className="mt-12 text-center">
          <Link
            href="/blogs"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to All Posts
          </Link>
        </div>
      </div>
    </article>
  );
}
