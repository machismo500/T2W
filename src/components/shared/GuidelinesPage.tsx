"use client";

import { useState } from "react";
import {
  Shield,
  Users,
  Wrench,
  Navigation,
  AlertTriangle,
  Clipboard,
  Hand,
  Fuel,
  BookOpen,
  CheckCircle,
  ChevronDown,
} from "lucide-react";
import { mockGuidelines } from "@/data/mock";

const categoryConfig = {
  group: {
    label: "Group Riding",
    icon: Users,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  safety: {
    label: "Safety",
    icon: Shield,
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  maintenance: {
    label: "Maintenance",
    icon: Wrench,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  general: {
    label: "General Tips",
    icon: Navigation,
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
};

const iconMap: Record<string, React.ElementType> = {
  clipboard: Clipboard,
  users: Users,
  hand: Hand,
  shield: Shield,
  wrench: Wrench,
  navigation: Navigation,
  "alert-triangle": AlertTriangle,
  fuel: Fuel,
};

export function GuidelinesPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered =
    activeCategory === "all"
      ? mockGuidelines
      : mockGuidelines.filter((g) => g.category === activeCategory);

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-t2w-accent/10">
            <BookOpen className="h-8 w-8 text-t2w-accent" />
          </div>
          <h1 className="font-display text-4xl font-bold text-white md:text-5xl">
            Riding <span className="gradient-text">Guidelines</span> & Tips
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-t2w-muted">
            Safety first, adventure always. These guidelines are the foundation
            of every T2W ride. Know them, follow them, enjoy the ride.
          </p>
        </div>

        {/* Category Filters */}
        <div className="mb-10 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setActiveCategory("all")}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
              activeCategory === "all"
                ? "bg-t2w-accent text-white shadow-lg shadow-t2w-accent/25"
                : "bg-t2w-surface text-t2w-muted hover:text-white"
            }`}
          >
            All Guidelines
          </button>
          {Object.entries(categoryConfig).map(([key, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${
                  activeCategory === key
                    ? `${config.bg} ${config.color}`
                    : "bg-t2w-surface text-t2w-muted hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" />
                {config.label}
              </button>
            );
          })}
        </div>

        {/* Guidelines List */}
        <div className="space-y-4">
          {filtered.map((guideline) => {
            const catConfig =
              categoryConfig[
                guideline.category as keyof typeof categoryConfig
              ];
            const Icon = iconMap[guideline.icon] || Shield;
            const isExpanded = expandedId === guideline.id;

            return (
              <div
                key={guideline.id}
                className="card cursor-pointer overflow-hidden"
                onClick={() =>
                  setExpandedId(isExpanded ? null : guideline.id)
                }
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${catConfig.bg}`}
                  >
                    <Icon className={`h-6 w-6 ${catConfig.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-lg px-2 py-0.5 text-xs font-medium ${catConfig.bg} ${catConfig.color}`}
                      >
                        {catConfig.label}
                      </span>
                    </div>
                    <h3 className="mt-2 font-display text-lg font-bold text-white">
                      {guideline.title}
                    </h3>
                    {!isExpanded && (
                      <p className="mt-1 text-sm text-t2w-muted line-clamp-2">
                        {guideline.content}
                      </p>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-t2w-muted transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </div>

                {isExpanded && (
                  <div className="mt-4 rounded-xl bg-t2w-surface-light p-5">
                    <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-line">
                      {guideline.content}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pro Tips Section */}
        <div className="mt-16">
          <h2 className="mb-8 text-center font-display text-3xl font-bold text-white">
            Tips from T2W Veterans
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              {
                tip: "Always check your tire pressure before a ride. Under-inflated tires are the #1 cause of poor handling and accidents on long rides.",
                author: "Arjun Mehta",
                role: "Founder, 15+ years riding",
              },
              {
                tip: "In a group, ride your own ride. Don't try to keep up with faster riders. Everyone reaches the destination — speed doesn't matter, safety does.",
                author: "Priya Sharma",
                role: "Route Master, 12+ years riding",
              },
              {
                tip: "Hydration is key, especially in summer. Dehydration affects concentration and reaction time. Take regular water breaks even if you don't feel thirsty.",
                author: "Vikram Singh",
                role: "Head of Safety, 18+ years riding",
              },
              {
                tip: "Learn to read the road surface. Gravel, wet patches, oil spills, and painted lines are all hazards. Train your eyes to spot them early.",
                author: "Rahul Desai",
                role: "Community Manager, 10+ years riding",
              },
            ].map((item, i) => (
              <div key={i} className="card">
                <div className="mb-4 text-3xl text-t2w-accent">&ldquo;</div>
                <p className="text-sm leading-relaxed text-gray-300">
                  {item.tip}
                </p>
                <div className="mt-4 flex items-center gap-3 border-t border-t2w-border pt-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-t2w-accent/10 font-display text-sm font-bold text-t2w-accent">
                    {item.author
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {item.author}
                    </p>
                    <p className="text-xs text-t2w-muted">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
