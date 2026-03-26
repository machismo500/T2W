"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Heart,
  Clock,
  Calendar,
  Video,
  FileText,
  Plus,
  BookOpen,
  Play,
  Loader2,
  Send,
  X,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import type { BlogApprovalStatus } from "@/types";

type BlogPost = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  authorName: string;
  authorId?: string;
  publishDate: string;
  tags: string[];
  type: string;
  isVlog: boolean;
  videoUrl?: string | null;
  readTime: number;
  likes: number;
  approvalStatus: BlogApprovalStatus;
};

type FilterType = "all" | "official" | "personal";

export function BlogsPage() {
  const { user, canPostBlog, canApproveContent } = useAuth();
  const [activeType, setActiveType] = useState<FilterType>("all");
  const [contentFilter, setContentFilter] = useState<"all" | "blog" | "vlog">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [blogCreated, setBlogCreated] = useState(false);

  // Create blog form
  const [newBlog, setNewBlog] = useState({
    title: "",
    excerpt: "",
    content: "",
    tags: "",
    isVlog: false,
    videoUrl: "",
  });

  useEffect(() => {
    // Show approved blogs to everyone; Core+ can see all
    const fetchBlogs = canApproveContent
      ? api.blogs.list()
      : api.blogs.listApproved();

    fetchBlogs
      .then((data: unknown) => {
        const d = data as { blogs: BlogPost[] };
        setBlogs(d.blogs);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [canApproveContent]);

  const handleCreateBlog = async () => {
    if (!user || !newBlog.title.trim() || !newBlog.content.trim()) return;
    setCreating(true);
    try {
      const autoApprove = canApproveContent;
      await api.blogs.create({
        title: newBlog.title,
        excerpt: newBlog.excerpt || newBlog.content.slice(0, 150) + "...",
        content: newBlog.content,
        authorName: user.name,
        authorId: user.id,
        tags: newBlog.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        type: "personal",
        isVlog: newBlog.isVlog,
        videoUrl: newBlog.videoUrl || undefined,
        readTime: Math.max(1, Math.ceil(newBlog.content.split(/\s+/).length / 200)),
        approvalStatus: autoApprove ? "approved" : "pending",
        approvedBy: autoApprove ? user.id : undefined,
      });
      setBlogCreated(true);
      setNewBlog({ title: "", excerpt: "", content: "", tags: "", isVlog: false, videoUrl: "" });
      if (autoApprove) {
        // Reload blogs
        const data = (await api.blogs.list()) as { blogs: BlogPost[] };
        setBlogs(data.blogs);
      }
    } catch {
      alert("Failed to create blog. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleApproveBlog = async (id: string) => {
    if (!user) return;
    await api.blogs.approve(id, user.id);
    setBlogs((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, approvalStatus: "approved" as const } : b
      )
    );
  };

  const handleRejectBlog = async (id: string) => {
    if (!user) return;
    await api.blogs.reject(id, user.id);
    setBlogs((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, approvalStatus: "rejected" as const } : b
      )
    );
  };

  // Filter blogs for display
  const filtered = blogs.filter((blog) => {
    // Non-admins only see approved blogs
    if (!canApproveContent && blog.approvalStatus !== "approved") return false;
    if (activeType !== "all" && blog.type !== activeType) return false;
    if (contentFilter === "vlog" && !blog.isVlog) return false;
    if (contentFilter === "blog" && blog.isVlog) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        blog.title.toLowerCase().includes(q) ||
        blog.excerpt.toLowerCase().includes(q) ||
        blog.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const approvedFiltered = filtered.filter(
    (b) => b.approvalStatus === "approved"
  );
  const pendingFiltered = filtered.filter(
    (b) => b.approvalStatus === "pending"
  );

  const featuredBlog = approvedFiltered[0];
  const otherBlogs = approvedFiltered.slice(1);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-24">
        <Loader2 className="h-8 w-8 animate-spin text-t2w-accent" />
      </div>
    );
  }

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

        {/* Pending Blogs - visible only to Core+ */}
        {canApproveContent && pendingFiltered.length > 0 && (
          <div className="mb-10 card border-yellow-400/20 bg-yellow-400/5">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
              Pending Approval ({pendingFiltered.length})
            </h3>
            <div className="space-y-3">
              {pendingFiltered.map((blog) => (
                <div
                  key={blog.id}
                  className="flex flex-col gap-3 sm:flex-row sm:items-center rounded-xl bg-t2w-surface p-4"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white truncate">
                      {blog.title}
                    </h4>
                    <p className="text-xs text-t2w-muted mt-1">
                      By {blog.authorName} &middot;{" "}
                      {new Date(blog.publishDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveBlog(blog.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-green-400/10 px-3 py-2 text-xs font-medium text-green-400 hover:bg-green-400/20"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectBlog(blog.id)}
                      className="flex items-center gap-1.5 rounded-lg bg-red-400/10 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-400/20"
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Featured Post */}
        {featuredBlog && (
          <Link href={`/blog/${featuredBlog.id}`} className="card-interactive group mb-10 overflow-hidden block">
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
                      {(featuredBlog.authorName || "")
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {featuredBlog.authorName}
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
          </Link>
        )}

        {/* Blog Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {otherBlogs.map((blog) => (
            <Link key={blog.id} href={`/blog/${blog.id}`} className="block">
            <article className="card-interactive group">
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
                  <span className="text-xs text-t2w-muted">{blog.authorName}</span>
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
            </Link>
          ))}
        </div>

        {approvedFiltered.length === 0 && (
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

        {/* Write CTA / Create Form */}
        <div className="mt-16">
          {!showCreateForm ? (
            <div className="text-center">
              <div className="card inline-block mx-auto max-w-lg">
                <h3 className="font-display text-xl font-bold text-white">
                  Share Your Tale
                </h3>
                <p className="mt-2 text-sm text-t2w-muted">
                  Got a ride story to tell? Write a blog or share your vlog with
                  the T2W community.
                </p>
                {canPostBlog ? (
                  <button
                    onClick={() => {
                      setShowCreateForm(true);
                      setBlogCreated(false);
                    }}
                    className="btn-primary mt-4 flex items-center gap-2 mx-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Create Post
                  </button>
                ) : (
                  <p className="mt-3 text-xs text-t2w-muted">
                    {user
                      ? "Only T2W riders who have participated in rides can create posts."
                      : "Log in to share your tale."}
                  </p>
                )}
              </div>
            </div>
          ) : blogCreated && !canApproveContent ? (
            <div className="card max-w-2xl mx-auto border-green-400/20 bg-green-400/5 text-center">
              <CheckCircle className="mx-auto h-10 w-10 text-green-400" />
              <h3 className="mt-3 font-display text-lg font-bold text-white">
                Blog Submitted!
              </h3>
              <p className="mt-2 text-sm text-t2w-muted">
                Your blog has been submitted for review. It will be visible once
                approved by a Core Member or Super Admin.
              </p>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setBlogCreated(false);
                }}
                className="btn-secondary mt-4"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="card max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-xl font-bold text-white">
                  Create a New Post
                </h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-t2w-muted hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {!canApproveContent && (
                <div className="mb-4 rounded-xl bg-yellow-400/10 border border-yellow-400/20 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-400">
                    Your post will be submitted for review and will be visible
                    once approved by a Core Member or Super Admin.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Title *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Your blog title"
                    value={newBlog.title}
                    onChange={(e) =>
                      setNewBlog({ ...newBlog, title: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Excerpt
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Short description (optional)"
                    value={newBlog.excerpt}
                    onChange={(e) =>
                      setNewBlog({ ...newBlog, excerpt: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Content *
                  </label>
                  <textarea
                    rows={8}
                    className="input-field resize-none"
                    placeholder="Write your ride story..."
                    value={newBlog.content}
                    onChange={(e) =>
                      setNewBlog({ ...newBlog, content: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Tags
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Comma-separated tags e.g. adventure, coastal, karnataka"
                    value={newBlog.tags}
                    onChange={(e) =>
                      setNewBlog({ ...newBlog, tags: e.target.value })
                    }
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newBlog.isVlog}
                    onChange={(e) =>
                      setNewBlog({ ...newBlog, isVlog: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-t2w-border accent-t2w-accent"
                  />
                  <span className="text-sm text-gray-300">
                    This is a video post (Vlog)
                  </span>
                </label>

                {newBlog.isVlog && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-300">
                      Video URL
                    </label>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://youtube.com/..."
                      value={newBlog.videoUrl}
                      onChange={(e) =>
                        setNewBlog({ ...newBlog, videoUrl: e.target.value })
                      }
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleCreateBlog}
                    disabled={
                      creating || !newBlog.title.trim() || !newBlog.content.trim()
                    }
                    className="btn-primary flex items-center gap-2"
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {creating
                      ? "Submitting..."
                      : canApproveContent
                      ? "Publish"
                      : "Submit for Review"}
                  </button>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
