import Link from "next/link";
import {
  Bike,
  Mail,
  Phone,
  MapPin,
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  Heart,
  ArrowUpRight,
} from "lucide-react";

const footerLinks = {
  rides: [
    { label: "Upcoming Rides", href: "/rides" },
    { label: "Past Rides", href: "/rides?filter=past" },
    { label: "Register for a Ride", href: "/rides" },
    { label: "Ride Gallery", href: "/rides" },
  ],
  community: [
    { label: "Blog", href: "/blogs" },
    { label: "Rider Dashboard", href: "/dashboard" },
    { label: "Achievements", href: "/dashboard" },
    { label: "Guidelines", href: "/guidelines" },
  ],
  company: [
    { label: "About Us", href: "/#about" },
    { label: "Contact", href: "/#contact" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

export function Footer() {
  return (
    <footer className="relative border-t border-t2w-border bg-t2w-dark">
      {/* Decorative gradient */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-t2w-accent/50 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="group inline-flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-t2w-accent to-red-600">
                <Bike className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-display text-xl font-bold text-white">
                  Tales on 2 Wheels
                </span>
              </div>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-t2w-muted">
              India&apos;s premier motorcycle riding community. Every ride tells a
              story, every road leads to adventure. Join us and write your own
              tale.
            </p>

            {/* Social Links */}
            <div className="mt-6 flex items-center gap-3">
              {[
                { icon: Instagram, href: "#", label: "Instagram" },
                { icon: Youtube, href: "#", label: "YouTube" },
                { icon: Facebook, href: "#", label: "Facebook" },
                { icon: Twitter, href: "#", label: "Twitter" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-t2w-border bg-t2w-surface text-t2w-muted transition-all duration-200 hover:border-t2w-accent/50 hover:text-t2w-accent"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Rides
            </h3>
            <ul className="space-y-3">
              {footerLinks.rides.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="group flex items-center text-sm text-t2w-muted transition-colors hover:text-white"
                  >
                    {link.label}
                    <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Community
            </h3>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="group flex items-center text-sm text-t2w-muted transition-colors hover:text-white"
                  >
                    {link.label}
                    <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Company
            </h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="group flex items-center text-sm text-t2w-muted transition-colors hover:text-white"
                  >
                    {link.label}
                    <ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition-all group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>

            {/* Contact */}
            <div className="mt-8 space-y-2">
              <a
                href="mailto:ride@talesontwowheels.com"
                className="flex items-center gap-2 text-sm text-t2w-muted transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4" />
                ride@talesontwowheels.com
              </a>
              <a
                href="tel:+919876543210"
                className="flex items-center gap-2 text-sm text-t2w-muted transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4" />
                +91 98765 43210
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-t2w-border pt-8 sm:flex-row">
          <p className="text-sm text-t2w-muted">
            &copy; {new Date().getFullYear()} Tales on 2 Wheels. All rights
            reserved.
          </p>
          <p className="flex items-center gap-1 text-sm text-t2w-muted">
            Made with <Heart className="h-3 w-3 text-t2w-accent" /> by riders,
            for riders
          </p>
        </div>
      </div>
    </footer>
  );
}
