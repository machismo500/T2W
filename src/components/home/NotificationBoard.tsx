"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Info,
  AlertTriangle,
  CheckCircle,
  Bike,
  ChevronRight,
  X,
} from "lucide-react";
import { api } from "@/lib/api-client";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "ride";
  date: string;
  isRead: boolean;
};

type BlogHighlight = {
  title: string;
  author: string;
  date: string;
  tag: string;
  readTime: string;
};

const typeConfig = {
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/20",
  },
  success: {
    icon: CheckCircle,
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
  },
  ride: {
    icon: Bike,
    color: "text-t2w-accent",
    bg: "bg-t2w-accent/10",
    border: "border-t2w-accent/20",
  },
};

export function NotificationBoard() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [blogHighlights, setBlogHighlights] = useState<BlogHighlight[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [blogsLoading, setBlogsLoading] = useState(true);

  useEffect(() => {
    api.notifications
      .list()
      .then((data) => {
        const { notifications } = data as { notifications: Notification[] };
        setNotifications(notifications);
      })
      .catch(() => {
        setNotifications([]);
      })
      .finally(() => {
        setLoading(false);
      });

    fetch("/api/blogs")
      .then((res) => res.json())
      .then((data) => {
        const blogs = (data.blogs || []).slice(0, 3).map((blog: {
          title: string;
          authorName: string;
          publishDate: string;
          tags: string | string[];
          type: string;
          readTime: number;
        }) => ({
          title: blog.title,
          author: blog.authorName,
          date: new Date(blog.publishDate).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          tag: Array.isArray(blog.tags)
            ? blog.tags[0] || blog.type
            : blog.type,
          readTime: `${blog.readTime} min read`,
        }));
        setBlogHighlights(blogs);
      })
      .catch(() => {
        setBlogHighlights([]);
      })
      .finally(() => {
        setBlogsLoading(false);
      });
  }, []);

  const filtered =
    filter === "all"
      ? notifications
      : notifications.filter((n) => n.type === filter);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    api.notifications.markRead(id).catch(() => {
      // Revert optimistic update on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))
      );
    });
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <section className="relative py-24 bg-t2w-surface/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2">
          {/* Notifications */}
          <div>
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-t2w-accent/10">
                <Bell className="h-5 w-5 text-t2w-accent" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Updates & Notifications
                </h2>
                {unreadCount > 0 && (
                  <p className="text-sm text-t2w-muted">
                    {unreadCount} unread notification
                    {unreadCount > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="mb-6 flex gap-2">
              {["all", "ride", "info", "warning", "success"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                    filter === type
                      ? "bg-t2w-accent text-white"
                      : "bg-t2w-surface-light text-t2w-muted hover:text-white"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Notification List */}
            <div className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-t2w-accent border-t-transparent" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="py-8 text-center text-sm text-t2w-muted">
                  No notifications found.
                </p>
              ) : (
                filtered.map((notif) => {
                  const config = typeConfig[notif.type];
                  const Icon = config.icon;
                  return (
                    <div
                      key={notif.id}
                      className={`group relative flex gap-4 rounded-xl border p-4 transition-all ${
                        notif.isRead
                          ? "border-t2w-border bg-t2w-surface/50"
                          : `${config.border} ${config.bg}`
                      }`}
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.bg}`}
                      >
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`text-sm font-semibold ${
                              notif.isRead ? "text-gray-300" : "text-white"
                            }`}
                          >
                            {notif.title}
                          </h4>
                          {!notif.isRead && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-t2w-accent" />
                          )}
                        </div>
                        <p className="mt-1 text-sm text-t2w-muted">
                          {notif.message}
                        </p>
                        <span className="mt-2 inline-block text-xs text-t2w-muted">
                          {new Date(notif.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Blog Highlights */}
          <div>
            <div className="mb-8">
              <h2 className="font-display text-2xl font-bold text-white">
                Blog Highlights
              </h2>
              <p className="mt-2 text-sm text-t2w-muted">
                Stories, tips, and tales from the community
              </p>
            </div>

            <div className="space-y-4">
              {blogsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-t2w-accent border-t-transparent" />
                </div>
              ) : blogHighlights.length === 0 ? (
                <p className="py-8 text-center text-sm text-t2w-muted">
                  No blog posts yet.
                </p>
              ) : (
                blogHighlights.map((blog, i) => (
                <Link
                  key={i}
                  href="/blogs"
                  className="card-interactive group flex gap-4"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-t2w-accent/20 to-t2w-gold/20 font-display text-2xl font-bold text-t2w-accent">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-t2w-accent/10 px-2 py-0.5 text-xs font-medium text-t2w-accent">
                        {blog.tag}
                      </span>
                      <span className="text-xs text-t2w-muted">
                        {blog.readTime}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-sm font-semibold text-white group-hover:text-t2w-accent transition-colors line-clamp-2">
                      {blog.title}
                    </h3>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-t2w-muted">
                      <span>{blog.author}</span>
                      <span>&middot;</span>
                      <span>{blog.date}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 self-center text-t2w-muted transition-transform group-hover:translate-x-1 group-hover:text-t2w-accent" />
                </Link>
              )))}
            </div>

            <Link
              href="/blogs"
              className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-t2w-border py-3 text-sm font-medium text-t2w-muted transition-all hover:border-t2w-accent/50 hover:text-white"
            >
              View All Posts
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
