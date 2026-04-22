"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { UserPlus, Bell, MapPin, ArrowRight } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    number: "01",
    title: "Register for Free",
    description:
      "Create your T2W account in minutes. Tell us about your riding experience and bike — that's all it takes to get started.",
    color: "text-t2w-accent",
    bg: "bg-t2w-accent/10",
    border: "border-t2w-accent/20",
  },
  {
    icon: Bell,
    number: "02",
    title: "Get Notified Automatically",
    description:
      "Every time a new ride is announced, you'll receive an email instantly. No manual checking required — just open your inbox and get ready.",
    color: "text-t2w-gold",
    bg: "bg-t2w-gold/10",
    border: "border-t2w-gold/20",
  },
  {
    icon: MapPin,
    number: "03",
    title: "Register & Ride",
    description:
      "Find a ride that excites you, register your spot, and show up at the start point. Our experienced ride leaders handle the rest.",
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/20",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

export function HowToJoin() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-t2w-accent/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: "easeOut" as const }}
        >
          <h2 className="section-title">How to Join the Ride Group?</h2>
          <p className="mx-auto mt-4 max-w-2xl section-subtitle">
            Three simple steps and you&apos;re riding with Bangalore&apos;s most
            passionate motorcycle community.
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          className="mt-16 grid gap-8 md:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div key={step.number} variants={itemVariants}>
                <div
                  className={`card group relative h-full border ${step.border} hover:border-opacity-60 transition-all duration-300`}
                >
                  {/* Connector line between cards (desktop) */}
                  {index < steps.length - 1 && (
                    <div className="pointer-events-none absolute -right-4 top-12 z-10 hidden w-8 md:block">
                      <div className="h-px w-full bg-gradient-to-r from-t2w-border to-transparent" />
                      <div className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-t2w-border" />
                    </div>
                  )}

                  {/* Step number */}
                  <div className="mb-5 flex items-center justify-between">
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${step.bg} transition-transform group-hover:scale-110 duration-300`}
                    >
                      <Icon className={`h-6 w-6 ${step.color}`} />
                    </div>
                    <span
                      className={`font-mono text-3xl font-bold ${step.color} opacity-20 group-hover:opacity-40 transition-opacity duration-300`}
                    >
                      {step.number}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-bold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-t2w-muted">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Email notification callout */}
        <motion.div
          className="mt-12 overflow-hidden rounded-2xl border border-t2w-accent/20 bg-gradient-to-r from-t2w-accent/5 to-t2w-gold/5 p-8"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, ease: "easeOut" as const, delay: 0.3 }}
        >
          <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-t2w-accent/10">
              <Bell className="h-8 w-8 text-t2w-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-display text-xl font-bold text-white">
                Automatic Email Notifications
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-t2w-muted">
                Once registered, you&apos;ll be the first to know whenever a new ride
                is announced — straight to your inbox. Never miss a ride because
                you weren&apos;t looking at the website.
              </p>
            </div>
            <Link
              href="/register"
              className="btn-primary group flex shrink-0 items-center gap-2 whitespace-nowrap"
            >
              Join Now
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
