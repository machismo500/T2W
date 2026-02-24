"use client";

import { useState } from "react";
import {
  Search,
  Heart,
  Clock,
  User,
  Calendar,
  ArrowRight,
  Video,
  FileText,
  Plus,
  Tag,
  BookOpen,
  Play,
} from "lucide-react";
import { mockBlogs } from "@/data/mock";

type FilterType = "all" | "official" | "personal";

export function BlogsPage() {
  const [activeType, setActiveType] = useState<FilterType>("all");
  const [contentFilter, setContentFilter] = useState<"all" | "blog" | "vlog">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = mockBlogs.filter((blog) => {
    if (activeType !== "all" && blog.type !== activeType) return false;
    if (contentFilter === "blog" && blog.isVlog) return false;
    if (contentFilter === "vlog" && !blog.isVlog) return false;
    if (
      searchQuery &&
      !blog.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !blog.author.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !blog.tags.some((t) =>
        t.toLowerCase().includes(searchQuery.toLowerCase())
      )
    )
      return false;
    return true;
  });

  const featuredBlog = filtered[0];
  const otherBlogs = filtered.slice(1);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="font-display text-4xl font-bold text-white md:text-5xl">
            Blogs & <span className="gradient-text">Vlogs</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-t2w-muted">
            Stories from the road, gear reviews, riding tips, and video tales
            from the T2W community.
          </p>
        </div>

        {/* Filters Bar */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {(
              [
                { key: "all", label: "All" },
                { key: "official", label: "Official T2W" },
                { key: "personal", label: "Rider Stories" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveType(key)}
                className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                  activeType === key
                    ? "bg-t2w-accent text-white shadow-lg shadow-t2w-accent/25"
                    : "bg-t2w-surface text-t2w-muted hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="flex rounded-xl border border-t2w-border bg-t2w-surface">
              {(
                [
                  { key: "all", label: "All", icon: BookOpen },
                  { key: "blog", label: "Blogs", icon: FileText },
                  { key: "vlog", label: "Vlogs", icon: Video },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setContentFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-all first:rounded-l-xl last:rounded-r-xl ${
                    contentFilter === key
                      ? "bg-t2w-accent/20 text-t2w-accent"
                      : "text-t2w-muted hover:text-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-t2w-muted" />
              <input
                type="text"
                placeholder="Search posts..."
                className="input-field !py-2 !pl-10 w-48"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Featured Post */}
        {featuredBlog && (
          <div className="card-interactive group mb-10 overflow-hidden">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="flex h-48 w-full items-center justify-center rounded-xl bg-gradient-to-br from-t2w-accent/20 to-t2w-gold/10 md:h-64 md:w-80 shrink-0">
                {featuredBlog.isVlog ? (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-t2w-accent/30 backdrop-blur">
                    <Play className="h-8 w-8 text-white" />
                  </div>
                ) : (
                  <FileText className="h-16 w-16 text-t2w-accent/50" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                      featuredBlog.type === "official"
                        ? "bg-t2w-accent/10 text-t2w-accent"
                        : "bg-purple-400/10 text-purple-400"
                    }`}
                  >
                    {featuredBlog.type === "official"
                      ? "Official T2W"
                      : "Rider Story"}
                  </span>
                  {featuredBlog.isVlog && (
                    <span className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
                      <Video className="h-3 w-3" />
                      Vlog
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-t2w-muted">
                    <Clock className="h-3 w-3" />
                    {featuredBlog.readTime} min read
                  </span>
                </div>
                <h2 className="mt-3 font-display text-2xl font-bold text-white group-hover:text-t2w-accent transition-colors md:text-3xl">
                  {featuredBlog.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-t2w-muted">
                  {featuredBlog.excerpt}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-t2w-accent/10 text-xs font-bold text-t2w-accent">
                      {featuredBlog.author
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {featuredBlog.author}
                      </p>
                      <p className="text-xs text-t2w-muted">
                        {new Date(featuredBlog.publishDate).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short", year: "numeric" }
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-t2w-muted">
                    <Heart className="h-4 w-4" />
                    {featuredBlog.likes}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Blog Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {otherBlogs.map((blog) => (
            <article key={blog.id} className="card-interactive group">
              <div className="mb-4 flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-t2w-surface-light to-t2w-border/50">
                {blog.isVlog ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-t2w-accent/30">
                    <Play className="h-5 w-5 text-white" />
                  </div>
                ) : (
                  <FileText className="h-12 w-12 text-t2w-border" />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
                    blog.type === "official"
                      ? "bg-t2w-accent/10 text-t2w-accent"
                      : "bg-purple-400/10 text-purple-400"
                  }`}
                >
                  {blog.type === "official" ? "Official" : "Personal"}
                </span>
                {blog.isVlog && (
                  <span className="flex items-center gap-1 rounded-lg bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
                    <Video className="h-3 w-3" />
                    Vlog
                  </span>
                )}
              </div>

              <h3 className="mt-3 font-display text-lg font-bold text-white group-hover:text-t2w-accent transition-colors line-clamp-2">
                {blog.title}
              </h3>
              <p className="mt-2 text-sm text-t2w-muted line-clamp-3">
                {blog.excerpt}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {blog.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-t2w-surface-light px-2 py-0.5 text-xs text-t2w-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-t2w-border pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-t2w-muted">
                    {blog.author}
                  </span>
                  <span className="text-xs text-t2w-muted">&middot;</span>
                  <span className="flex items-center gap-1 text-xs text-t2w-muted">
                    <Clock className="h-3 w-3" />
                    {blog.readTime} min
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-t2w-muted">
                  <Heart className="h-3 w-3" />
                  {blog.likes}
                </div>
              </div>
            </article>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="py-20 text-center">
            <BookOpen className="mx-auto h-16 w-16 text-t2w-border" />
            <h3 className="mt-4 font-display text-xl font-bold text-white">
              No posts found
            </h3>
            <p className="mt-2 text-t2w-muted">
              Try adjusting your filters or search query.
            </p>
          </div>
        )}

        {/* Write CTA */}
        <div className="mt-16 text-center">
          <div className="card inline-block mx-auto max-w-lg">
            <h3 className="font-display text-xl font-bold text-white">
              Share Your Tale
            </h3>
            <p className="mt-2 text-sm text-t2w-muted">
              Got a ride story to tell? Write a blog or share your vlog with
              the T2W community.
            </p>
            <button className="btn-primary mt-4 flex items-center gap-2 mx-auto">
              <Plus className="h-4 w-4" />
              Create Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
