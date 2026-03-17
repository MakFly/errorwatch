"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, LayoutDashboard, LogOut, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { useSession, signOut } from "@/lib/auth-client";
import { useTranslations, useLocale } from "next-intl";
import { routing } from "@/i18n/routing";

function getInitials(name: string | null | undefined): string {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

const localeLabels: Record<string, string> = {
  "en-US": "EN",
  fr: "FR",
};

function setLocaleCookie(locale: string) {
  document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

function MarketingLocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  function onChange(newLocale: string) {
    setLocaleCookie(newLocale);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2">
          <Globe className="h-4 w-4" />
          <span className="text-xs">{localeLabels[locale] ?? locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => onChange(l)}
            className={l === locale ? "bg-accent" : "cursor-pointer"}
          >
            {l === "en-US" ? "English" : "Français"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();
  const { data: session } = useSession();
  const t = useTranslations("marketing");

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 50);
  });

  const navLinks = [
    { href: "#features", label: t("nav.features") },
    { href: "#how-it-works", label: t("nav.howItWorks") },
    { href: "#pricing", label: t("nav.pricing") },
    { href: "https://github.com", label: t("nav.docs"), external: true },
  ];

  return (
    <motion.header
      className={`fixed top-0 z-50 w-full border-b transition-all duration-300 ${
        isScrolled
          ? "border-border/60 bg-background/90 backdrop-blur-xl shadow-lg shadow-black/5"
          : "border-transparent bg-transparent"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <motion.div
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 shadow-lg shadow-violet-600/25"
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Zap className="h-5 w-5 text-white" />
          </motion.div>
          <motion.span
            className="text-lg font-bold tracking-tight"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            ErrorWatch
          </motion.span>
        </Link>

        {/* Desktop Navigation */}
        <motion.div
          className="hidden items-center gap-8 md:flex"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, staggerChildren: 0.05 }}
        >
          {navLinks.map((link, i) => (
            <motion.div
              key={link.href}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
            >
              <Link
                href={link.href}
                target={link.external ? "_blank" : undefined}
                className="relative text-sm font-medium text-muted-foreground transition-colors hover:text-foreground group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-violet-500 transition-all duration-300 group-hover:w-full" />
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Locale + Auth Buttons */}
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <MarketingLocaleSwitcher />
          {session?.user ? (
            <div className="flex items-center gap-3">
              {/* Bouton Dashboard - toujours visible */}
              <Link href="/dashboard">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    {t("nav.dashboard")}
                  </Button>
                </motion.div>
              </Link>

              {/* Avatar avec dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-background"
                  >
                    <Avatar className="h-8 w-8 border-2 border-transparent hover:border-violet-500/50 transition-colors">
                      <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
                      <AvatarFallback className="bg-violet-600 text-white text-xs font-medium">
                        {getInitials(session.user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{session.user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      {t("nav.dashboard")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ fetchOptions: { onSuccess: () => { window.location.href = "/"; } } })}
                    className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("nav.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <>
              <Link href="/login">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                    {t("nav.signIn")}
                  </Button>
                </motion.div>
              </Link>
              <Link href="/signup">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button size="sm" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md shadow-violet-600/20 hover:shadow-lg hover:shadow-violet-600/30 transition-shadow">
                    {t("nav.getStarted")}
                  </Button>
                </motion.div>
              </Link>
            </>
          )}
        </motion.div>
      </nav>
    </motion.header>
  );
}

function Footer() {
  const t = useTranslations("marketing");

  const footerLinks = {
    [t("footer.product")]: [
      { href: "#features", label: t("footer.links.features") },
      { href: "#pricing", label: t("footer.links.pricing") },
      { href: "#", label: t("footer.links.changelog") },
    ],
    [t("footer.resources")]: [
      { href: "#", label: t("footer.links.documentation") },
      { href: "#", label: t("footer.links.apiReference") },
      { href: "#", label: t("footer.links.github") },
    ],
    [t("footer.company")]: [
      { href: "#", label: t("footer.links.about") },
      { href: "#", label: t("footer.links.blog") },
      { href: "#", label: t("footer.links.contact") },
    ],
  };

  return (
    <footer className="border-t border-border/40 bg-card/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-3 group">
              <motion.div
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-purple-700"
                whileHover={{ scale: 1.05, rotate: -5 }}
              >
                <Zap className="h-5 w-5 text-white" />
              </motion.div>
              <span className="text-lg font-bold">ErrorWatch</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold">{category}</h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors relative group"
                    >
                      <span className="relative">
                        {link.label}
                        <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-violet-500 transition-all duration-300 group-hover:w-full" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <motion.div
          className="mt-12 border-t border-border/40 pt-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <p className="text-center text-sm text-muted-foreground">
            &copy; 2026 ErrorWatch. {t("footer.allRightsReserved")}
          </p>
        </motion.div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen scroll-smooth">
      <Navbar />
      <main className="pt-16">
        {children}
      </main>
      <Footer />
    </div>
  );
}
