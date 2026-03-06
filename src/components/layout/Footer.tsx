import Link from "next/link";
import {
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
    { label: "Privacy Policy", href: "/guidelines" },
    { label: "Terms of Service", href: "/guidelines" },
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
              <div className="h-10 w-10 shrink-0">
                <img src="/logo.png" alt="Tales on 2 Wheels" className="h-full w-full object-contain" />
              </div>
              <div>
                <span className="font-display text-xl font-bold text-white">
                  Tales on 2 Wheels
                </span>
              </div>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-t2w-muted">
              India&apos;s premier motorcycle riding community based in Bangalore,
              Karnataka. Group rides to Ladakh, Nepal, Thailand,
              Munnar, Goa, Rajasthan &amp; across India. Every ride tells a story.
            </p>

            {/* Social Links */}
            <div className="mt-6 flex items-center gap-3">
              {[
                { icon: Instagram, href: "https://www.instagram.com/Tales.On.2.Wheels", label: "Instagram" },
                { icon: Youtube, href: "https://www.youtube.com/@TalesOn2Wheels", label: "YouTube" },
                { icon: Facebook, href: "https://www.facebook.com/TalesOn2Wheels", label: "Facebook" },
                { icon: Twitter, href: "https://x.com/TalesOn2Wheels", label: "Twitter" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
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
                href="mailto:Info@taleson2wheels.com"
                className="flex items-center gap-2 text-sm text-t2w-muted transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4" />
                Info@taleson2wheels.com
              </a>
              <a
                href="tel:+919880141543"
                className="flex items-center gap-2 text-sm text-t2w-muted transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4" />
                +91 98801 41543
              </a>
            </div>
          </div>
        </div>

        {/* Popular Routes - SEO keyword-rich section */}
        <div className="mt-12 border-t border-t2w-border pt-8">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
            Popular Motorcycle Routes from Bangalore
          </h3>
          <div className="flex flex-wrap gap-2">
            {[
              "Bangalore to Sakleshpur",
              "Bangalore to Chikmagalur",
              "Bangalore to BR Hills",
              "Bangalore to Coorg",
              "Bangalore to Hampi",
              "Bangalore to Kabini",
              "Bangalore to Pondicherry",
              "Bangalore to Gokarna",
              "Bangalore to Mangalore",
              "Bangalore to Goa",
              "Manali to Leh (Himalayan)",
              "Kathmandu to Pokhara (Nepal)",
              "Bangkok to Chiang Mai (Thailand)",
            ].map((route) => (
              <Link
                key={route}
                href="/rides"
                className="rounded-lg border border-t2w-border bg-t2w-surface px-3 py-1.5 text-xs text-t2w-muted transition-colors hover:border-t2w-accent/50 hover:text-white"
              >
                {route}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-t2w-border pt-8 sm:flex-row">
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
